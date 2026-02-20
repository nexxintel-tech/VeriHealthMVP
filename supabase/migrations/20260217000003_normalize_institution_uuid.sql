-- Normalize institution identifiers to UUID and align tenant-scoped foreign keys.
-- This migration safely stages a UUID primary key for institutions and swaps it into place.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Ensure institutions has a stable slug for deterministic platform lookup.
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS institutions_slug_unique_idx
  ON public.institutions (slug)
  WHERE slug IS NOT NULL;

-- 2) Stage UUID ids for institutions.
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS id_uuid uuid;

UPDATE public.institutions
SET id_uuid = CASE
  WHEN id_uuid IS NOT NULL THEN id_uuid
  WHEN id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN id::uuid
  ELSE gen_random_uuid()
END
WHERE id_uuid IS NULL;

ALTER TABLE public.institutions
  ALTER COLUMN id_uuid SET NOT NULL;

ALTER TABLE public.institutions
  ALTER COLUMN id_uuid SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS institutions_id_uuid_unique_idx
  ON public.institutions (id_uuid);

-- 3) Ensure platform default institution exists and is discoverable.
DO $$
DECLARE
  platform_id uuid;
BEGIN
  SELECT i.id_uuid
  INTO platform_id
  FROM public.institutions i
  WHERE i.slug = 'platform-default'
  LIMIT 1;

  IF platform_id IS NULL THEN
    SELECT i.id_uuid
    INTO platform_id
    FROM public.institutions i
    WHERE i.name = 'Platform Default Institution'
    ORDER BY i.created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF platform_id IS NULL THEN
    INSERT INTO public.institutions (id, id_uuid, slug, name, address, is_default)
    VALUES (
      gen_random_uuid()::text,
      gen_random_uuid(),
      'platform-default',
      'Platform Default Institution',
      'System managed default institution',
      false
    )
    RETURNING id_uuid INTO platform_id;
  ELSE
    UPDATE public.institutions
    SET slug = COALESCE(slug, 'platform-default')
    WHERE id_uuid = platform_id;
  END IF;
END $$;

-- 4) Drop existing foreign keys to institutions before type conversion/swap.
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT c.conname, c.conrelid::regclass AS table_name
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.institutions'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', fk.table_name, fk.conname);
  END LOOP;
END $$;

-- 5) Convert referencing columns to UUID where needed.
DO $$
DECLARE
  col_type text;
BEGIN
  -- users.institution_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'institution_id'
  ) THEN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'institution_id';

    IF col_type = 'uuid' THEN
      UPDATE public.users u
      SET institution_id = i.id_uuid
      FROM public.institutions i
      WHERE u.institution_id::text = i.id::text
        AND u.institution_id IS DISTINCT FROM i.id_uuid;
    ELSE
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS institution_id_uuid uuid;

      UPDATE public.users u
      SET institution_id_uuid = i.id_uuid
      FROM public.institutions i
      WHERE u.institution_id = i.id;

      UPDATE public.users
      SET institution_id_uuid = NULLIF(BTRIM(institution_id), '')::uuid
      WHERE institution_id_uuid IS NULL
        AND institution_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

      ALTER TABLE public.users DROP COLUMN institution_id;
      ALTER TABLE public.users RENAME COLUMN institution_id_uuid TO institution_id;
    END IF;
  END IF;

  -- patients.hospital_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'hospital_id'
  ) THEN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'hospital_id';

    IF col_type = 'uuid' THEN
      UPDATE public.patients p
      SET hospital_id = i.id_uuid
      FROM public.institutions i
      WHERE p.hospital_id::text = i.id::text
        AND p.hospital_id IS DISTINCT FROM i.id_uuid;
    ELSE
      ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS hospital_id_uuid uuid;

      UPDATE public.patients p
      SET hospital_id_uuid = i.id_uuid
      FROM public.institutions i
      WHERE p.hospital_id = i.id;

      UPDATE public.patients
      SET hospital_id_uuid = NULLIF(BTRIM(hospital_id), '')::uuid
      WHERE hospital_id_uuid IS NULL
        AND hospital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

      ALTER TABLE public.patients DROP COLUMN hospital_id;
      ALTER TABLE public.patients RENAME COLUMN hospital_id_uuid TO hospital_id;
    END IF;
  END IF;

  -- user_invites.institution_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_invites' AND column_name = 'institution_id'
  ) THEN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_invites' AND column_name = 'institution_id';

    IF col_type = 'uuid' THEN
      UPDATE public.user_invites ui
      SET institution_id = i.id_uuid
      FROM public.institutions i
      WHERE ui.institution_id::text = i.id::text
        AND ui.institution_id IS DISTINCT FROM i.id_uuid;
    ELSE
      ALTER TABLE public.user_invites ADD COLUMN IF NOT EXISTS institution_id_uuid uuid;

      UPDATE public.user_invites ui
      SET institution_id_uuid = i.id_uuid
      FROM public.institutions i
      WHERE ui.institution_id = i.id;

      UPDATE public.user_invites
      SET institution_id_uuid = NULLIF(BTRIM(institution_id), '')::uuid
      WHERE institution_id_uuid IS NULL
        AND institution_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

      ALTER TABLE public.user_invites DROP COLUMN institution_id;
      ALTER TABLE public.user_invites RENAME COLUMN institution_id_uuid TO institution_id;
    END IF;
  END IF;

  -- user_profiles.institution_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'institution_id'
  ) THEN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'institution_id';

    IF col_type = 'uuid' THEN
      UPDATE public.user_profiles up
      SET institution_id = i.id_uuid
      FROM public.institutions i
      WHERE up.institution_id::text = i.id::text
        AND up.institution_id IS DISTINCT FROM i.id_uuid;
    ELSE
      ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS institution_id_uuid uuid;

      UPDATE public.user_profiles up
      SET institution_id_uuid = i.id_uuid
      FROM public.institutions i
      WHERE up.institution_id = i.id;

      UPDATE public.user_profiles
      SET institution_id_uuid = NULLIF(BTRIM(institution_id), '')::uuid
      WHERE institution_id_uuid IS NULL
        AND institution_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

      ALTER TABLE public.user_profiles DROP COLUMN institution_id;
      ALTER TABLE public.user_profiles RENAME COLUMN institution_id_uuid TO institution_id;
    END IF;
  END IF;
