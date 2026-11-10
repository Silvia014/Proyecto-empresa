# Brasaland Hostinger API

This is the standalone Node.js service used by `https://api.brasaland.site`.
The public website at `https://brasaland.site` is static and cannot execute the
repository's Vercel `/api/*` functions by itself.

## Deploy

Deploy this directory as the existing Hostinger Node.js application for
`api.brasaland.site`, with `server.js` as its entry file and Node.js 22 or newer.
The deployment replaces the API application's current files, so retain a backup
of the current Hostinger deployment before replacing it.

The service needs these variables in Hostinger's Node.js environment:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `GOOGLE_GEOCODING_API_KEY`
- `OPENAI_API_KEY`

Keep the existing values in Hostinger; do not add them to this folder or commit
them. `DATABASE_URL` and `VERCEL_OIDC_TOKEN` are not read by this Node service.

## Restaurant locations

The API reads real restaurant rows from Supabase `Location`. The production
database must contain one row per supported city: Bogotá, Cali, Medellín, Miami,
and Orlando. Apply the repository migration
`supabase/migrations/20261109203931_add_cali_and_brasapoints_usd_rules.sql` to
add Cali before expecting all five rows. The API returns a delivery fee for each
location and validates deliveries within 5 km.

## Local smoke check

From this directory, run `npm install` and `npm start`. The health endpoint is
`GET /api/health`; ordering locations are `GET /api/ordering`. Never use real
production credentials in a committed `.env` file.
