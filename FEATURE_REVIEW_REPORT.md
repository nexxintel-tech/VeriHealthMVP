# Feature Review Report: Institution Join URL + WhatsApp Value-First Onboarding

**Date:** February 11, 2026
**Reviewer:** VeriHealth Engineering
**Scope:** Prompt validation against existing VeriHealth codebase and Supabase database

---

## 1. Executive Summary

The proposed feature prompt contains several assumptions about the existing database and codebase that do not match reality. Implementing the prompt as-is would cause conflicts with existing tables, break the authentication flow, and attempt to extend integrations (MessageBird/WhatsApp) that do not yet exist. This report identifies each conflict and provides corrective guidance.

---

## 2. Existing Database Schema (Supabase)

The following tables currently exist in the VeriHealth Supabase database:

| Table | Key Columns |
|-------|-------------|
| `institutions` | id, name, address, contact_email, contact_phone, is_default, created_at |
| `users` | id, email, role, institution_id, approval_status, created_at |
| `patients` | id, user_id, name, age, gender, status, created_at |
| `clinician_profiles` | id, user_id, full_name, license_number, specialty, phone, created_at |
| `conditions` | id, patient_id, name, created_at |
| `vital_readings` | id, patient_id, type, value, unit, timestamp, status, created_at |
| `risk_scores` | id, patient_id, score, risk_level, last_sync, created_at, updated_at |
| `alerts` | id, patient_id, type, message, severity, is_read, timestamp, created_at |
| `activity_logs` | user_id, action, target_type, target_id, details, ip_address |

### Existing Roles

- `patient`, `clinician`, `admin`, `institution_admin`

### Existing Auth Pattern

- Custom JWT issued by the server (using `jsonwebtoken` library)
- Middleware: `authenticateUser` verifies custom JWTs (NOT Supabase session tokens)
- Supabase is used server-side with the **service role key** for all database operations
- Role-based access via `requireRole()` middleware

---

## 3. Detailed Conflict Analysis

### 3.1 `institutions` Table — EXISTS, Schema Mismatch

**Prompt assumes:** A new table with columns `slug`, `institution_type`, `join_mode`, `allowed_intents`, `requires_approval`

**Reality:** The table already exists with different columns:

| Existing Column | Type |
|-----------------|------|
| id | uuid (pk) |
| name | text |
| address | text (nullable) |
| contact_email | text (nullable) |
| contact_phone | text (nullable) |
| is_default | boolean |
| created_at | timestamptz |

**Impact:** Running `CREATE TABLE institutions` will fail with "relation already exists."

**Correction:**
- Use `ALTER TABLE institutions ADD COLUMN IF NOT EXISTS` for each new column:
  - `slug TEXT UNIQUE` (must be backfilled for existing institutions)
  - `institution_type TEXT DEFAULT 'hospital'` with CHECK constraint
  - `join_mode TEXT DEFAULT 'open'` with CHECK constraint
  - `allowed_intents TEXT[] DEFAULT '{}'`
  - `requires_approval BOOLEAN DEFAULT false`
- Do NOT drop or recreate the existing table
- Existing columns (`address`, `contact_email`, `contact_phone`, `is_default`) must be preserved
- The `is_default` column (boolean) is actively used in clinician registration to assign a fallback institution

---

### 3.2 `user_profiles` Table — DOES NOT EXIST (Must Not Be Created)

**Prompt assumes:** A `user_profiles` table with `primary_institution_id` and `full_name`

**Reality:** The codebase splits profile data across three existing tables:

| Table | Purpose | Relevant Fields |
|-------|---------|-----------------|
| `users` | All users | `institution_id` (serves as primary institution link) |
| `clinician_profiles` | Clinician-specific data | `full_name`, `specialty`, `phone`, `license_number` |
| `patients` | Patient-specific data | `name`, `age`, `gender`, `assigned_clinician_id` |

**Impact:** Creating `user_profiles` would introduce a conflicting/redundant table that overlaps with `users` and `clinician_profiles`. Other parts of the codebase would not know to query this new table.

