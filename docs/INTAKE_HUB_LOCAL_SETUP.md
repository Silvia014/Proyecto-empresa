# Intake hub local setup

This branch connects the public website to the existing Supabase ERP tables and
the staff app's `/dashboard/brasapuntos` page. The intake and online-order notes
migrations have been applied to the configured Supabase development project.
No application was deployed.

## Database

The applied migration is `supabase/migrations/20261103191628_customer_intake_hub_20261103000000.sql`.
It adds the customer-to-auth link, reservation and candidate tables, the
server-only customer/membership RPC, and a private `candidate-cvs` bucket. It
expects the existing Prisma tables `public."Customer"` and
`public."BrasapointsAccount"` to be present. A separate local Supabase instance
must receive the same migration before it can handle intake.

## Public website API

The ignored root `.env.local` must contain `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` for the Vercel API functions. The API helper also reads
these keys from the root `.env.local` if Vercel Dev did not load them into its
environment. Restart `npx vercel dev` after editing that file. The reservation
form sends to `/api/reservas`; candidate applications send metadata and a CV (PDF, DOC,
or DOCX, maximum 3 MB) to `/api/candidate`; Brasaclub registration creates a
customer record and a zero-balance Brasapoints account. A reservation guest is
matched to that customer by normalized email when they later register.

## Staff app

From `uis/talent-pipeline-tracker`, copy `.env.example` to `.env.local`. Set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the
staff app, then set `SUPABASE_URL` and the server-only
`SUPABASE_SERVICE_ROLE_KEY`. Set `CRM_STAFF_USER_IDS` to a comma-separated list
of approved staff Auth user UUIDs (copy the UUID from Supabase Authentication
→ Users). The intake route verifies the bearer token and checks that allowlist
before reading records or signing a temporary CV download URL. Never prefix the
service-role key with `NEXT_PUBLIC_`.

Run the public site with `npx vercel dev` from the repository root. In a second
terminal, install dependencies in `uis/talent-pipeline-tracker` with `npm ci`,
then run `npm run dev -- --port 3001` from that app directory. The ERP dashboard
opens at `http://localhost:3001/dashboard/brasapuntos`. Its sidebar has separate
`Online reservations` and `Job applications` pages, as well as the combined
Brasapuntos intake hub. Reservations are available at
`http://localhost:3001/dashboard/reservations`; applications and CV links at
`http://localhost:3001/dashboard/candidates`. The records refresh every 30
seconds. CVs remain in private storage and the dashboard issues staff-only
links that expire after five minutes.

## Online ordering

The `Order.customerNotes` column migration is
`supabase/migrations/20261103215511_online_order_customer_notes.sql` and is
already applied to the configured development project.

The account portal is rendered in root `account.html` after sign-in. Its
`/api/account` handler reads the signed-in customer's profile, Brasapoints
balance and transactions, online orders, and reservations. Phone and dining
preferences save to that customer's `Customer` row. Checkout can return a
member to their cart after sign-in; the authenticated account email is used to
associate the ERP order, and the order appears in the account history as soon
as the ERP saves it. Brasapoints accrual and redemption remain inactive until
the ERP has settlement-based earning and atomic redemption rules. Configure
location-specific USD and COP equivalents for the €100 earning threshold
before enabling accrual.

The public menu now reads locations and menu items from the ERP API. Set
`ORDERING_API_URL=http://127.0.0.1:8000/api` in the root `.env.local` for local
work. Run `npx vercel dev` in one terminal and `cd restaurant-platform && npm run dev`
in another. Vercel Dev does not start the ERP process. The ERP API listens on port 8000 by default. In `restaurant-platform`, configure its ignored `.env` with the rotated
development `DATABASE_URL`, generate the Prisma client, and run `npm run dev`
on port 8000. A separate local database needs the Prisma migration applied.
The database needs real Location and MenuItem rows;
the public page no longer supplies demo menu prices. In the deployment, set
`ORDERING_API_URL` to the deployed ERP API URL.

Delivery checkout validates the entered address against a 20 km straight-line
radius from the Bogotá and Orlando branch addresses using Google Geocoding API
v4. The Maps Demo Key supports this v4 endpoint with limited quotas. A standard
Google Maps Platform key requires the Geocoding API enabled and billing linked.
Keep the key on the server, restrict it to the Geocoding API, and set
`GOOGLE_GEOCODING_API_KEY` in the FastAPI environment (`.env.local` locally and
the backend deployment environment in production). Without a usable key,
delivery orders are rejected; pickup remains available.

The checkout creates an ERP Order and OrderItem with payment status `PENDING`.
It does not charge the customer or open Stripe. The pending page lets the
customer request cash, a payment link, or Bizum; the preference is stored in
`Order.paymentPreference` while the order stays pending until staff confirms it
and completes payment. Orders appear in the existing Brasapuntos intake hub and
in the signed-in customer's account history when the order email matches their
Brasaclub account.

After both local databases are configured and migrations are applied locally,
test reservation submission, account registration and history, CV submission,
order submission, and the staff hub refresh. Signup awards no welcome points.
