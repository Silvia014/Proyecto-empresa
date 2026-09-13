# Development Progress — BRASALAND

## Current Status

The BRASALAND project has several working customer-facing features and is
being prepared for a more structured monorepo architecture.

## Working Functionality

The following areas have been implemented or substantially developed:

- Public restaurant website.
- Customer account registration.
- Customer login.
- Password reset flow.
- Restaurant reservation frontend.
- Online ordering frontend.
- Shopping cart.
- Cart persistence using localStorage.
- Checkout frontend.
- AI assistant frontend/backend integration.
- Recruitment/candidate pages.
- Supabase integration.
- Vercel deployment.

## Reservations

The reservation frontend collects customer and reservation information,
including:

- Name
- Surname
- Email
- Phone
- Country
- City
- Number of people
- Date
- Time
- Location
- Preferences
- How the customer heard about BRASALAND

The reservation frontend currently has working form/confirmation behaviour.

Backend persistence and CRM integration still need to be completed or
verified against the current Supabase schema.

## Online Orders

The online ordering frontend includes:

- Menu products
- Shopping cart
- Quantity changes
- Item removal
- Clear-cart functionality
- Checkout
- Customer information
- Pickup/delivery selection
- Delivery address
- Order notes
- Order confirmation

The cart is persisted using:

`localStorage`

with the cart key:

`brasalandCart`

Backend order persistence still needs to be connected and verified.

## Customer Accounts

Customer registration and login functionality is implemented using the
existing backend/Supabase authentication flow.

Password reset functionality has also been implemented.

Sensitive Supabase service-role credentials remain server-side.

## AI Assistant

The AI assistant communicates through:

`/api/chat`

The backend uses the OpenAI API.

The endpoint and integration are working at the application level.

Current limitation:

OpenAI API usage requires available API credits/billing.

## CRM

A staff-only CRM/backoffice is planned.

The intended areas are:

- Dashboard
- Reservations
- Online Orders
- Clients / Brasaclub
- Candidates

The CRM should eventually provide staff-only access and management of these
business areas.

## Recruitment

Existing candidate-related pages include:

- `candidates.html`
- `candidate-detail.html`
- `candidate-new.html`

These should eventually be accessible through the internal/backoffice
application.

## Monorepo Migration

The project is being prepared for migration toward the approved monorepo
structure.

The migration must be incremental.

Do not move the existing public website or API directories until the target
monorepo template has been inspected and the required routing/deployment
changes are understood.

## Immediate Next Steps

1. Create and review the agent infrastructure.
2. Create `AGENTS.md`.
3. Create `.agents/` development rules.
4. Create at least one reusable agent skill.
5. Inspect the approved monorepo template.
6. Compare the template with the existing project.
7. Plan the migration.
8. Implement the migration incrementally.
9. Test existing functionality after each significant change.
10. Create a pull request when the migration is ready for review.