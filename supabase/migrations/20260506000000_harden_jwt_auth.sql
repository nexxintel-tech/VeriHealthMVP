-- Harden local JWT auth storage.
-- Keep the legacy raw invite token column nullable so existing databases can migrate safely.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash text,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

ALTER TABLE public.user_invites
  ADD COLUMN IF NOT EXISTS token_hash text;

UPDATE public.user_invites
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL
  AND token IS NOT NULL;

ALTER TABLE public.user_invites
  ALTER COLUMN token DROP NOT NULL,
  ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_invites_token_hash_key
  ON public.user_invites(token_hash);

CREATE INDEX IF NOT EXISTS users_password_reset_token_hash_idx
  ON public.users(password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;