END $$;

-- 6) Swap institutions.id to UUID primary key.
DO $$
DECLARE
  id_type text;
  has_id_legacy boolean;
BEGIN
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'institutions' AND column_name = 'id';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'institutions' AND column_name = 'id_legacy'
  ) INTO has_id_legacy;

  IF id_type <> 'uuid' THEN
    ALTER TABLE public.institutions DROP CONSTRAINT IF EXISTS institutions_pkey;

    IF NOT has_id_legacy THEN
      ALTER TABLE public.institutions RENAME COLUMN id TO id_legacy;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'institutions' AND column_name = 'id_uuid'
    ) THEN
      ALTER TABLE public.institutions RENAME COLUMN id_uuid TO id;
    END IF;

    ALTER TABLE public.institutions
      ALTER COLUMN id SET NOT NULL,
      ALTER COLUMN id SET DEFAULT gen_random_uuid();

    ALTER TABLE public.institutions
      ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);

    CREATE UNIQUE INDEX IF NOT EXISTS institutions_id_legacy_unique_idx
      ON public.institutions (id_legacy);
  END IF;
END $$;

-- 7) Recreate institution foreign keys with matching UUID types.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'institution_id' AND data_type = 'uuid'
  ) THEN
    UPDATE public.users u
    SET institution_id = NULL
    WHERE institution_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.institutions i WHERE i.id = u.institution_id
      );

    ALTER TABLE public.users
      DROP CONSTRAINT IF EXISTS users_institution_id_fkey;
    ALTER TABLE public.users
      ADD CONSTRAINT users_institution_id_fkey
      FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'institution_id' AND data_type = 'uuid'
  ) THEN
    UPDATE public.user_profiles up
    SET institution_id = NULL
    WHERE institution_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.institutions i WHERE i.id = up.institution_id
      );

    ALTER TABLE public.user_profiles
      DROP CONSTRAINT IF EXISTS user_profiles_institution_id_fkey;
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_institution_id_fkey
      FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'hospital_id' AND data_type = 'uuid'
  ) THEN
    UPDATE public.patients p
    SET hospital_id = NULL
    WHERE hospital_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.institutions i WHERE i.id = p.hospital_id
      );

    ALTER TABLE public.patients
      DROP CONSTRAINT IF EXISTS patients_hospital_id_fkey;
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_hospital_id_fkey
      FOREIGN KEY (hospital_id) REFERENCES public.institutions(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_invites' AND column_name = 'institution_id' AND data_type = 'uuid'
  ) THEN
    UPDATE public.user_invites ui
    SET institution_id = NULL
    WHERE institution_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.institutions i WHERE i.id = ui.institution_id
      );

    ALTER TABLE public.user_invites
      DROP CONSTRAINT IF EXISTS user_invites_institution_id_fkey;
    ALTER TABLE public.user_invites
      ADD CONSTRAINT user_invites_institution_id_fkey
      FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8) Tenant role backfill + guardrail check.
DO $$
DECLARE
  platform_institution_id uuid;
BEGIN
  SELECT i.id
  INTO platform_institution_id
  FROM public.institutions i
  WHERE i.slug = 'platform-default'
  LIMIT 1;

  IF platform_institution_id IS NULL THEN
    INSERT INTO public.institutions (id, slug, name, address, is_default)
    VALUES (
      gen_random_uuid(),
      'platform-default',
      'Platform Default Institution',
      'System managed default institution',
      false
    )
    RETURNING id INTO platform_institution_id;
  END IF;

  UPDATE public.user_profiles
  SET institution_id = platform_institution_id,
      updated_at = NOW()
  WHERE role IN ('clinician', 'institution_admin')
    AND institution_id IS NULL;
END $$;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_requires_institution_chk;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_requires_institution_chk
  CHECK (
    role NOT IN ('clinician', 'institution_admin')
    OR institution_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_user_profiles_institution_id
  ON public.user_profiles (institution_id);

CREATE INDEX IF NOT EXISTS idx_users_institution_id
  ON public.users (institution_id);

CREATE INDEX IF NOT EXISTS idx_patients_hospital_id
  ON public.patients (hospital_id);

CREATE INDEX IF NOT EXISTS idx_user_invites_institution_id
  ON public.user_invites (institution_id);
