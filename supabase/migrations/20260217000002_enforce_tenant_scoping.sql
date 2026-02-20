-- Enforce tenant scoping for institution-bound roles.
-- This migration stores and uses a UUID platform institution id for backfills.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  platform_institution_id uuid;
  has_slug boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'institutions'
      AND column_name = 'slug'
  ) INTO has_slug;

  IF has_slug THEN
    SELECT CASE
      WHEN i.id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN i.id::text::uuid
      ELSE NULL
    END
    INTO platform_institution_id
    FROM public.institutions i
    WHERE i.slug = 'platform-default'
    LIMIT 1;
  END IF;

  IF platform_institution_id IS NULL THEN
    SELECT CASE
      WHEN i.id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN i.id::text::uuid
      ELSE NULL
    END
    INTO platform_institution_id
    FROM public.institutions i
    WHERE i.name = 'Platform Default Institution'
    ORDER BY i.created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF platform_institution_id IS NULL THEN
    IF has_slug THEN
      INSERT INTO public.institutions (id, name, address, is_default, slug)
      VALUES (
        gen_random_uuid(),
        'Platform Default Institution',
        'System managed default institution',
        false,
        'platform-default'
      )
      RETURNING id::uuid INTO platform_institution_id;
    ELSE
      INSERT INTO public.institutions (id, name, address, is_default)
      VALUES (
        gen_random_uuid(),
        'Platform Default Institution',
        'System managed default institution',
        false
      )
      RETURNING id::uuid INTO platform_institution_id;
    END IF;
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