**Correction:**
- Replace all references to `user_profiles.primary_institution_id` with `users.institution_id`
- Replace all references to `user_profiles.full_name` with:
  - For clinicians: `clinician_profiles.full_name`
  - For patients: `patients.name`
- Do NOT create a `user_profiles` table
- The `users.institution_id` column already serves the "primary institution" purpose and is actively used in clinician registration, admin panel user management, and dashboard stats filtering

---

### 3.3 `institution_memberships` Table — DOES NOT EXIST (Safe to Create)

**Prompt assumes:** New table for many-to-many user-institution relationships

**Reality:** No equivalent exists. Currently, users have a single `institution_id` in the `users` table (one-to-one relationship).

**Impact:** No conflict. This is a genuinely new table that adds multi-institution support.

**Correction:**
- Foreign keys must reference `users(id)`, NOT `auth.users(id)`. The codebase uses a local `users` table that mirrors Supabase Auth users.
- Consider how this coexists with `users.institution_id` — the membership table adds flexibility but the existing column remains the "primary" link used throughout the codebase.

---

### 3.4 `conversation_sessions` Table — DOES NOT EXIST (Safe to Create)

**Prompt assumes:** New table for WhatsApp session state management

**Reality:** No equivalent exists.

**Impact:** No conflict.

**Correction:**
- Same FK note as above — reference `users(id)`, not `auth.users(id)`

---

### 3.5 `emergency_events` Table — DOES NOT EXIST (Safe to Create)

**Prompt assumes:** Optional EMS event tracking table

**Reality:** The `alerts` table exists but serves a different purpose (clinical monitoring alerts with severity levels, read/unread tracking, clinician response workflow). It does not track EMS lifecycle states.

**Impact:** No conflict if created as a separate table.

**Correction:** None needed — create as described with proper FK references to `users(id)`.

---

### 3.6 Authentication — CRITICAL MISMATCH

**Prompt assumes:** Supabase access tokens (`Authorization: Bearer <supabase_access_token>`) verified by Supabase auth middleware

**Reality:** The codebase uses a completely different auth flow:

```
Login Flow:
1. Client sends email/password to POST /api/auth/login
2. Server authenticates via Supabase Auth (supabase.auth.signInWithPassword)
3. Server immediately signs OUT the Supabase session
4. Server issues its OWN custom JWT (using jsonwebtoken library)
5. Custom JWT payload: { id, email, role, institutionId }
6. Client stores this custom JWT and sends it as Bearer token

Verification Flow:
1. authenticateUser middleware extracts Bearer token
2. Verifies using jsonwebtoken (NOT Supabase)
3. Sets req.user = { id, email, role, institutionId }
```

**Impact:** Using Supabase access tokens would bypass the existing auth system entirely. New endpoints expecting Supabase tokens would be inaccessible to users logged in through the existing flow. The two auth systems would be incompatible.

**Correction:**
- All new protected endpoints MUST use the existing `authenticateUser` middleware
- Access user context via `req.user!.id`, `req.user!.role`, `req.user!.institutionId`
- For role-based access control, use the existing `requireRole('admin', 'clinician', ...)` middleware
- Do NOT introduce Supabase session verification for API routes
- The `POST /api/institutions/bind` endpoint should be protected with `authenticateUser`, not Supabase token verification

---

### 3.7 WhatsApp / MessageBird Integration — DOES NOT EXIST

**Prompt assumes:** "Existing MessageBird WhatsApp integration exists OR webhook routing exists"

**Reality:** A thorough search of the codebase confirms there is:

| Component | Status |
|-----------|--------|
| MessageBird SDK | NOT installed |
| WhatsApp webhook routes | NONE |
| Phone number field on `users` | DOES NOT EXIST |
| Phone-to-user mapping | NONE |
| Outbound messaging capability | NONE |
| MessageBird environment variables | NOT configured |
| Any webhook handler | NONE |

The only messaging integration that exists is **Resend** (email only), used for:
- Email confirmation during registration
- Password reset emails

**Impact:** The WhatsApp section cannot "extend" something that doesn't exist — it must be built entirely from scratch.

