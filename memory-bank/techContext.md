# Technical Context — BRASALAND

## Current Architecture

The project currently contains a customer-facing restaurant website together
with backend/API functionality.

The existing application includes static HTML, CSS and JavaScript files and
Vercel serverless API functions.

The project is being progressively evolved toward a monorepo architecture
with separate:

- Public website
- Internal/backoffice applications
- Backend services

## Frontend

Current technologies include:

- HTML
- CSS
- JavaScript
- Tailwind CSS in parts of the project
- Next.js in project-related applications where applicable

The existing public website contains pages and functionality for:

- Homepage
- Reservations
- Online ordering
- Checkout
- Customer accounts
- Recruitment/candidates
- Other restaurant-related pages

## Backend

Backend functionality currently includes Vercel serverless functions under:

`api/`

Examples include functionality for:

- Reservations
- Customer accounts
- AI chat

The backend must keep sensitive credentials server-side.

## Database

Supabase is used as the project's backend database and authentication
platform.

The database is PostgreSQL-based.

Current/planned business entities include:

- Reservations
- Orders
- Order items
- Clients
- Brasaclub members
- Candidates
- Staff/users

## Authentication

Customer authentication uses Supabase authentication through the existing
account functionality.

Internal staff functionality should eventually use authenticated staff
access with appropriate role/permission controls.

## AI Assistant

The public website includes an AI assistant.

The browser communicates with the backend through:

`/api/chat`

The backend communicates with the OpenAI API.

The OpenAI API key must remain in server-side environment variables and must
never be exposed in frontend JavaScript.

## Environment Variables

Sensitive configuration must be stored through environment variables.

Examples include:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Secrets must never be committed to Git.

## Deployment

The project currently uses Vercel for deployment.

Changes to routing, file locations or API locations can affect deployment
behaviour and must therefore be tested carefully.

## Current Architectural Constraint

The existing application is already functional.

Architectural migration must therefore be incremental.

Do not perform a large-scale move of frontend files, API files or deployment
configuration without first checking the consequences for:

- Relative paths
- JavaScript imports
- CSS references
- API URLs
- Vercel routing
- Environment variables
- Existing deployment configuration

## Target Architecture

The project is expected to progressively move toward a structure similar to:

```text
/
├── memory-bank/
├── .agents/
├── AGENTS.md
├── uis/
│   ├── website/
│   └── backoffice/
└── services/