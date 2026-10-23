# Caching Optimization Report

## 1. Objective
Evaluate caching opportunities in the API and reduce unnecessary processing while preserving data consistency.

## 2. Performance Analysis
The root endpoint was tested using repeated HTTP requests.

| Request | Approximate response time |
|---|---:|
| Initial request | 16.81 ms |
| Subsequent requests | 1.44–2.44 ms |
| Additional repeated requests | 1.90–2.27 ms |

The root endpoint is already fast, so caching it is not a high-impact optimization.

The inventory products endpoint requires authentication. Unauthenticated requests returned HTTP 401, so these measurements cannot be used to evaluate its actual query performance.

## 3. Inventory Stock Calculation
The inventory service provides two functions:

- `calculate_stock()`: retrieves movements for one product and calculates its stock.
- `calculate_stocks()`: retrieves movements for multiple products and calculates their stock in a single query.

The bulk calculation is preferable when listing products because it avoids querying movements separately for each item.

## 4. Cache Strategy and Data Consistency
Inventory stock changes when inbound, outbound, or adjustment movements are recorded.

Any stock cache must be invalidated after successful inventory changes. Otherwise, users could see outdated stock values or make decisions using incorrect inventory information.

A time-to-live (TTL) of 30 seconds was considered, but a stock cache with this TTL has not been confirmed as implemented. It should only be introduced together with reliable invalidation and tests.

## 5. Frontend Optimization
The ordering application was built successfully with Vite. No specific frontend caching or `useMemo` optimization has been measured or confirmed as implemented in this iteration.

## 6. Validation
The existing inventory tests cover stock calculation, rejection of outbound movements that exceed available stock, and preservation of stock after rejected movements.

Test execution should be repeated after the final changes. Only verified test results should be recorded here.

## 7. Conclusion
The initial measurements show that the root endpoint is already fast. The inventory bulk calculation is an existing optimization worth preserving. Further caching should target endpoints with demonstrated query cost and request frequency, and must include invalidation after relevant writes to maintain consistency.