**Correction:**
- The prompt must state "CREATE a new MessageBird WhatsApp integration" instead of "extend existing"
- Add `phone` column to `users` table: `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`
- Install MessageBird SDK: `npm install messagebird`
- Create webhook route from scratch: `POST /webhooks/messagebird/inbound`
- Add required environment variables:
  - `MESSAGEBIRD_API_KEY`
  - `MESSAGEBIRD_CHANNEL_ID`
  - `MESSAGEBIRD_WEBHOOK_SIGNING_KEY`
- Build outbound message sending service
- Build phone number normalization utility (E.164 format for Nigerian numbers: +234...)
- Note: `clinician_profiles` has a `phone` field, but `users` and `patients` do not

---

## 4. Existing Institution Endpoints (Route Conflicts Check)

These routes already exist and handle institution operations:

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/institutions` | Public | List all institutions (for registration dropdowns) |
| GET | `/api/admin/institutions` | Admin | List all institutions (admin panel) |
| POST | `/api/admin/institutions` | Admin | Create institution |
| PATCH | `/api/admin/institutions/:id` | Admin | Update institution |
| DELETE | `/api/admin/institutions/:id` | Admin | Delete institution |

**New proposed routes:**
| Method | Route | Auth | Conflict? |
|--------|-------|------|-----------|
| GET | `/api/institutions/resolve?slug=` | Public | NO — different path, safe to add |
| POST | `/api/institutions/bind` | Protected | NO — different path, safe to add |

**Verdict:** No route conflicts. Both new endpoints can be safely added.

---

## 5. Additional Observations

### 5.1 No Existing Validation Library

The prompt mentions "Validate payloads with Zod." The existing codebase does NOT use Zod for route validation — it uses manual checks:

```typescript
// Current pattern in the codebase
if (!email || !password || !fullName) {
  return res.status(400).json({ error: "Email, password, and full name are required" });
}
```

**Options:**
- Introduce Zod as a new dependency (adds consistency going forward, minor risk)
- Match the existing manual validation style (maintains consistency with current code)

### 5.2 Patient-Institution Link is Indirect

Currently, patients are linked to institutions **through their assigned clinician**:
- `patients.assigned_clinician_id` → clinician's `users.institution_id`
- There is no direct `patients.institution_id` column

The `institution_memberships` table would provide a more flexible direct link but must coexist with the existing indirect assignment pattern.

### 5.3 Clinician Registration Depends on `is_default`

The clinician registration endpoint (`POST /api/auth/register-clinician`) falls back to the institution where `is_default = true` if no `institutionId` is provided. Any changes to the `institutions` table must preserve this column and behavior.

### 5.4 Email Integration Already Exists (Resend)

The codebase has a working Resend email integration (`server/email.ts`, `server/resend.ts`) used for confirmation emails and password resets. If the WhatsApp feature needs email fallbacks, this infrastructure is available and should be reused.

---

## 6. Recommended Migration SQL

```sql
-- ============================================================
-- SAFE MIGRATION: Extend existing tables + create new tables
-- ============================================================

-- 1. Extend institutions table (DO NOT recreate)
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS institution_type TEXT DEFAULT 'hospital';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS join_mode TEXT DEFAULT 'open';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS allowed_intents TEXT[] DEFAULT '{}';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;

-- Add CHECK constraints (safe — only applies to future inserts/updates)
ALTER TABLE institutions DROP CONSTRAINT IF EXISTS chk_institution_type;
ALTER TABLE institutions ADD CONSTRAINT chk_institution_type
  CHECK (institution_type IN ('hospital','clinic','pharmacy','lab','insurer','employer','ngo'));

ALTER TABLE institutions DROP CONSTRAINT IF EXISTS chk_join_mode;
ALTER TABLE institutions ADD CONSTRAINT chk_join_mode
  CHECK (join_mode IN ('open','invite_only','approval_required'));

-- Backfill slugs for existing institutions
UPDATE institutions
SET slug = LOWER(REGEXP_REPLACE(REPLACE(name, ' ', '-'), '[^a-z0-9-]', '', 'g'))
WHERE slug IS NULL;

