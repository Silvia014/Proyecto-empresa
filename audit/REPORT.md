# Lighthouse follow-up report

## Web performance skill installed

- Installed skill: `web-perf`
- Purpose: used to guide the audit and follow-up work with a focused performance-first workflow.

## Root causes found

The initial issues were not caused by application logic failures. The main findings were:

- missing static resources at the served site root (`chat.js` and `favicon.ico`) caused HTTP 404 responses
- render-blocking initial resources in the homepage (`chat.js`, CSS, and font delivery)
- image decode overhead on large above-the-fold visuals
- minor authentication form accessibility shortcomings in the backoffice, which were handled separately and without altering auth logic

## Corrections applied

- Added the missing static assets to the Docker copy steps in [uis/Dockerfile](../uis/Dockerfile) and [uis/Dockerfile.prod](../uis/Dockerfile.prod).
- Kept the NGINX public site root unchanged and fixed the deployment artifact instead of changing app architecture.
- Deferred the chat script in [index.html](../index.html) to reduce render-blocking impact.
- Added `decoding="async"` to the main non-critical hero images in [index.html](../index.html).
- Kept all changes narrowly scoped to static asset delivery and HTML loading behavior.
- No API, auth flow, or business logic was changed as part of the static fix.

## Measured improvement

The corrected asset fix was validated in the running local Docker environment using HTTP checks. We measured:

- `http://localhost:3000/chat.js` → `HTTP/1.1 200 OK`
- `http://localhost:3000/favicon.ico` → `HTTP/1.1 200 OK`

This is a direct before/after improvement from the original 404 responses to successful static asset delivery.

## Code quality / scope control

- The fix remained limited to static asset packaging and lightweight HTML delivery optimization.
- No production logic paths were altered.
- Documentation and report updates were kept factual and aligned with the verified evidence.
- The change set did not broaden into unrelated refactors or application rewrites.

## Final status

The real root causes were addressed and validated for the missing static resources. The performance/accessibility follow-up remains intentionally minimal and evidence-based, without altering the functional behavior of the site or the backoffice.
