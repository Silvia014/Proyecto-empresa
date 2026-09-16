Backend Architecture Proposal

Project: Brasaland — Corporate and Operations Platform
Document: ARCHITECTURE_PROPOSAL.md
Status: Initial proposal 
Date: 2026-09-16

1. Objective

This document defines an initial proposal for structuring the Brasaland backend before development of new endpoints begins.

The proposal is based on the characteristics already identified in the project: a public website for customers, reservation and ordering flows, checkout, user accounts and password recovery, as well as internal functionality related to candidate management. The repository is a monorepo where the frontend and backend should be able to evolve independently while maintaining clear communication contracts.

The main objectives are to: clearly separate business domains; avoid putting all business logic into a single file or router;

allow the backend to grow without becoming difficult to maintain;

allow different clients, such as the public website and an internal backoffice, to consume the same API;

make it possible to add new functionality without unnecessarily affecting existing domains.

2. Proposed Architectural Pattern

Decision

I propose using a modular monolith organized by business domains with internal layer separation. (one backend application, organizing its code into separate sections according to what each part of the business does)

I do not recommend starting with microservices. The system can initially be deployed and evolved as a single backend application while keeping its business domains clearly separated so that future growth does not result in an unstructured monolith.

Within each domain, responsibilities should be separated when necessary into:

API / routers: HTTP entry points and endpoint definitions.

Schemas: validation and representation of request and response data.

Services / use cases: business rules and application use cases.

Repositories: data access and persistence.

Models: representation of persisted entities.

Why this fits Brasaland

The application is not only an informational website. It contains several related but distinguishable business flows: customers who browse information and make reservations;customers who place orders and complete checkout;users who manage their accounts;internal operations that need to consult or manage information;recruitment and candidate-management processes;future functionality related to loyalty, inventory, and operations.

These flows share users, configuration, and data, so separating them into microservices immediately would introduce additional communication, deployment, and operational complexity before there is a clear business need.

A modular monolith provides one backend application while preventing reservations, orders, users, candidates, and other domains from becoming mixed together in the same files.

Why not choose microservices from the beginning?

Microservices could become appropriate if individual domains require independent deployment, significantly different scaling requirements, autonomous development teams, or stronger isolation requirements.

At the current stage, separating the domains prematurely would introduce additional concerns such as:

communication between services;distributed error handling;deployment and configuration of multiple services;service-to-service authentication;

distributed observability;data consistency across services.

Therefore, the initial proposal is to keep one backend application while preserving domain boundaries. If a particular domain later needs independent scaling or deployment, it can be evaluated for extraction into a separate service.

3. General Monorepo Structure

The frontend and backend should be treated as separate systems even though they live inside the same repository.

An initial structure could be:

/
├── docs/
│   └── ARCHITECTURE_PROPOSAL.md
│
├── services/
│   └── api/
│       ├── app/
│       │   ├── main.py
│       │   ├── core/
│       │   │   ├── config.py
│       │   │   ├── security.py
│       │   │   └── dependencies.py
│       │   │
│       │   ├── domains/
│       │   │   ├── auth/
│       │   │   ├── accounts/
│       │   │   ├── reservations/
│       │   │   ├── orders/
│       │   │   ├── catalog/
│       │   │   ├── candidates/
│       │   │   └── loyalty/
│       │   │
│       │   └── shared/
│       │       ├── errors/
│       │       └── utils/
│       │
│       ├── tests/
│       ├── .env.example
│       └── README.md
│
├── uis/
│   ├── website/
│   └── backoffice/
│
└── ...

The exact structure can be adapted to the current state of the monorepo. The main principle should remain: code belonging to the same business domain should stay close together, while technical responsibilities should remain separated.

4. Internal Structure of a Domain

For example, the reservations domain could evolve into:

domains/
└── reservations/
    ├── router.py
    ├── schemas.py
    ├── service.py
    ├── repository.py
    └── models.py

Not every domain needs every file from the first day. The goal is to avoid two extremes:putting the entire domain inside router.py;creating excessive fragmentation for functionality that is still very small.

The router should mainly handle HTTP concerns: receiving parameters, using dependencies, calling the appropriate use case, and returning a response.Business rules should not depend directly on FastAPI. This makes them easier to test and potentially reuse from other entry points.

5. Main Business Domains

5.1 Auth

Responsibilities:

authentication;

sessions or tokens;

password recovery;

identity and permission checks.

Example endpoints:

POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password

Authentication should remain separate from reservation, ordering, or catalog logic.

5.2 Accounts

Responsibilities:

customer profile;

account information;

preferences;

information associated with the user.

Example endpoints:

GET    /api/v1/accounts/me
PATCH  /api/v1/accounts/me
DELETE /api/v1/accounts/me

The user's identity belongs to auth, while functional profile information belongs to accounts.

5.3 Reservations

Responsibilities:

creating reservations;

checking availability;

modifying and cancelling reservations;

storing the information required to manage reservations.

Example endpoints:

