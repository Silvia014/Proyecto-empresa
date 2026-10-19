# Website Performance Audit

## 1. Objective

The purpose of this audit is to evaluate the performance, accessibility, best practices, and SEO of the Brasaland corporate website and backoffice.

The initial audit establishes a baseline before any performance improvements are implemented. The results will be compared with a subsequent audit to measure the impact of the changes.

## 2. Scope and methodology

### Pages audited

| Page | URL |
|---|---|
| Corporate website | `http://206.189.186.75:3000/` |
| Backoffice | `http://206.189.186.75:3001/backoffice/` |

### Tools

- Google Lighthouse: performance and quality audits.
- Node.js and Lighthouse CLI: automated audit execution.
- Lighthouse HTML and JSON reports: detailed results and structured metrics.
- Google Chrome Lighthouse: manual audits and PDF evidence.

### Evidence

Automated reports are stored in `audit/before/` and `audit/reports/`.

Manual Lighthouse PDF reports are stored in `audit/screenshots/`.

The `audit/before/` directory preserves the initial automated reports for comparison with the final results.

**Measurement limitation:** the automated audits were run against the public HTTP URLs listed above. Production-mode configuration and the equivalence of the manual and automated test conditions have not yet been independently verified. These scores should therefore be treated as the initial measured baseline, pending that verification.

## 3. Initial Lighthouse scores

| Category | Corporate website | Backoffice |
|---|---:|---:|
| Performance | 68/100 | 98/100 |
| Accessibility | 100/100 | 90/100 |
| Best Practices | 74/100 | 74/100 |
| SEO | 100/100 | 90/100 |

### Initial assessment

The corporate website has the greatest performance improvement potential, with a score of 68/100.

The backoffice achieves 98/100 for performance. Its main identified opportunities concern accessibility, resource delivery, and best practices rather than its overall loading performance.

Both pages received a score of 74/100 for Best Practices. Lighthouse also reported insecure HTTP requests and browser console errors on both pages.

## 4. Corporate website findings

### 4.1 Image delivery

**Finding:** Lighthouse identified two images that could be optimized.

| Resource | Estimated potential savings |
|---|---:|
| Unsplash image `photo-1517248135467-4c7edcad34c4` | Approximately 103 KiB |
| Unsplash image `photo-1414235077428-338989a2e8c0` | Approximately 62 KiB |
| **Total estimated savings** | **Approximately 161 KiB** |

**Potential root cause:** the images may be delivered at a larger file size or quality than necessary for their displayed dimensions.

**Recommended action:** inspect the rendered dimensions and image formats, then optimize image delivery while preserving visual quality. Verify that the main above-the-fold image is loaded with the appropriate priority.

### 4.2 Render-blocking resources

**Finding:** Lighthouse estimated a potential saving of approximately 1,040 ms from render-blocking resources.

Identified resources:

- `styles.css`
- Google Fonts stylesheet
- `chat.js`

**Potential root cause:** stylesheets and scripts required during initial rendering may delay the first visible content.

**Recommended action:** inspect script loading attributes, stylesheet dependencies, and font loading. Defer non-critical JavaScript where safe, and avoid delaying content that is required for the initial render.

### 4.3 JavaScript minification

**Finding:** Lighthouse estimated approximately 14 KiB of potential savings.

Affected resources:

- `translations.js`
- `validation.js`

**Recommended action:** generate minified production assets and verify that translations and form validation continue to work correctly.

### 4.4 Unused CSS

**Finding:** Lighthouse estimated approximately 11 KiB of potentially unused CSS in `styles.css`.

**Recommended action:** inspect the Tailwind CSS build configuration and production CSS output. Remove unused styles only after confirming that required page components and responsive states are preserved.

### 4.5 Cache policy

**Finding:** Lighthouse estimated approximately 76 KiB of potential savings through more efficient cache lifetimes.

Affected resources:

- `translations.js`
- `styles.css`
- `validation.js`
- `main.js`

**Recommended action:** review the HTTP cache headers configured by the web server. Use suitable cache lifetimes for static assets and cache-busting filenames or versioning where appropriate.

### 4.6 Missing resources and console errors

**Finding:** Lighthouse reported two network errors with HTTP 404 responses.

Follow-up checks confirmed that these URLs returned `404 Not Found` before the fix:

- `http://206.189.186.75:3000/chat.js`
- `http://206.189.186.75:3000/favicon.ico`

**Observed errors:**
- Browser console/network errors for missing static resources.
- The site root referenced `/chat.js` and `/favicon.ico`, but the Docker build did not include those files in `/usr/share/nginx/html/website/`.
- This was a packaging/deployment issue rather than a chat logic or authentication bug.

**Potential root cause:** the HTML references the files at the site root, but the static Docker image only copied a curated subset of the website sources. The browser therefore requested `/chat.js` and `/favicon.ico` from the served public site directory, and those files were absent from the final container image.

**Evidence from investigation:** the root static site assets existed in the repo, but the Docker build copied only a subset of the root files to the NGINX document root. The public site therefore returned 404s even though the source files existed in the project.

**Fix applied:** add `chat.js` to the static website copy list and copy an existing brand favicon into `/usr/share/nginx/html/website/` in both Dockerfiles. This preserves the existing NGINX configuration and avoids any runtime change to the chat logic, authentication, or unrelated frontend code.

**Status:** the fix is intentionally limited to the deployment artifact copy step and does not alter business or API logic.

### 4.7 Static asset optimization applied

**Approved change:** defer the chat script and apply `decoding="async"` to non-critical image assets in `index.html` to reduce render-blocking and image decode overhead without changing page behavior or the content structure.

**Scope:** this is intentionally limited to the public static page and does not change the backoffice, authentication, or API logic.

### 4.8 Initial issues summary

The initial audit identified a combination of real performance problems and deployment defects:

- Missing static files (`chat.js`, `favicon.ico`) causing HTTP 404s.
- Render-blocking script and stylesheet delivery on the homepage.
- Non-critical image decode overhead.
- JS and CSS optimization opportunities on the corporate site.
- Backoffice accessibility issues focused on form labeling and live feedback, rather than core functionality.

These issues were handled in a minimal, evidence-based order: first restore the served static resources, then reduce render delay on the homepage, then address the scoped accessibility follow-up without touching auth behavior or backend logic.
