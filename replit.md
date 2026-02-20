# VeriHealth - Clinical Remote Monitoring Platform

## Overview

VeriHealth is a cross-platform medical remote monitoring system designed to collect health data from iOS (HealthKit) and Android (Health Connect) devices, sync it to a cloud database in real-time, and provide clinicians with AI-powered risk insights through a comprehensive dashboard. The system supports continuous monitoring of 16+ medical conditions using vitals and behavioral metrics, with automated alerts and notifications.

The current implementation is a **web-based clinician dashboard** built with React, Express, and Supabase. The mobile apps (iOS Swift + HealthKit, Android Kotlin + Health Connect) are planned but not yet implemented in this codebase.

## User Preferences

Preferred communication style: Simple, everyday language.

## Project Structure

The VeriHealth platform consists of two separate web applications:

1. **Clinician Dashboard** (`/client`, `/server`) - Authenticated portal for healthcare providers
2. **Public Website** (`/public-site`) - Marketing site for general visitors

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18+ with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for lightweight client-side routing (no React Router)
- Problem: Need fast development feedback and optimized production builds
- Solution: Vite provides instant HMR in development and optimized bundling for production
- Trade-offs: Vite requires ESM-compatible packages; some older libraries may need special handling

**UI Component System**
- shadcn/ui components built on Radix UI primitives
- Tailwind CSS v4 for styling with custom design tokens
- Problem: Need accessible, customizable UI components without building from scratch
- Solution: Radix UI provides unstyled, accessible primitives; Tailwind enables rapid styling
- Design system: Custom color palette for risk levels (low/medium/high), medical-specific theming

**State Management**
- TanStack Query (React Query) for server state management
- Problem: Need to handle async data fetching, caching, and real-time updates
- Solution: React Query provides automatic background refetching, cache invalidation, and optimistic updates
- Alternatives considered: Redux (too heavy), Context API (no caching)

**Data Visualization**
- Recharts for vital signs charts and trends
- Custom dashboard components for patient statistics and risk scores

### Backend Architecture

**Server Framework**
- Express.js with TypeScript in ESM module format
- Problem: Need a lightweight, flexible Node.js server
- Solution: Express provides minimal overhead with extensive middleware ecosystem
- Development vs Production: Vite dev server proxies API requests in dev; static file serving in production

**Database & ORM**
- Supabase (PostgreSQL) for primary data storage
- Drizzle ORM for type-safe database queries and migrations
- Problem: Need real-time capabilities, authentication, and relational data modeling
- Solution: Supabase provides managed PostgreSQL with real-time subscriptions and auth
- Schema: Users, Patients, Conditions, HealthReadings, RiskScores, Alerts tables

**API Design**
- RESTful API endpoints under `/api` prefix
- Routes handle patient lists, individual patient details, vital readings, and alerts
- `POST /api/vitals/ingest` - Authenticated endpoint for patients to submit vital readings (manual or from mobile app)
  - Accepts `{ readings: [{ type, value, recorded_at?, source? }] }` with batch limit of 100
  - Valid types: Heart Rate, Blood Pressure Systolic/Diastolic, SpO2, Temperature, Weight, Steps, Sleep, HRV, Respiratory Rate, Blood Glucose, BMI
  - Validates types against whitelist, numeric values, derives user_id from auth token (no impersonation)
  - Stores to Supabase `health_readings` table with source default "manual"
- Response format: JSON with proper HTTP status codes
- Error handling: Centralized error logging with detailed error responses
- Database: All operations use Supabase client directly (no Drizzle ORM queries, no Replit built-in DB)
- `shared/schema.ts` uses Drizzle ORM + drizzle-zod for TypeScript type definitions only (not for DB queries)

**Real-time Updates**
- Polling-based approach (30-second intervals) as fallback
- Designed for Supabase Realtime subscriptions (not yet fully implemented)
- Problem: Clinicians need near real-time patient data updates
- Solution: React Query cache invalidation on intervals; future upgrade to WebSocket-based Supabase Realtime