GET    /api/v1/reservations
GET    /api/v1/reservations/{reservation_id}
POST   /api/v1/reservations
PATCH  /api/v1/reservations/{reservation_id}
DELETE /api/v1/reservations/{reservation_id}

Reservation-specific business rules should remain inside this domain and should not depend on frontend presentation details.

5.4 Orders

Responsibilities:

creating and retrieving orders;

order status;

order lines;

relationships between orders, customers, and locations;

coordination with checkout/payment when required.

Example endpoints:

GET  /api/v1/orders
GET  /api/v1/orders/{order_id}
POST /api/v1/orders
PATCH /api/v1/orders/{order_id}/status

Order status transitions should be explicitly defined so that invalid state changes are prevented.

5.5 Catalog

Responsibilities:

products or dishes;

categories;

product availability;

information required to build an order.

Example endpoints:

GET /api/v1/catalog
GET /api/v1/catalog/categories
GET /api/v1/catalog/items/{item_id}

Separating the catalog from orders prevents descriptive menu information from becoming mixed with transactional purchasing logic.

5.6 Candidates

The project already includes functionality related to candidate management.

Responsibilities:

receiving applications;

internal candidate queries;

updating application status;

information required for the recruitment process.

Example endpoints:

POST  /api/v1/candidates
GET   /api/v1/candidates
GET   /api/v1/candidates/{candidate_id}
PATCH /api/v1/candidates/{candidate_id}/status

Administrative routes should be protected through authorization dependencies and should not be exposed as equivalent public endpoints.

5.7 Loyalty

If loyalty functionality remains within the product scope, it should be treated as an independent domain.

Responsibilities:

points balance;

points transactions;

earning rules;

redemption.

Example endpoints:

GET  /api/v1/loyalty/balance
GET  /api/v1/loyalty/transactions
POST /api/v1/loyalty/redeem

Points logic should not be implemented directly inside orders or accounts, because the loyalty rules can evolve independently.

6. Router and Endpoint Organization

FastAPI provides APIRouter for splitting large applications into separate modules. The official documentation demonstrates a structure using main.py, dependencies, and independent routers that are later registered with include_router().

For this project, each business domain should have its own router rather than placing every endpoint in one file.

The general structure would be:

main.py
   │
   ├── auth.router
   ├── accounts.router
   ├── reservations.router
   ├── orders.router
   ├── catalog.router
   ├── candidates.router
   └── loyalty.router

Routes should be versioned from the beginning:

/api/v1/...

This allows future incompatible API changes without immediately breaking clients that still consume an earlier version.

OpenAPI tags should also correspond to business domains:

Auth
Accounts
Reservations
Orders
Catalog
Candidates
Loyalty

Reference: FastAPI documentation on bigger applications and APIRouter.

7. Frontend and Backend Separation

The frontend and backend are separate systems even though they are located in the same monorepo.

Frontend responsibilities

The frontend is responsible for: user interface;navigation;presentation state;forms;HTTP requests to the API.

Backend responsibilities

The backend is responsible for:business rules;authentication and authorization;data validation;persistence;transactional operations;external service integrations;

API responses.

Communication between them should take place through HTTP/JSON using the backend API.

The frontend should not access the database directly for operations that require business rules. Internal backend implementation details should also not become dependencies of the frontend.

8. CORS

Because the frontend and backend are separate applications, during development they may run on different origins, for example:

Frontend: http://localhost:3000
Backend:  http://localhost:8000

This requires CORS configuration on the backend.

In production, allowed origins should be explicit, for example:

https://www.brasaland.example
https://admin.brasaland.example

Using allow_origins=["*"] (meaning allow requests for any website or domain) should not be the default production configuration when credentials or authorization headers are involved.

FastAPI documents the use of CORSMiddleware and explicit origin configuration for cross-origin requests.

Reference: FastAPI documentation on CORS.

9. Environment Variables and Configuration

Secrets and environment-specific configuration should never be hard-coded into the source code.

The backend should distinguish at least:

.env              # local development, not committed
.env.example      # variable names without real secrets

Possible configuration variables include:

DATABASE_URL=
SUPABASE_URL=
SUPABASE_KEY=
JWT_SECRET=
CORS_ORIGINS=
API_BASE_URL=

Real production values should be managed through the deployment platform or a secure secrets-management mechanism.

FastAPI provides a configuration approach based on settings and environment variables for values such as database URLs and secret keys.

Reference: FastAPI documentation on Settings and Environment Variables.

10. Persistence and Data Access

The application already uses Supabase as part of its data infrastructure.

The proposed architecture avoids allowing routers to access the database directly.

The recommended flow is:

HTTP request
     ↓
Router
     ↓
Service / Use case
     ↓
Repository
     ↓
Database / Supabase

This creates a clear separation between HTTP handling, business logic, and persistence.

If the persistence mechanism changes later, the change can remain concentrated in the data-access layer instead of requiring every endpoint to be rewritten.

It also makes it easier to test business logic without requiring every unit test to depend on a real database.

11. Authentication and Authorization

