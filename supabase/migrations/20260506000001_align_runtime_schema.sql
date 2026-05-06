-- Align older production databases with the current Drizzle runtime schema.
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_legacy text,
  slug text,
  name text NOT NULL,
  address text,
  contact_email text,
  contact_phone text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'patient',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS institution_id uuid,
  ADD COLUMN IF NOT EXISTS institution_uuid varchar,
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS auth_user_id varchar,
  ADD COLUMN IF NOT EXISTS email_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash text,
  ADD COLUMN IF NOT EXISTS health_data_consent boolean,
  ADD COLUMN IF NOT EXISTS female_health_consent boolean,
  ADD COLUMN IF NOT EXISTS password_reset_expires timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id varchar PRIMARY KEY,
  role text NOT NULL DEFAULT 'patient',
  institution_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patients (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS height_cm real,
  ADD COLUMN IF NOT EXISTS weight_kg real,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS assigned_clinician_id varchar,
  ADD COLUMN IF NOT EXISTS hospital_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.patients ALTER COLUMN name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'age'
  ) THEN
    ALTER TABLE public.patients ALTER COLUMN age DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'gender'
  ) THEN
    ALTER TABLE public.patients ALTER COLUMN gender DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.patients ALTER COLUMN status DROP NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.clinician_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL UNIQUE,
  full_name text NOT NULL,
  license_number text,
  specialty text,
  phone text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id varchar,
  details text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_invites (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'patient',
  institution_id uuid,
  invited_by_id varchar,
  token text,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_dependents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sponsor_user_id varchar,
  dependent_patient_id varchar,
  status text NOT NULL DEFAULT 'pending',
  relationship text,
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.file_attachments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id varchar,
  uploaded_by_user_id varchar,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  file_data text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conditions (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medications (
  id serial PRIMARY KEY,
  patient_id varchar NOT NULL,
  name text NOT NULL,
  dosage text,
  frequency text,
  prescribed_by text,
  start_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  type text NOT NULL,
  value numeric,
  unit text NOT NULL,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  start_at timestamptz,
  end_at timestamptz,
  external_id text,
  value_json jsonb
);

CREATE TABLE IF NOT EXISTS public.risk_scores (
  id serial PRIMARY KEY,
  user_id varchar,
  condition_id integer,
  score decimal,
  level text NOT NULL DEFAULT 'low',
  explanation text,
  generated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id serial PRIMARY KEY,
  user_id varchar,
  condition_id integer,
  alert_type text NOT NULL,
  severity text,
  message text NOT NULL,
  triggered_at timestamptz DEFAULT now(),
  is_resolved boolean NOT NULL DEFAULT false,
  responded_by_id varchar,
  responded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_institution_id ON public.user_profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_id ON public.patients(hospital_id);
CREATE INDEX IF NOT EXISTS idx_patients_assigned_clinician_id ON public.patients(assigned_clinician_id);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash ON public.users(password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;