### Authentication & Authorization

**Authentication System**
- Supabase Auth for user management with email/password
- Email confirmation workflow (currently disabled pending domain verification)
- Password reset via secure token system
- Role-based access: patient, clinician, admin, institution_admin
- Supabase native token verification (NOT custom JWT) via `supabase.auth.getUser(token)`
- Google OAuth sign-in via Supabase Auth (requires Google provider enabled in Supabase dashboard)
  - Frontend uses `@supabase/supabase-js` client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - OAuth callback handled at `/auth/callback` route
  - Backend `/api/auth/google-callback` auto-creates user records for new Google users (default: patient role)
  - Google sign-in available on Login and Register pages
- Canonical role source: `public.user_profiles.role` (per Guardrail document)
- The `users` table stores identity data (email, approval_status) only — NOT roles
- `/api/session/check` endpoint returns `{ok, userId, role, institutionId}` from `user_profiles`
- Patient role blocked from verihealth.com dashboard login (redirected to app.verihealths.com)
- Rate limiting: All auth endpoints (login, register, verify-invite, logout, forgot-password, reset-password, resend-confirmation) rate limited to 10 requests per 15 minutes per IP
- `requireApproved` middleware enforced on all clinician-accessible endpoints (patients, vitals, alerts, dashboard, claim, top-performers)
- Client-side role enforcement: Admin pages use `allowedRoles` on ProtectedRoute; unauthorized roles redirect to dashboard (not logout)
- Problem: Need secure, healthcare-compliant user authentication with consistent role source across all clients
- Solution: Supabase Auth provides HIPAA-eligible authentication; `user_profiles` ensures single role source for dashboard, Median app, BLE, and WhatsApp clients

**Security Hardening (Applied Feb 2026)**
- HTML sanitization in admin email feature (prevents XSS via email content)
- CSV export: double-quote escaping to prevent formula injection
- ES module `crypto` import (replaced inline `require('crypto')`)
- Age validation: rejects 0, NaN, strings, negative, >150 in registration and complete-profile
- Atomic patient record creation during registration (fails entire registration if patient creation fails)
- Institution admin patient visibility: sees all patients in their institution (not just assigned)
- Invite system: frontend reads `?invite={token}`, verifies via `/api/auth/verify-invite`, locks email field
- Resend-confirmation: targeted user lookup instead of `listUsers()` to avoid loading all users
- Top performers query: bounded with `.limit(1000)` to prevent unbounded results

**Patient-Clinician Matching System**
- Patients who register without an invite link are auto-assigned to the default institution with `assigned_clinician_id = null`
- Registration accepts optional `fullName`, `age`, `gender`, `institutionCode` fields
- Patients who register without profile info can complete it later via `POST /api/patient/complete-profile`
- `GET /api/patients/unassigned` returns patients awaiting clinician assignment (institution-scoped)
- `POST /api/patients/:id/claim` allows clinicians to claim unassigned patients (atomic, race-condition-safe)
- Dashboard shows "Patients Awaiting Clinician" widget and "Awaiting Clinician" stat card
- Institution boundary enforced: clinicians can only see/claim patients within their institution

**Email Confirmation System (Disabled - Pending Domain Setup)**
- Registration flow sends confirmation email via Resend API
- Login blocks unconfirmed users with option to resend confirmation email
- Password reset sends secure token links
- Status: Fully implemented but disabled (`ENABLE_EMAIL_CONFIRMATION=false`)
- Reason: Resend requires verified domain before sending to external addresses
- Next steps: Acquire custom domain, verify in Resend dashboard, set `ENABLE_EMAIL_CONFIRMATION=true`

### Admin Panel (System Admin Only)

**User Management**
- Full user listing with search and role-based filtering
- Enable/disable user accounts (Supabase Auth ban/unban)
- Role assignment with institution linking for clinicians/institution admins
- Bulk actions: select multiple users for batch operations
- User details view: profile, institution, last sign-in, patient count
- Send email to individual users via Resend
- Export all users to CSV