Authentication should be treated as a cross-cutting concern. The backend should distinguish between:unauthenticated users;authenticated users;customer-level permissions;internal or administrative permissions.FastAPI dependencies can be used to centralize checks that need to be reused across multiple endpoints.

Conceptually:

request
  ↓
get_current_user
  ↓
check_permissions
  ↓
router

This avoids duplicating authentication and authorization logic in every endpoint.

FastAPI's dependency system is designed to support reusable dependencies for concerns such as authentication, authorization, and external resources.

12. Frontend–Backend Contract

The frontend should not depend on backend implementation details.

The API contract should define: HTTP method;route;parameters;request body;response body;error codes and structure;authentication requirements.

Example:

POST /api/v1/reservations

Request
{
  "date": "...",
  "time": "...",
  "guests": 2
}

Response
{
  "id": "...",
  "status": "confirmed"
}

FastAPI automatically generates OpenAPI documentation, so the API contract should be treated as part of the development process and kept synchronized with the implementation.

13. Example Request Flow

A reservation could follow this flow:

Customer
  ↓
Frontend
  ↓
POST /api/v1/reservations
  ↓
Reservation Router
  ↓
Reservation Service
  ↓
Reservation Repository
  ↓
Supabase / Database
  ↓
Service
  ↓
Router
  ↓
JSON response
  ↓
Frontend

The frontend does not need to know how the reservation was persisted. It only needs to know the API contract.

14. Initial Conventions

The team should agree on the following conventions from the beginning.

Routes

/api/v1/<domain>

Naming

Python: snake_case.

Variables and functions: snake_case.

Classes: PascalCase.

Identifiers: descriptive and consistent names.

Routers

One router per clearly identified domain or subdomain.

Schemas

Separate request and response schemas from persistence models when their responsibilities differ.

Errors

Use consistent error responses so the frontend can handle failures predictably.

Security

Never store secrets in the repository.

Documentation

Architecture decisions should be updated when the system structure changes significantly.

15. Risks and Points of Attention

Risk 1 — Routers become responsible for everything

If routers start querying the database, applying business rules, validating complex workflows, and transforming responses all at once, the backend will become difficult to maintain.

Mitigation: keep routers focused on HTTP and move business rules into services/use cases and data access into repositories.

Risk 2 — Business domains become mixed

Reservations, orders, accounts, and candidates are related, but they should not become one large module.

Mitigation: define clear ownership of each business rule and avoid unnecessary circular dependencies between domains.

Risk 3 — Excessive frontend/backend coupling

Internal backend changes should not require the frontend to understand backend implementation details.

Mitigation: treat the versioned API as the contract between both systems.

Risk 4 — Different configuration between environments

An API may work locally but fail after deployment if database URLs, credentials, or CORS settings differ.

Mitigation: centralize configuration and use environment variables with a .env.example.

Risk 5 — Too many layers too early

An architecture can also become unnecessarily complex if every small operation is split into multiple layers before there is a real responsibility to separate.

Mitigation: introduce additional abstraction only when it solves a concrete problem. The proposed structure is modular but does not require five files for every simple endpoint.

Risk 6 — Future growth of the monolith

A modular monolith can eventually become difficult to split if its domain boundaries are not respected.

Mitigation: preserve domain boundaries from the beginning and review dependencies between modules regularly. If one domain eventually requires independent deployment or scaling, its extraction into a separate service can be evaluated.

16. Open Decisions

This proposal does not attempt to close decisions for which the requirements are not yet sufficiently defined.

The following should be resolved during subsequent development phases: final authentication strategy;exact permission model;final database schema;transaction strategy;definitive payment provider and payment flow;deployment strategy;logging and observability;API versioning and deprecation policy;integration and end-to-end testing strategy.

These decisions should be made when their technical and business requirements are clear, avoiding unnecessary complexity at this stage.

17. Conclusion

The proposed architecture is a modular monolith organized by business domains, with internal separation between API, business logic, and persistence.

This decision is based on Brasaland's current characteristics: several related business flows — accounts, reservations, orders, catalog, candidate management, and loyalty — need to share infrastructure and data while maintaining clear boundaries.

FastAPI supports this organization through APIRouter, modular endpoint grouping, dependency injection, and automatic OpenAPI documentation. The frontend/backend separation is maintained through a versioned HTTP API, explicit CORS configuration, and environment-based configuration.

The goal of this proposal is not to anticipate every future requirement. It is to establish a clear structure that allows the team to begin development without mixing responsibilities and with a reasonable path for future evolution.

18. References

FastAPI — Bigger Applications / Multiple Files:
https://fastapi.tiangolo.com/tutorial/bigger-applications/

FastAPI — Dependencies:
https://fastapi.tiangolo.com/tutorial/dependencies/

FastAPI — CORS:
https://fastapi.tiangolo.com/tutorial/cors/

FastAPI — Settings and Environment Variables:
https://fastapi.tiangolo.com/advanced/settings/

FastAPI — Environment Variables:
https://fastapi.tiangolo.com/environment-variables/