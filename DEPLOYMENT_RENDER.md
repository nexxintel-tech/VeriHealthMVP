# Render Deployment

This file is for the dashboard app in the repository root. The `public-site` will be deployed separately later.

## Render service

- Type: `Web Service`
- Runtime: `Node`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Health check path: `/api/health`

You can either:
- create the service in the Render dashboard manually using the values above, or
- connect the repo and let Render read `render.yaml`

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DASHBOARD_URL=https://app.verihealths.com`

## Optional environment variables

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ENABLE_EMAIL_CONFIRMATION=true`

If you do not set the `RESEND_*` values, email sending will not work outside Replit.

## Domain

After the first successful deploy:

1. In Render, open the web service.
2. Add the custom domain `app.verihealths.com`.
3. Copy the DNS record Render gives you.
4. In Name.com, create the matching DNS record.
5. Wait for Render to verify the domain and issue SSL.

## Notes

- The app listens on `process.env.PORT`, so Render can inject its own port safely.
- The client build reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time.
- The server requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` at runtime.