**Institution Management**
- CRUD operations for healthcare institutions
- Set default institution for new registrations
- Validation prevents deletion of institutions with assigned users

**User Invites**
- Token-based invitation system with pre-assigned roles
- Email delivery of invite links
- 7-day expiration with status tracking
- Invite management (view pending, cancel)

**Activity Logging**
- Comprehensive audit trail of all admin actions
- Tracks: user, action, target type, target ID, details, IP address, timestamp
- Paginated log viewer with action/target filtering

**Analytics Dashboard**
- User distribution pie chart (by role)
- User growth over time bar chart
- Daily activity line chart
- Summary statistics: total users, role counts, institution count

### Design Patterns

**Separation of Concerns**
- `client/`: All frontend code (React components, pages, hooks, styles)
- `server/`: Backend API routes and application logic
- `shared/`: Shared types and database schema (Drizzle)
- Problem: Avoid code duplication and maintain consistency between frontend and backend
- Solution: Shared TypeScript definitions ensure type safety across the stack

**Development vs Production**
- Development: `server/index-dev.ts` with Vite middleware for HMR
- Production: `server/index-prod.ts` serves pre-built static assets from `dist/public`
- Build process: `vite build` compiles frontend; `esbuild` bundles backend into single file

## External Dependencies

### Third-Party Services

**Supabase**
- Purpose: Managed PostgreSQL database, authentication, and real-time subscriptions
- Integration: `@supabase/supabase-js` client library
- Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Critical for: All persistent data storage, user authentication, real-time features

**Resend**
- Purpose: Transactional email delivery (confirmation emails, password resets)
- Integration: `resend` npm package via Replit connector
- Environment variables: `RESEND_API_KEY` (auto-managed by Replit)
- Status: Fully integrated but disabled pending custom domain verification
- Current domain: `ustoufaleo.resend.app` (test domain, can't send to external addresses)
- Email templates: Professional HTML templates in `server/email.ts`

**MessageBird (Planned)**
- Purpose: SMS/voice alerts and notifications to clinicians
- Status: Not yet implemented in codebase
- Future use: Send critical alerts when patient risk scores exceed thresholds

### Mobile Platform SDKs (Planned)

**iOS HealthKit**
- Purpose: Collect health data (HR, HRV, BP, SpO2, Sleep, Steps, etc.) from Apple devices
- Status: Not implemented; requires native Swift app
- Architecture: Background delivery, local queue for offline sync, push to Supabase

**Android Health Connect**
- Purpose: Collect same health metrics from Android devices
- Status: Not implemented; requires native Kotlin app
- Architecture: Permission model, background sync, offline-first queue

### Development Tools

**Replit-Specific Plugins**
- `@replit/vite-plugin-runtime-error-modal`: Development error overlay
- `@replit/vite-plugin-cartographer`: Code navigation helper
- `@replit/vite-plugin-dev-banner`: Development environment banner
- Custom `vite-plugin-meta-images`: Automatically updates OpenGraph images for Replit deployments

### Key Libraries

**UI & Styling**
- `@radix-ui/*`: 20+ component primitives (dialogs, dropdowns, tooltips, etc.)
- `tailwindcss`: Utility-first CSS framework
- `class-variance-authority`: Type-safe component variants
- `lucide-react`: Icon library

**Data & Forms**
- `react-hook-form`: Form state management
- `@hookform/resolvers` + `zod`: Form validation
- `date-fns`: Date manipulation and formatting

**Charts & Visualization**
- `recharts`: Declarative charting library for vital signs visualization

**Database**
- `drizzle-orm`: TypeScript ORM for PostgreSQL
- `drizzle-zod`: Generate Zod schemas from Drizzle tables
- `connect-pg-simple`: PostgreSQL session store (for future session management)