-- 2. Add phone to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Create institution_memberships (new table)
CREATE TABLE IF NOT EXISTS institution_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, institution_id),
  CONSTRAINT chk_membership_status CHECK (status IN ('pending','active','suspended'))
);

-- 4. Create conversation_sessions (new table)
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  current_state TEXT NOT NULL DEFAULT 'IDLE',
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create emergency_events (new table)
CREATE TABLE IF NOT EXISTS emergency_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  institution_id UUID REFERENCES institutions(id),
  status TEXT NOT NULL DEFAULT 'IDLE',
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_emergency_status CHECK (status IN (
    'IDLE','INTENT_RECEIVED','CONFIRMATION_PENDING',
    'AUTHORIZED','DISPATCHED','RESOLVED','CANCELLED','FAILED'
  ))
);
```

---

## 7. Risk Summary

| Area | Risk Level | Issue | Resolution |
|------|-----------|-------|------------|
| `institutions` table | MEDIUM | Exists with different schema | Use ALTER TABLE, not CREATE |
| `user_profiles` table | HIGH | Conflicts with existing `users` + `clinician_profiles` | Do NOT create; use existing tables |
| `institution_memberships` | LOW | New table, no conflicts | Create as described |
| `conversation_sessions` | LOW | New table, no conflicts | Create as described |
| `emergency_events` | LOW | New table, no conflicts | Create as described |
| Authentication | CRITICAL | Prompt uses Supabase tokens; codebase uses custom JWT | Must use existing `authenticateUser` middleware |
| WhatsApp / MessageBird | HIGH | Does not exist at all | Full build required, not an extension |
| Existing routes | LOW | No overlapping paths | Safe to add new endpoints |
| Validation (Zod) | LOW | Not currently used | Decide: adopt Zod or match existing style |
| `is_default` column | LOW | Prompt doesn't mention it | Must preserve — used in clinician registration |

---

## 8. Conclusion

The prompt needs **three critical corrections** before implementation:

1. **Authentication mismatch (CRITICAL)** — Must use existing custom JWT middleware (`authenticateUser`), not Supabase session tokens. This affects the `POST /api/institutions/bind` endpoint and any future protected routes.

2. **`user_profiles` table (HIGH)** — Must not be created. Replace all references with the existing `users` table (for `institution_id`) and `clinician_profiles`/`patients` (for name fields).

3. **WhatsApp/MessageBird assumption (HIGH)** — Must be built from scratch. The prompt should state "create new integration" and include full setup: SDK installation, environment variables, phone number mapping, and outbound messaging.

With these corrections applied, the feature can be safely implemented as an additive layer on top of the existing codebase without breaking any current functionality.

---
---

# Implementation Report: Guardrail Compliance Migration

**Date:** February 11, 2026
**Engineer:** VeriHealth Engineering
**Scope:** Full codebase migration to align with the VeriHealth Dashboards Guardrail document — canonical role source moved from `public.users.role` to `public.user_profiles.role`

---

## 1. Executive Summary

The VeriHealth Dashboards Guardrail document specifies that `public.user_profiles.role` is the **single canonical source of truth** for user roles across all clients (dashboard, Median app, BLE integrations, WhatsApp). Prior to this migration, the codebase read roles from `public.users.role`, which contradicted the guardrail and risked role inconsistencies across client surfaces. This migration rewired every role read and write across the authentication middleware, login flow, registration endpoints, admin panel, and session management to use `user_profiles` exclusively.

**Status:** Complete. Zero `users.role` reads remain in the codebase.

---

## 2. Pre-Migration State (Before)

### Role Architecture

| Component | Role Source | Problem |
|-----------|------------|---------|
| `authenticateUser` middleware | `users.role` | Non-canonical source |
| Login endpoint | `users.role` | Non-canonical source |
| Registration (clinician) | `users` table insert with `role` field | Wrote role to wrong table |
| Registration (patient via admin) | `users` table insert with `role` field | Wrote role to wrong table |
| Admin: change user role | `users` table update | Wrote role to wrong table |
| Admin: bulk role change | `users` table update | Wrote role to wrong table |
| Admin: user listing | `users.role` join | Read from wrong table |
| Admin: user details | `users.role` | Read from wrong table |
| Session check | Did not exist | No guardrail-compliant session endpoint |

### Authentication Flow (Before)

```
1. Client sends email/password → POST /api/auth/login
2. Server calls supabase.auth.signInWithPassword()
3. Server reads role from users table ← WRONG SOURCE
4. Server signs custom JWT with { id, email, role, institutionId } ← STALE after role changes
5. Client uses custom JWT for all requests
```

### Database State

- `public.user_profiles` table EXISTS with columns: `user_id`, `role`, `institution_id`, `created_at`, `updated_at`
- `public.users` table had `role` and `institution_id` columns (redundant with `user_profiles`)
- Both tables contained role data, creating a dual-source-of-truth problem

---

## 3. Migration Changes (What Was Done)

### 3.1 Authentication Middleware — `server/middleware/auth.ts`

**Before:** Verified custom JWT via `jsonwebtoken` library, decoded role from JWT payload.

**After:** Switched to Supabase native token verification via `supabase.auth.getUser(token)`. Role is now fetched live from `user_profiles` on every authenticated request — never from a cached JWT payload.

```
New flow:
1. Extract Bearer token from Authorization header
2. Verify token via supabase.auth.getUser(token) — native Supabase verification
3. Query user_profiles for role + institution_id (canonical source)
4. Query users for email + approval_status (identity data only)
5. Attach to req.user: { id, email, role, institutionId, approvalStatus }
```

**Impact:** Role changes (by admin) take effect immediately on the user's next request — no stale JWT problem.

### 3.2 Login Endpoint — `POST /api/auth/login`

**Before:** Read role from `users.role` after authentication.

**After:**
- Reads role from `user_profiles.role` via `supabase.from('user_profiles').select('role').eq('user_id', ...)`
- Reads `approval_status` from `users` table (identity data — correct table)
- **Patient blocking:** If `user_profiles.role === 'patient'`, the login is rejected with HTTP 403 and message directing to `app.verihealth.com`
- Returns Supabase session tokens (access_token, refresh_token) instead of custom JWT

### 3.3 New Session Check Endpoint — `GET /api/session/check`

**Created per guardrail specification.** Returns the canonical session shape:

```json
{
  "ok": true,
  "userId": "uuid",
  "role": "clinician",
  "institutionId": "uuid | null"
}
```

- Protected by `authenticateUser` middleware (role comes from `user_profiles`)
- Used by all clients to verify session state and get current role
- Ensures consistent role reporting across dashboard, Median app, and future clients

### 3.4 Registration Endpoints — Dual Table Insert

**Clinician Registration (`POST /api/auth/register-clinician`):**

```
Step 1: supabase.auth.signUp() → creates auth.users row
Step 2: Insert into public.users → { id, email, approval_status: 'pending' }
Step 3: Insert into public.user_profiles → { user_id, role: 'clinician', institution_id }
Step 4: Insert into public.clinician_profiles → { user_id, full_name, license_number, ... }
```

**Cleanup on failure (cascading rollback):**
- If `clinician_profiles` insert fails → delete `user_profiles` → delete `users` → delete auth user
- If `user_profiles` insert fails → delete `users` → delete auth user
- If `users` insert fails → delete auth user

**Patient Registration (`POST /api/admin/users/create`):**

Same dual-insert pattern: `users` for identity, `user_profiles` for role/institution.

### 3.5 Admin Panel — Role Reads and Writes

All admin endpoints that read or write roles were migrated:

| Endpoint | Change |
|----------|--------|
| `GET /api/admin/users` | Joins `user_profiles` for role + institution_id instead of reading from `users` |
| `GET /api/admin/users/:id` | Fetches role from `user_profiles` |
| `PATCH /api/admin/users/:id` | Writes role changes to `user_profiles` via upsert |
| `POST /api/admin/users/bulk-action` | Bulk role changes write to `user_profiles` via upsert |
| `GET /api/admin/analytics` | Queries `user_profiles` for role distribution stats |
| `GET /api/admin/invites` (accept) | Creates `user_profiles` row with invited role |
| `POST /api/admin/users/create` | Creates `user_profiles` row alongside `users` row |
| `GET /api/admin/users/export` | Joins `user_profiles` for role data in CSV export |

### 3.6 TypeScript Type Cleanup — `server/supabase.ts`

**Before:** `users` type definition included `role` and `institution_id` fields.

**After:** Removed `role` and `institution_id` from `users` Row and Insert types. The `users` type now reflects its actual purpose — identity data only:

```typescript
users: {
  Row: {
    id: string;
    email: string;
    approval_status: 'pending' | 'approved' | 'rejected' | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    email: string;
    approval_status?: 'pending' | 'approved' | 'rejected' | null;
    created_at?: string;
  };
};
```

**`user_profiles` type added:**

```typescript
user_profiles: {
  Row: {
    user_id: string;
    role: 'patient' | 'clinician' | 'admin' | 'institution_admin';
    institution_id: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    user_id: string;
    role: 'patient' | 'clinician' | 'admin' | 'institution_admin';
    institution_id?: string | null;
    created_at?: string;
    updated_at?: string;
  };
};
```

### 3.7 Dead Code Removal

- Removed unused `import jwt from 'jsonwebtoken'` from `server/routes.ts`
- The `jsonwebtoken` library is no longer used for token signing or verification

---

## 4. Post-Migration Verification

### 4.1 Codebase Grep Results

| Pattern | Matches | Status |
|---------|---------|--------|
| `from('user_profiles')` in routes.ts | 16 occurrences | All role reads use canonical source |
| `from('users')` in routes.ts | 19 occurrences | All for identity data (email, approval_status) only |
| `users.role` or `users.institution_id` in routes.ts | 0 occurrences | Zero non-canonical role reads |
| `user_profiles` in middleware/auth.ts | 1 occurrence | Auth middleware uses canonical source |
| `jsonwebtoken` imports | 0 occurrences | Dead dependency removed |

### 4.2 Table Responsibility Matrix (After Migration)

| Table | Purpose | Fields Used |
|-------|---------|-------------|
| `auth.users` | Supabase Auth identity | email, password (managed by Supabase) |
| `public.users` | Application identity | id, email, approval_status, created_at |
| `public.user_profiles` | Role + institution assignment (CANONICAL) | user_id, role, institution_id |
| `public.clinician_profiles` | Clinician-specific data | full_name, license_number, specialty, phone |
| `public.patients` | Patient-specific data | name, age, gender, assigned_clinician_id |

### 4.3 Authentication Flow (After Migration)

```
Login:
1. Client → POST /api/auth/login (email, password)
2. Server → supabase.auth.signInWithPassword()
3. Server → user_profiles.role check (CANONICAL)
4. If patient → 403 "Use app.verihealth.com"
5. If clinician + not approved → 403 "Pending approval"
6. Return Supabase session tokens (access_token, refresh_token)

