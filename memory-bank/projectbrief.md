# Project Brief — BRASALAND

## Project

BRASALAND is a restaurant and hospitality platform designed to manage the
customer-facing restaurant website together with internal business
operations.

The project provides a public website where customers can:

- Discover the restaurant.
- View the menu.
- Make reservations.
- Place online orders.
- Create and access an account.
- Participate in the Brasaland loyalty program / Brasaclub.
- Interact with an AI virtual assistant.

The project also includes functionality intended for internal staff,
including:

- Reservation management.
- Online order management.
- Customer management.
- Brasaclub / Brasapoints management.
- Recruitment and candidate management.

## Business Problem

The project aims to centralise the main digital interactions between
BRASALAND and its customers while reducing the need for staff to manage
reservations, orders, customers and recruitment through disconnected systems.

The platform should provide a clear separation between:

1. The public customer-facing website.
2. Internal staff/backoffice functionality.
3. Backend services and integrations.

## Main Objectives

### Customer-facing

- Provide a professional restaurant website.
- Allow customers to make reservations.
- Allow customers to place online orders.
- Provide customer accounts.
- Support Spanish and English.
- Provide a loyalty program based on Brasapoints.
- Provide an AI assistant.

### Internal operations

- Allow staff to manage reservations.
- Allow staff to manage online orders.
- Maintain customer records.
- Manage Brasaclub members and Brasapoints.
- Provide access to recruitment/candidate management.

### Technical

- Maintain a clear separation between frontend applications and backend
  services.
- Keep sensitive credentials on the server side.
- Use Supabase for backend data and authentication where appropriate.
- Deploy the application using the project's existing deployment
  infrastructure.
- Avoid breaking currently working functionality during architectural
  changes.

## Current Business Areas

The project currently contains functionality related to:

- Restaurant website
- Reservations
- Online ordering
- Customer accounts
- Brasaclub / Brasapoints
- CRM
- Recruitment / candidates
- AI assistant
- Analytics and business intelligence

## Important Principle

Existing working functionality must be preserved during architectural
refactoring.

Changes to the project structure should be incremental and verified before
moving to the next part of the migration.