# Railway Deployment

This file is for the dashboard app in the repository root. The `public-site` will be deployed separately later.

## Railway service

- Service type: `Service`
- Builder: `Railpack`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Healthcheck path: `/api/health`

Railway can use the repo-level `railway.toml` automatically. If it does not, set the config file path to `/railway.toml` in the service settings.

## Required environment variables

- `DATABASE_URL`
- `JWT_SECRET` - use a long random value; at least 32 bytes
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DASHBOARD_URL=https://app.verihealths.com`

## Optional environment variables

- `DATABASE_SSL_REJECT_UNAUTHORIZED=true`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ENABLE_EMAIL_CONFIRMATION=true`

If you do not set the `RESEND_*` values, email sending will not work outside Replit.

## Domain

After the first successful deploy:

1. In Railway, open the service.
2. Add the custom domain `app.verihealths.com`.
3. Copy the DNS record Railway gives you.
4. In Name.com, create the matching DNS record.
5. Wait for Railway to verify the domain and issue SSL.

## Notes

- The app listens on `process.env.PORT`, so Railway can inject its own port safely.
- The client build reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time.
- The server requires `DATABASE_URL` and `JWT_SECRET` at runtime.
- Before deploying the auth hardening changes, apply `supabase/migrations/20260506000000_harden_jwt_auth.sql` to the production database.
- If your database provider cannot validate TLS certificates, set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` explicitly.
