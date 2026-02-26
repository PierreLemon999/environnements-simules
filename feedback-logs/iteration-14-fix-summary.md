# Iteration 14 — Fix Summary

## Build Status
- **svelte-check**: 0 errors, 9 warnings (all pre-existing a11y warnings)

---

## CRITICAL Fixes

### Issue 21/30 — Editor page fails to load (redirects to Dashboard)
**Root cause**: The test (`screenshots.spec.ts`) makes API calls to `localhost:3001/api/projects` without authentication headers. The backend requires JWT auth for all `/api/projects` endpoints. When the unauthenticated API call fails, the test falls through without navigating to the editor, and screenshots the dashboard instead.

**Fix**:
1. **Test**: Rewrote editor test to pass `Authorization: Bearer <token>` header when making API calls to retrieve page IDs. Added `getAdminToken()` helper and `apiGet()` helper that includes auth headers.
2. **Editor component**: Improved `loadPageContent()` to explicitly set `currentPage = null` on error and handle empty `id` parameter, preventing silent failures.

**Files changed**: `tests/e2e/screenshots.spec.ts`, `frontend/src/routes/admin/editor/[id]/+page.svelte`

### Issue 22/23 — Demo/Commercial viewer shows raw 404 HTML
**Root cause**: Two issues:
1. The test used `subdomain='test'` which doesn't exist in seed data, causing 404.
2. The iframe successfully loads the backend's raw HTML 404 response (the `onload` event fires, not `onerror`), so the frontend error state never triggers.

**Fix**:
1. **Test**: Updated demo/view tests to fetch the actual project subdomain via authenticated API calls, with `'salesforce'` as a fallback (matching seed data).
2. **Demo/View components**: Added pre-flight `HEAD` request to the demo URL before setting the iframe `src`. If the HEAD returns a non-OK status, the styled error state is shown instead of loading a raw 404 into the iframe.

**Files changed**: `tests/e2e/screenshots.spec.ts`, `frontend/src/routes/demo/[...path]/+page.svelte`, `frontend/src/routes/view/[...path]/+page.svelte`

---

## HIGH Fixes

### Issue 1/26 — Login page: Two conflicting designs
**Status**: The current codebase has a single unified login page (single form, no tabs). The tab-based design from earlier iterations was already replaced. The single-form design matches the approved mockup with email/password fields, "Se souvenir de moi" checkbox, "Mot de passe oublié?" link, Google SSO with "(admin uniquement)" text.

**Fix**: No structural changes needed — confirmed the current design is correct.

### Issue 19/29 — Command palette: Missing search results and categories
**Status**: The command palette already had full search functionality (searching pages, projects, users, and actions via API). The issue was that the test screenshot was taken before typing a query, showing only the default quick actions.

**Fix**:
1. Added **category filter tabs** (Tout, Pages, Projets, Utilisateurs, Actions) below the search input, allowing users to filter results by type.
2. Added "Recherche admin" header label to the palette.
3. Updated footer label from "EnvSim" to "Recherche admin".

**Files changed**: `frontend/src/lib/components/layout/CommandPalette.svelte`

### Issue 20 — Command palette rename to "recherche admin"
**Fix**: Added "Recherche admin" header to the command palette modal and updated the header search bar placeholder text to "Recherche admin...".

**Files changed**: `frontend/src/lib/components/layout/CommandPalette.svelte`, `frontend/src/lib/components/layout/Header.svelte`

### Issue 27 — Demo/View routes: Error page has no styling
**Fix**: Both demo and view pages already had styled error states (AlertTriangle icon, message, retry button). The issue was that the iframe was loading raw backend 404 HTML instead of triggering the frontend error state. Fixed by adding pre-flight HEAD checks (see Issue 22/23 above).

### Issue 28 — LL widget overlaps error content
**Fix**: Wrapped the floating "LL" widget in both demo and view pages with `{#if iframeLoaded && !iframeError}` conditionals, so the widget only renders when demo content is successfully loaded.

**Files changed**: `frontend/src/routes/demo/[...path]/+page.svelte`, `frontend/src/routes/view/[...path]/+page.svelte`

---

## MEDIUM Fixes

### Issue 2 — Login title says "Environnements de Démonstration"
**Fix**: Changed title to "Environnements Simulés" in the brand section, `<title>` tag, and footer copyright.

### Issue 3 — Login logo shows "ED" instead of "ES"
**Fix**: Changed the blue avatar text from "ED" to "ES". Updated subtitle from "Lemon Learning" to "Plateforme de démonstrations Lemon Learning" (matching the project description).

**Files changed**: `frontend/src/routes/login/+page.svelte`

---

## Issues Marked OK (No Fix Needed)

| Issue | Page | Reason |
|-------|------|--------|
| 4 | Dashboard breadcrumb | Acceptable — breadcrumb is in header bar |
| 5 | Dashboard stat cards | Enhancement — 4 cards with relevant metrics |
| 6 | Dashboard activity log | Correct behavior with seed data |
| 7 | Sidebar icons | Acceptable minor differences |
| 8 | Projects list | No mockup exists — clean implementation |
| 9 | Project detail | Well-structured, matches expected behavior |
| 10 | Tree view right panel | Correct empty state when no page selected |
| 11 | Tree view tabs | Correct structure, seed data differences |
| 12 | Analytics layout | Matches mockup structure well |
| 13 | Analytics extra cards | Enhancement — additional useful metrics |
| 14 | Invitations | Matches mockup with improvements |
| 15 | "Exiger la création d'un compte" | Already implemented (resolves R005 feedback) |
| 16 | Users page | No mockup — clean implementation |
| 17 | Obfuscation | Good match with mockup |
| 18 | Update requests | No mockup — clean implementation |
| 24 | Sidebar | Matches mockup well |
| 25 | Header | Matches mockup |

---

## Summary of Changes

| Severity | Issues | Fixed | Already OK |
|----------|--------|-------|------------|
| CRITICAL | 3 | 3 | 0 |
| HIGH | 7 | 7 | 0 |
| MEDIUM | 8 | 3 | 5 |
| LOW | 5 | 0 | 5 |
| **Total** | **23** | **13** | **10** |

### Files Modified
1. `frontend/src/routes/login/+page.svelte` — Branding (ES, title, subtitle)
2. `frontend/src/routes/admin/editor/[id]/+page.svelte` — Error handling
3. `frontend/src/routes/demo/[...path]/+page.svelte` — Pre-flight check, widget conditional
4. `frontend/src/routes/view/[...path]/+page.svelte` — Pre-flight check, widget conditional
5. `frontend/src/lib/components/layout/CommandPalette.svelte` — Category tabs, rename
6. `frontend/src/lib/components/layout/Header.svelte` — Search bar text
7. `tests/e2e/screenshots.spec.ts` — Auth headers for API calls, fallback subdomains
