# Caching Optimization Report

## 1. Objective

The objective of this task is to reduce unnecessary database queries and
calculations, improve frontend loading performance, and preserve data
consistency when information changes.

The implementation covers backend TTL caching, cache invalidation,
frontend lazy loading, memoization, and request timing instrumentation.

## 2. Backend Changes

### 2.1 Inventory endpoints

Affected files:
- services/api/app/inventory/services.py
- services/api/app/inventory/routes.py
- services/api/tests/test_inventory.py

Endpoints benefiting from cached stock calculations:

- GET /inventory/products
- GET /inventory/products/{item_id}

The product list uses `calculate_stocks()` to calculate stock for multiple
products with a single database query for uncached items, instead of
performing a separate movement query for every product.

The individual product endpoint uses `calculate_stock()`.

A process-local in-memory cache stores calculated stock values with a
30-second TTL. Each cache entry includes its timestamp and stock value.
Unexpired entries can be reused without querying inventory movements again.

The bulk calculation checks cached entries and queries only the products
whose stock is missing or expired.

### 2.2 Inventory cache invalidation

`invalidate_stock_cache()` clears the stock cache after successful
inventory write operations.

The inventory routes call invalidation after committing changes, including
product creation and inventory movement operations.

This reduces the risk of returning stale stock after an inbound, outbound,
or adjustment movement. The TTL also limits the lifetime of cached entries.

Inventory tests explicitly invalidate the cache before their calculations
to avoid interference between tests.

### 2.3 Incident summary endpoint

Affected file:
- services/api/app/incidents/routes.py

Cached endpoint:

- GET /api/incidents/summary

The endpoint calculates:
- Total incidents.
- Incident counts by status.
- Incident counts by origin.
- Incident counts by category.

The summary is cached in memory for 30 seconds using `monotonic()` to
measure elapsed time. A lock protects access to the cache.

When the cached summary is valid, the endpoint returns it without
recalculating the aggregates from the incident list.

### 2.4 Incident cache invalidation

The `invalidate_summary_cache()` function clears the cached summary.

It is called after:
- POST /api/incidents successfully creates an incident.
- PATCH /api/incidents/{incident_id}/status successfully updates a status.

This prevents successful writes from leaving the summary cached until
the full TTL expires.

The incident list and individual incident endpoints are not themselves
cached by this implementation.

### 2.5 Endpoints deliberately not cached

The following endpoints were not given a response cache in this task:

- GET /suppliers
- GET /suppliers/{supplier_id}

The supplier list requires authentication and accepts country and category
filters. Caching complete responses without correctly accounting for
authentication and filter parameters could return inappropriate results.

The root endpoint was measured, but no response cache was added because
the observed response times were already low.

## 3. Frontend Optimization

### 3.1 Lazy loading

Affected file:
- restaurant-platform/ordering-app/src/App.tsx

The following page components are loaded using `React.lazy()`:

- LocationSelect
- Menu
- Checkout
- Success
- Cancel

`Suspense` displays a loading message while a page component is loading.

This allows the bundler to split page code into separate chunks and load
those chunks on demand, reducing the JavaScript needed for the initial
page load when not every route is required immediately.

The production build completed successfully, according to the final
validation performed during this task.

No numerical improvement in initial bundle size or page loading time was
recorded, so the size of the improvement has not been quantified.

### 3.2 Memoization with useMemo

Affected file:
- restaurant-platform/ordering-app/src/context/CartContext.tsx

Two calculations use `useMemo`:

- `totalItems`: sums the quantities of cart lines.
- `totalPrice`: sums each item's price multiplied by its quantity.

Both calculations depend on `[lines]`.

React can reuse the previous calculated value while `lines` remains
unchanged, avoiding unnecessary recalculation during unrelated renders.

These calculations are relatively small for a typical cart. The change
demonstrates memoization, but no measured render-time improvement was
recorded.

## 4. Request Timing Instrumentation

Affected file:
- services/api/app/main.py

Request timing middleware was added to measure request duration and log
request method, path, response status, and elapsed time.

This instrumentation supports performance evaluation and helps identify
endpoints that may benefit from optimization.

## 5. Performance Evaluation

### 5.1 Measurements recorded

Repeated requests to the root endpoint produced the following observations:

| Measurement | Approximate response time |
|---|---:|
| Initial request | 16.81 ms |
| Subsequent requests | 1.44–2.44 ms |
| Additional repeated requests | 1.90–2.27 ms |

These measurements show that subsequent requests to the root endpoint
were faster in the observed run.

They do not establish that caching caused the improvement. The root
endpoint was not given a response cache, and the measurements may reflect
application startup, connection initialization, or other runtime effects.

### 5.2 Inventory endpoint limitation

An unauthenticated request to GET /inventory/products returned HTTP 401.

That request cannot be used to evaluate the normal authenticated endpoint's
query performance.

No before-and-after timing comparison was recorded for the inventory
stock cache or the incident summary cache. Their performance improvement
is therefore expected from avoiding repeated calculations and database
queries, but has not been quantified in milliseconds.

### 5.3 Evaluation conclusion

The implementation introduces cache reuse in stock calculations and
incident summary generation. It also adds frontend code splitting and
memoization.

The root endpoint measurements provide a timing reference, but further
controlled benchmarks would be needed to quantify the benefit of each
specific optimization.

## 6. Validation

- Inventory tests: 7 passed in the recorded test run.
- The final backend test command was reported as successful.
- The frontend production build was reported as successful.
- Cache invalidation is included after inventory write operations.
- Incident summary invalidation is included after incident creation and
  successful status updates.
- The stock and summary caches use a 30-second TTL.

## 7. Consistency, Security, and Trade-offs

### Freshness

A 30-second TTL limits how long cached values remain valid. Explicit
invalidation after relevant writes improves freshness without requiring
every read to recalculate the result.

### Process-local cache

Both caches are held in application memory. They are not shared between
multiple worker processes or application instances.

In a multi-worker or multi-instance deployment, one process may retain
cached data after another process changes the database. A shared cache or
cross-process invalidation mechanism would be needed for stronger
consistency across instances.

### Cached data

The inventory cache stores calculated stock per item. The incident cache
stores aggregate counts, rather than caching an authenticated user's
complete response.

The supplier endpoints were deliberately excluded from response caching
because they require authentication and support filtering.

### Performance versus freshness

A longer TTL can reduce repeated work but may increase the time cached
values remain stale. A shorter TTL improves freshness but can cause more
database queries and recalculations.

The 30-second TTL is the chosen compromise for this exercise, together
with explicit invalidation after successful changes.

## 8. Conclusion

This task implements TTL caching for inventory stock calculations and the
incident summary, invalidation after relevant writes, lazy loading for
five frontend routes, and memoization of cart totals.

Request timing instrumentation is available to support further analysis.
The backend tests and frontend build were reported as successful.

The implementation addresses repeated calculations and loading work while
documenting the limits of process-local caching and the performance
measurements still needed for a quantified before-and-after comparison.