Every Authenticated Request:
1. Client sends Bearer <supabase_access_token>
2. authenticateUser middleware → supabase.auth.getUser(token)
3. Middleware → user_profiles for live role (never cached/stale)
4. req.user = { id, email, role, institutionId, approvalStatus }
```

---

## 5. Corrections to Feature Review Report (Section 3.6)

The original Feature Review Report (Section 3.6) described the authentication as "custom JWT issued by the server using `jsonwebtoken`." This was accurate at the time of writing but is now **outdated** due to this migration.

### Updated Authentication Architecture

| Aspect | Before (Report Section 3.6) | After (Current) |
|--------|------------------------------|------------------|
| Token type | Custom JWT via `jsonwebtoken` | Supabase native access token |
| Token verification | `jwt.verify()` with server secret | `supabase.auth.getUser(token)` |
| Role source in token | Embedded in JWT payload | Not in token — fetched live from `user_profiles` |
| Role staleness risk | HIGH — JWT cached stale role | NONE — live query on every request |
| Session endpoint | None | `GET /api/session/check` returns `{ok, userId, role, institutionId}` |
| Patient login | Allowed (role checked client-side) | Blocked server-side with 403 + redirect message |

### Updated Corrections for Feature Review Section 3.6

**Previous correction (now outdated):**
> "All new protected endpoints MUST use the existing `authenticateUser` middleware with custom JWT"

**Current correction:**
> All new protected endpoints MUST use the existing `authenticateUser` middleware, which verifies Supabase native tokens via `supabase.auth.getUser(token)` and reads role from `user_profiles`. Access user context via `req.user!.id`, `req.user!.role`, `req.user!.institutionId`. For role-based access control, use `requireRole('admin', 'clinician', ...)` middleware.

### Updated Risk Summary Row

| Area | Risk Level | Issue | Resolution |
|------|-----------|-------|------------|
| Authentication | ~~CRITICAL~~ RESOLVED | ~~Prompt uses Supabase tokens; codebase uses custom JWT~~ | Codebase now uses Supabase native tokens. `authenticateUser` middleware verifies via `supabase.auth.getUser()` and reads role from `user_profiles` |

---

## 6. Remaining Considerations

### 6.1 `user_profiles` Table Now EXISTS

The original Feature Review Report (Section 3.2) stated "`user_profiles` — DOES NOT EXIST (Must Not Be Created)." This section is now **outdated**:

- `public.user_profiles` EXISTS in the database with columns: `user_id`, `role`, `institution_id`, `created_at`, `updated_at`
- It is the **canonical role source** per the Guardrail document
- All codebase role reads and writes use this table
- The `users` table retains `id`, `email`, `approval_status`, `created_at` — identity data only

### 6.2 Database Column Cleanup (Future)

The `public.users` table in Supabase may still contain `role` and `institution_id` columns from before the migration. These columns are **no longer read or written** by any codebase path. A future cleanup migration should:

```sql
-- Only run after confirming zero application reads of these columns
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS institution_id;
```

**Risk:** LOW — no code references these columns. However, verify with a production data audit before dropping.

### 6.3 Missing `user_profiles` Row Handling

If a user exists in `auth.users` and `public.users` but lacks a `user_profiles` row, the `authenticateUser` middleware returns HTTP 403 "User profile not found." This is intentional — it prevents authentication without a canonical role assignment. New registration endpoints always create `user_profiles` rows.

**Edge case:** Pre-migration users who were created before `user_profiles` existed may lack rows. These users will be unable to authenticate until a `user_profiles` row is manually inserted for them.

### 6.4 Patient Role Blocking

Patients attempting to log in to `verihealth.com` (the clinician dashboard) receive:
- HTTP 403 status
- Message: "This portal is for clinicians and administrators only. Please use the VeriHealth app at app.verihealth.com to access your health dashboard."
- Response includes `isPatient: true` flag for client-side handling

---

## 7. Files Modified

| File | Changes |
|------|---------|
| `server/middleware/auth.ts` | Complete rewrite — Supabase native token verification, role from `user_profiles`, identity from `users` |
| `server/routes.ts` | 16 `user_profiles` queries added, login patient blocking, session check endpoint, registration dual-insert, admin panel role reads/writes migrated, dead `jwt` import removed |
| `server/supabase.ts` | Added `user_profiles` type definition, removed `role` and `institution_id` from `users` type |
| `replit.md` | Updated Authentication & Authorization section to reflect new architecture |

---

## 8. Conclusion

The guardrail compliance migration is complete. The VeriHealth dashboard codebase now:

1. Reads all roles from `public.user_profiles.role` (zero reads from `public.users.role`)
2. Uses Supabase native token verification (no custom JWT)
3. Fetches roles live on every request (no stale cached roles)
4. Provides a `GET /api/session/check` endpoint per guardrail specification
5. Blocks patient logins on the clinician dashboard with a clear redirect message
6. Creates `user_profiles` rows during registration with cascading cleanup on failure
7. Maintains clean TypeScript types reflecting the actual table responsibilities

The authentication architecture now aligns with the Guardrail document's requirement for a single canonical role source that is consistent across all client surfaces (dashboard, Median app, BLE, WhatsApp).
