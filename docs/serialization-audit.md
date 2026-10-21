# Serialization audit for the recovered FastAPI backend

## Scope and verification method

This audit is limited to the recovered FastAPI application under [services/api/app](../services/api/app), which is the active backend recovered locally from the main branch. The repository also contains an Express/Prisma implementation under [restaurant-platform/src](../restaurant-platform/src), but that code is not the subject of this serialization review.

The review was intentionally read-only and based on the live source of the FastAPI app. The route inventory was verified by importing the real application object and enumerating `app.routes`, excluding FastAPI metadata routes such as `/docs`, `/redoc`, and `/openapi.json`.

Evidence reviewed:

- [services/api/app/main.py](../services/api/app/main.py#L1-L178)
- [services/api/app/auth/routes.py](../services/api/app/auth/routes.py#L1-L12)
- [services/api/app/auth/supabase_dependencies.py](../services/api/app/auth/supabase_dependencies.py#L1-L99)
- [services/api/app/inventory/routes.py](../services/api/app/inventory/routes.py#L1-L389)
- [services/api/app/inventory/schemas.py](../services/api/app/inventory/schemas.py#L1-L66)
- [services/api/app/incidents/routes.py](../services/api/app/incidents/routes.py#L1-L128)
- [services/api/app/incidents/models.py](../services/api/app/incidents/models.py#L1-L89)
- [services/api/app/profiles/routes.py](../services/api/app/profiles/routes.py#L1-L118)
- [services/api/app/profiles/crud.py](../services/api/app/profiles/crud.py#L1-L101)
- [services/api/app/models.py](../services/api/app/models.py#L1-L62)
- [services/api/app/crud.py](../services/api/app/crud.py#L1-L96)
- [services/api/app/users/routes.py](../services/api/app/users/routes.py#L1-L39)
- [services/api/app/supplier_directory_model.py](../services/api/app/supplier_directory_model.py#L1-L72)

## Verified endpoint inventory

Runtime verification result: 31 unique route-method pairs were mounted on the app, excluding FastAPI docs/openapi metadata. No endpoint appears more than once.

### Verified route list

| # | Method | Full path | Current response model | Current payload shape | Classification | Change required? |
|---|---|---|---|---|---|---|
| 1 | GET | /users | None (HTTP 410 JSON detail) | `{"detail":"The legacy user API has been retired..."}` | Not explicitly contract-bound / disabled | No, legacy route intentionally retired; keep disabled unless product owner confirms removal |
| 2 | POST | /users | None (HTTP 410 JSON detail) | `{"detail":"The legacy user API has been retired..."}` | Not explicitly contract-bound / disabled | No; same as above |
| 3 | GET | /users/{user_id} | None (HTTP 410 JSON detail) | `{"detail":"The legacy user API has been retired..."}` | Not explicitly contract-bound / disabled | No; same as above |
| 4 | PATCH | /users/{user_id} | None (HTTP 410 JSON detail) | `{"detail":"The legacy user API has been retired..."}` | Not explicitly contract-bound / disabled | No; same as above |
| 5 | DELETE | /users/{user_id} | None (HTTP 410 JSON detail) | `{"detail":"The legacy user API has been retired..."}` | Not explicitly contract-bound / disabled | No; same as above |
| 6 | POST | /profiles | `Profile` | `{"id":"uuid","user_id":"uuid","name":"...","phone":"...","address":"..."}` | Fully explicit | No |
| 7 | GET | /profiles/me | `Profile` | `{"id":"uuid","user_id":"uuid","name":"...","phone":"...","address":"..."}` | Fully explicit | No |
| 8 | PUT | /profiles/me | `Profile` | `{"id":"uuid","user_id":"uuid","name":"...","phone":"...","address":"..."}` | Fully explicit | No |
| 9 | GET | /profiles/{user_id} | `Profile` | `{"id":"uuid","user_id":"uuid","name":"...","phone":"...","address":"..."}` | Fully explicit | No |
| 10 | PATCH | /profiles/{user_id} | `Profile` | `{"id":"uuid","user_id":"uuid","name":"...","phone":"...","address":"..."}` | Fully explicit | No |
| 11 | DELETE | /profiles/{user_id} | None (204 No Content) | Empty body | Not explicitly contract-bound | No for 204; no JSON body appropriate |
| 12 | GET | /auth/me | None | `{"id":"...","email":"...","is_active":true}` | Partially explicit | Yes, add explicit auth response schema |
| 13 | POST | /api/incidents | `Incident` | `{"id":1,"title":"...","description":"...","category":"equipment_failure","status":"open","origin":"customer","branch":"central","created_at":"...","updated_at":"..."}` | Fully explicit | No |
| 14 | GET | /api/incidents | `list[Incident]` | `[ { ...Incident... }, ... ]` | Fully explicit | No |
| 15 | GET | /api/incidents/summary | None | `{"total":n,"by_status":{"open":x,...},"by_origin":{"customer":x,...},"by_category":{"equipment_failure":x,...}}` | Partially explicit | Yes, add `IncidentSummaryResponse` |
| 16 | GET | /api/incidents/{incident_id} | `Incident` | `{"id":1,...}` | Fully explicit | No |
| 17 | PATCH | /api/incidents/{incident_id}/status | `Incident` | `{"id":1,...,"status":"resolved"}` | Fully explicit | No |
| 18 | GET | /inventory/products | `list[ProductResponse]` | `[ { "id":1,"location_id":"...","name":"...","category":"...","unit_of_measure":"...","reorder_point":5.0,"current_stock":12.5,"below_reorder":false,"created_at":"...","updated_at":"..." }, ... ]` | Fully explicit | No |
| 19 | POST | /inventory/products | `ProductResponse` | `{"id":1,...,"current_stock":0,"below_reorder":true,...}` | Fully explicit | No |
| 20 | GET | /inventory/products/{item_id} | `ProductResponse` | `{"id":1,...,"current_stock":12.5,...}` | Fully explicit | No |
| 21 | POST | /inventory/orders/inbound | `MovementResponse` | `{"id":1,"item_id":7,"lot_id":12,"movement_type":"inbound","quantity":25.5,"reason":"Restock","created_at":"...","user_uuid":"..."}` | Fully explicit | No |
| 22 | POST | /inventory/orders/outbound | `MovementResponse` | `{"id":2,"item_id":7,"lot_id":12,"movement_type":"outbound","quantity":3.0,"reason":"Sale","created_at":"...","user_uuid":"..."}` | Fully explicit | No |
| 23 | POST | /inventory/orders/adjustment | `MovementResponse` | `{"id":3,"item_id":7,"lot_id":12,"movement_type":"adjustment","quantity":-1.0,"reason":"Variance","created_at":"...","user_uuid":"..."}` | Fully explicit | No |
| 24 | GET | /inventory/orders | None | `[ { "id":1,"item_id":7,"product_name":"Tomato","movement_type":"inbound","quantity":25.5,"lot_id":12,"reason":"Restock","created_at":"...","user_uuid":"..." }, ... ]` | Partially explicit | Yes, add `InventoryMovementSummaryResponse` |
| 25 | GET | / | None | `{"message":"Brasaland Supplier Directory API"}` | Not explicitly contract-bound | No, but add explicit response model only if team wants a formal service contract |
| 26 | POST | /suppliers | `Supplier` | `{"id":1,"name":"...","country":"Colombia","categories":[...],"rate_per_unit":12.5,"currency":"COP","status":"active","contact_email":"...","notes":"...","updated_at":"..."}` | Fully explicit | No |
| 27 | GET | /suppliers | `list[Supplier]` | `[ {...Supplier...}, ... ]` | Fully explicit | No |
| 28 | GET | /suppliers/{supplier_id} | `Supplier` | `{"id":1,...}` | Fully explicit | No |
| 29 | PATCH | /suppliers/{supplier_id}/rate | `Supplier` | `{"id":1,...,"rate_per_unit":13.2,...}` | Fully explicit | No |
| 30 | PATCH | /suppliers/{supplier_id}/status | `Supplier` | `{"id":1,...,"status":"suspended",...}` | Fully explicit | No |
| 31 | DELETE | /suppliers/{supplier_id} | None (204 No Content) | Empty body | Not explicitly contract-bound | No for 204; no JSON body appropriate |

## Endpoint-by-endpoint findings

### 1) Auth and current-user payloads

Relevant implementation:

- [services/api/app/auth/routes.py](../services/api/app/auth/routes.py#L1-L12)
- [services/api/app/auth/supabase_dependencies.py](../services/api/app/auth/supabase_dependencies.py#L1-L99)

Current behavior:

- `GET /auth/me` returns `current_user` directly from `get_current_inventory_user()`.
- The dependency returns a dict containing `id`, `email`, and `is_active` after validating Supabase JWT claims.
- This is not a security defect by itself, but it is an API contract that is currently implicit.

Why this needs review:

- No `response_model` is declared.
- The frontend may depend on a stable contract, but the contract is not documented in code.
- The route is also security-sensitive because it exposes authenticated identity data.

Recommended target contract:

- `AuthUserResponse`
- Fields: `id`, `email`, `is_active`
- Example JSON:

```json
{
  "id": "7d6b2d0f-8c1d-4a4b-ae7a-a3c9c1d9ac99",
  "email": "ops@example.com",
  "is_active": true
}
```

### 2) Inventory movement history payload

Relevant implementation:

- [services/api/app/inventory/routes.py](../services/api/app/inventory/routes.py#L359-L389)
- [services/api/app/inventory/schemas.py](../services/api/app/inventory/schemas.py#L1-L66)

Current behavior:

- `GET /inventory/orders` joins `InventoryMovement` to `InventoryItem` and returns a list of dictionaries with `id`, `item_id`, `product_name`, `movement_type`, `quantity`, `lot_id`, `reason`, `created_at`, and `user_uuid`.
- This payload is useful for the UI but is not modeled as a response schema.

Why this needs review:

- It mixes persistence and presentation in a single payload.
- The scope of the response is not declared in the route signatures.
- A frontend may rely on `product_name`, but that is a projection, not a persisted model field.

Recommended target contract:

- `InventoryMovementSummaryResponse`
- Fields: `id`, `item_id`, `product_name`, `movement_type`, `quantity`, `lot_id`, `reason`, `created_at`, `user_uuid`
- Example JSON:

```json
[
  {
    "id": 42,
    "item_id": 7,
    "product_name": "Tomato",
    "movement_type": "inbound",
    "quantity": 25.5,
    "lot_id": 12,
    "reason": "Restock",
    "created_at": "2026-10-20T14:12:00Z",
    "user_uuid": "7d6b2d0f-8c1d-4a4b-ae7a-a3c9c1d9ac99"
  }
]
```

### 3) Incident summary payload

Relevant implementation:

- [services/api/app/incidents/routes.py](../services/api/app/incidents/routes.py#L63-L88)
- [services/api/app/incidents/models.py](../services/api/app/incidents/models.py#L1-L89)

Current behavior:

- `GET /api/incidents/summary` returns a custom aggregate object with `total`, `by_status`, `by_origin`, and `by_category`.
- This is a dashboard-friendly payload, but it is not declared via a Pydantic model.

Why this needs review:

- The structure is not anchored to a model, so contract drift is easy.
- The payload is not a persistence record but an analytic summary; it should be modeled as a dedicated summary response.

Recommended target contract:

- `IncidentSummaryResponse`
- Fields: `total`, `by_status`, `by_origin`, `by_category`
- Example JSON:

```json
{
  "total": 18,
  "by_status": {
    "open": 5,
    "in_progress": 6,
    "resolved": 4,
    "discarded": 3
  },
  "by_origin": {
    "customer": 7,
    "branch": 6,
    "internal": 5
  },
  "by_category": {
    "equipment_failure": 2,
    "supply_issue": 3,
    "customer_complaint": 4,
    "staff_issue": 2,
    "facility_issue": 3,
    "pos_system": 1,
    "delivery_issue": 2,
    "other": 1
  }
}
```

### 4) Root endpoint

Relevant implementation:

- [services/api/app/main.py](../services/api/app/main.py#L80-L85)

Current behavior:

- `GET /` returns `{"message": "Brasaland Supplier Directory API"}`

Assessment:

- This is acceptable as a service banner or readiness message.
- There is no evidence of a compatibility problem or a serialization defect.
- It can remain as-is, or it may later be given an explicit response model if the team wants a formal contract for health/welcome endpoints.

### 5) DELETE endpoints and 204 No Content

Relevant implementations:

- [services/api/app/main.py](../services/api/app/main.py#L118-L178)
- [services/api/app/profiles/routes.py](../services/api/app/profiles/routes.py#L103-L118)

Current behavior:

- `DELETE /suppliers/{supplier_id}` and `DELETE /profiles/{user_id}` are declared with `status_code=204` and return `None`.
- A 204 response intentionally has no body.

Why a JSON response model is not appropriate:

- The HTTP semantics of 204 are "success, no content".
- Adding a JSON response model for a 204 route would create a mismatch with the standard HTTP contract.
- If the frontend requires a machine-readable success payload, the route should return `200 OK` or `202 Accepted` with an explicit response model instead.

This is not a serialization defect; it is a correct use of HTTP status semantics.

### 6) Legacy /users API

Relevant implementation:

- [services/api/app/users/routes.py](../services/api/app/users/routes.py#L1-L39)
- [services/api/app/main.py](../services/api/app/main.py#L63-L67)

Current behavior:

- The router is still mounted on the app, but every user route raises HTTP 410 Gone with a legacy message.
- This is not a data leak bug; it is a deliberate disabled route.

Assessment:

- There is no evidence that the legacy API is still needed for active consumers.
- There is also no evidence that it must be removed immediately.
- The correct next step is product confirmation before deleting or reworking the route group.

## Security verification: confirmed findings vs. not-yet-verified risks

### Confirmed findings

The current API output does not expose password hashes, reset tokens, internal tokens, JWT secrets, or unnecessary internals.

Verification evidence:

- `Profile` response model only includes `id`, `user_id`, `name`, `phone`, and `address` in [services/api/app/profiles/models.py](../services/api/app/profiles/models.py#L5-L20).
- `Profile` database CRUD reads only `id`, `full_name`, `phone`, and `address` in [services/api/app/profiles/crud.py](../services/api/app/profiles/crud.py#L7-L34).
- The Supabase auth dependency returns only `id`, `email`, and `is_active` in [services/api/app/auth/supabase_dependencies.py](../services/api/app/auth/supabase_dependencies.py#L42-L99).
- The supplier model contains `contact_email` and `notes`, but not password hashes, resets, or auth secrets in [services/api/app/models.py](../services/api/app/models.py#L18-L62).
- The inventory and incident models have no password or token fields in [services/api/app/inventory/schemas.py](../services/api/app/inventory/schemas.py#L8-L54) and [services/api/app/incidents/models.py](../services/api/app/incidents/models.py#L1-L89).
- A grep for `password_hash|reset_token|refresh_token|access_token|api_key|secret|token` in the app code showed no actual API return of these fields; only the legacy auth configuration file and JWT token validation logic exist in [services/api/app/auth/config.py](../services/api/app/auth/config.py#L1-L10) and [services/api/app/auth/supabase_dependencies.py](../services/api/app/auth/supabase_dependencies.py#L42-L99).

### Potential risks requiring further verification

1. The default JWT secret fallback in [services/api/app/auth/config.py](../services/api/app/auth/config.py#L3-L10) is a development credential and should be confirmed as not used in production deployment.
2. The role of the `email` field in `current_user` should be verified against frontend privacy requirements; it is not a leak by itself, but it is still identity data.
3. The legacy `/users` router remains mounted, which is operationally safe but should be confirmed to be intentionally deprecated before removal.

These are not confirmed serialization defects; they are deployment and policy checks that require environment-specific verification.

## Frontend and test compatibility review

Before changing response payloads, the compatibility impact should be assessed.

### Confirmed compatibility posture

- The app is already returning explicit, stable object shapes for supplier records, inventory products, and incident records.
- The current frontend is likely using the explicit models already.
- The likely compatibility risk is concentrated in three places that presently rely on implicit or summary payloads rather than strict contracts:
  - `GET /auth/me`
  - `GET /inventory/orders`
  - `GET /api/incidents/summary`

### Compatibility guardrails for any future change

1. Do not remove or rename legacy fields without checking the frontend contract.
2. Preserve all currently used fields in the first change pass, even if the route gets a `response_model`.
3. Prefer additive field changes over breaking field removals.
4. For summary endpoints, preserve the current keys (`total`, `by_status`, `by_origin`, `by_category`) if they are already used by UI dashboards.
5. For 204 delete endpoints, leave the empty-body semantics untouched unless the frontend explicitly requires a different status code.

## Confirmed defects vs. recommended improvements

### Confirmed defects

These are the only issues that are clearly rooted in the current implementation and contract structure:

1. `GET /auth/me` has no explicit response contract in [services/api/app/auth/routes.py](../services/api/app/auth/routes.py#L7-L12).
2. `GET /inventory/orders` has no explicit response contract in [services/api/app/inventory/routes.py](../services/api/app/inventory/routes.py#L359-L389).
3. `GET /api/incidents/summary` has no explicit response contract in [services/api/app/incidents/routes.py](../services/api/app/incidents/routes.py#L63-L88).

These do not indicate secret exposure, but they do indicate contract drift risk.

### Recommended improvements

1. Add explicit response schemas for the three implicit-summary routes above.
2. Keep the current field names unchanged unless a consumer confirms a breaking change is safe.
3. Keep `204 No Content` delete responses as they are.
4. Keep legacy `/users` routes disabled until the product owner confirms they are safe to remove.

### Unresolved questions

1. Does the frontend actually consume `GET /auth/me` email as a required field, or should it be reduced to a more minimal identity payload?
2. Does the frontend depend on the `product_name` projection in `GET /inventory/orders`, or should the route become a pure movement endpoint and leave UI formatting to the client?
3. Does the incident summary payload need to be stable for dashboard charts, or can it be restructured to a different shape?
4. Does the team want the legacy `/users` router removed entirely, or only left disabled while the business process is migrated?

## Exact target fields for endpoints that need change

The following endpoints are the only ones that should be targeted in a serialization pass, because they are the ones with implicit or ad hoc response contracts.

### A) GET /auth/me

Target fields:

- `id`
- `email`
- `is_active`

Expected representative payload:

```json
{
  "id": "7d6b2d0f-8c1d-4a4b-ae7a-a3c9c1d9ac99",
  "email": "ops@example.com",
  "is_active": true
}
```

### B) GET /inventory/orders

Target fields:

- `id`
- `item_id`
- `product_name`
- `movement_type`
- `quantity`
- `lot_id`
- `reason`
- `created_at`
- `user_uuid`

Expected representative payload:

```json
[
  {
    "id": 42,
    "item_id": 7,
    "product_name": "Tomato",
    "movement_type": "inbound",
    "quantity": 25.5,
    "lot_id": 12,
    "reason": "Restock",
    "created_at": "2026-10-20T14:12:00Z",
    "user_uuid": "7d6b2d0f-8c1d-4a4b-ae7a-a3c9c1d9ac99"
  }
]
```

### C) GET /api/incidents/summary

Target fields:

- `total`
- `by_status`
- `by_origin`
- `by_category`

Expected representative payload:

```json
{
  "total": 18,
  "by_status": {
    "open": 5,
    "in_progress": 6,
    "resolved": 4,
    "discarded": 3
  },
  "by_origin": {
    "customer": 7,
    "branch": 6,
    "internal": 5
  },
  "by_category": {
    "equipment_failure": 2,
    "supply_issue": 3,
    "customer_complaint": 4,
    "staff_issue": 2,
    "facility_issue": 3,
    "pos_system": 1,
    "delivery_issue": 2,
    "other": 1
  }
}
```

## Classification totals

Verified runtime count: 31 unique route-method pairs.

- Fully explicit contracts: 20
- Partially explicit: 3
- Not explicitly contract-bound or deliberately disabled: 8

This totals exactly 31 routes.

## Implementation plan (prioritized)

This is the recommended order of work, to be executed only after approval.

### Priority 1: Formalize the three implicit response contracts

1. Add a dedicated `AuthUserResponse` for `GET /auth/me` in the auth schema layer.
2. Add a dedicated `InventoryMovementSummaryResponse` for `GET /inventory/orders`.
3. Add a dedicated `IncidentSummaryResponse` for `GET /api/incidents/summary`.
4. Preserve the existing field names and values to minimize frontend churn.

### Priority 2: Review compatibility before any field removal

1. Confirm whether the frontend reads `email` on `/auth/me`.
2. Confirm whether the UI depends on `product_name` for the movement history payload.

3. Confirm whether incident summary keys are rendered in charts or dashboards.

### Priority 3: Keep 204 semantics intact

1. Leave `DELETE /suppliers/{supplier_id}` and `DELETE /profiles/{user_id}` as `204 No Content`.
2. Do not add JSON bodies to 204 responses.
3. Use `200` or `202` only if there is a real business need for a content-bearing delete response.

### Priority 4: Legacy route decision

1. Keep `/users` disabled unless there is a clear requirement for removal.
2. Remove the route group only after product confirmation and a final frontend compatibility check.

## Validation plan

### Existing tests

Run the project test suite in the API service before and after any serialization changes.

Recommended checks:

- Run the FastAPI service test suite under [services/api/tests](../services/api/tests) if present.
- Confirm that route serialization changes do not break an existing response contract expected by current consumers.
- Validate that no test expects a missing `response_model` or a raw dict body for the three implicit endpoints above.

### Manual testing through /docs

Perform manual verification through the Swagger UI at `/docs` after implementation approval.

At minimum, verify these endpoint responses:

1. `GET /auth/me` through a valid Supabase token.
2. `GET /inventory/orders` with a populated movement history.
3. `GET /api/incidents/summary` with known incident records.
4. `DELETE /suppliers/{supplier_id}` to confirm it returns `204 No Content` without a JSON payload.
5. `DELETE /profiles/{user_id}` to confirm it also remains `204 No Content`.

### Acceptance criteria for the implementation pass

- Every route has a clear response contract in code.
- Summary endpoints use explicit models.
- No endpoint returns password hashes, reset tokens, secrets, or internal tokens.
- 204 delete endpoints remain empty-body responses.
- The legacy `/users` API remains intentionally disabled unless product owners explicitly request removal.

## Post-implementation status

The serialization pass was approved and completed under the compatibility guardrails in this document.

Verified implementation outcome:

- `GET /auth/me` is backed by `AuthUserResponse` and keeps a minimal, explicit identity payload.
- `GET /inventory/orders` is backed by `InventoryMovementSummaryResponse` and preserves the current output keys.
- `GET /api/incidents/summary` is backed by `IncidentSummaryResponse` and preserves the current summary keys.
- `DELETE` endpoints remain `204 No Content` with empty bodies, matching the current HTTP contract.
- The legacy `/users` router remains disabled and is not removed as part of this change.

Fresh verification evidence:

- `PYTHONPATH=/Users/aibo/Proyecto-empresa/services/api:/Users/aibo/Proyecto-empresa .venv/bin/pytest services/api/tests -q`
- Result: `7 passed in 2.14s`
- Runtime contract check: `AUTH 200`, `ORDERS 200`, `SUMMARY 200` with the expected field sets preserved.

These changes keep the current payload keys and delete semantics stable while making the contract explicit in the FastAPI route layer.

## Final assessment

The recovered FastAPI backend is structurally healthy and the runtime route inventory is consistent with the code. The main issue is not a raw security leak; it is a contract-quality issue in a small group of endpoints that currently rely on implicit dicts or no declared model at all. The report therefore focuses on explicit response-model cleanup, compatibility preservation, and careful handling of 204 semantics rather than on removing functional routes without evidence.

This audit is complete and reflects the approved implementation pass for the three implicit serialization contracts above. The remaining work, if any, should stay limited to compatibility checks in downstream consumers and deployment verification of the Supabase JWT secret configuration.
