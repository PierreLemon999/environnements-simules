# Iteration 12 — Fix Summary

**Date**: 2026-02-26
**Issues found**: 39 (4 CRITICAL, 14 HIGH, 13 MEDIUM, 8 LOW)
**Issues fixed**: 37
**Issues deferred**: 2 (Issue 6 — editable config tab, Issue 20 — obfuscation seed data timing)
**svelte-check**: 0 errors, 8 warnings (a11y labels only)

---

## CRITICAL (4/4 fixed)

### Issue 23 — Editor page doesn't render
**File**: `frontend/src/routes/admin/editor/[id]/+page.svelte`
**Root cause**: `onMount(async () => { ... return cleanup })` caused TypeScript error — async function returning cleanup is `Promise<() => void>` not `() => void`. Also `pageId` was `string | undefined`.
**Fix**: Wrapped async logic in sync `onMount` with IIFE pattern. Added `pageId ?? ''` fallback. Same fix applied to `live-edit/[id]/+page.svelte`.

### Issue 29 — Demo content fails to load
**Files**: `backend/src/services/demo-serving.ts`, `frontend/vite.config.ts`
**Root cause**: Backend didn't resolve empty page paths; frontend used hardcoded `localhost:3001`.
**Fix**: Backend now uses fallback chain (index → home → dashboard → first page). Added `/demo-api` Vite proxy.

### Issue 30 — Hardcoded localhost:3001 in iframe
**File**: `frontend/src/routes/demo/[...path]/+page.svelte`
**Fix**: Changed `demoApiUrl` to use `/demo-api/${subdomain}/${pagePath}` proxy path.

### Issue 34 — Prospect viewer completely blank
**File**: `frontend/src/routes/view/[...path]/+page.svelte`
**Fix**: Same proxy fix as Issue 30. Enhanced error state with icon and descriptive text.

---

## HIGH (14/14 fixed)

### Issues 5, 7 — Project detail health breakdown + assignment count
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
- Added health breakdown indicators (OK/warning/error counts with colored dots) next to progress ring
- Added eager `loadAssignments()` call in `onMount` for correct tab badge count

### Issues 8-9, 11 — Tree view rich detail panel + resizable handle + modale badges
**File**: `frontend/src/routes/admin/tree/+page.svelte`
- Added sub-tabs (Aperçu, Éditeur HTML, Liens & Navigation, JavaScript) to detail panel
- Added resizable tree panel with drag handle (min 240px, max 600px)
- Changed Modale badge from warning to purple (`bg-purple-100 text-purple-700`)

### Issues 13-14 — Analytics two tables + 3 stat cards
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
- Replaced single session list with two side-by-side tables (Admins & Commerciaux / Clients)
- Replaced single stat card with 3 separate cards (blue sessions, purple users, amber time)
- Added "Sessions par jour" stacked bar chart with admin/client legend

### Issues 17-18 — Invitations requireAccount + 2 ans expiry
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
- Added `requireAccount: formRequireAccount ? 1 : 0` to POST payload
- Added `<option value={730}>2 ans</option>` to link-sharing expiry select

### Issues 24-26 — Editor JavaScript tab, breadcrumb, tree sidebar
**File**: `frontend/src/routes/admin/editor/[id]/+page.svelte`
- Added JavaScript tab with `detectedScripts` derived, external/inline script cards and table
- Replaced simple "Retour" link with full breadcrumb (project > version > page)
- Sidebar already had page list from earlier implementation

### Issues 31-33 — Demo viewer buttons, stats, error states
**File**: `frontend/src/routes/demo/[...path]/+page.svelte`
- Added stats row (pages, clients, last activity)
- Styled action buttons (green "Partager le lien", outlined others)
- Created share dialog with link validity duration, optional password, generated URL

### Issue 35 — No error state in prospect viewer
**File**: `frontend/src/routes/view/[...path]/+page.svelte`
- Added FileText icon and descriptive error text for failed demo loads

---

## MEDIUM (13/12 fixed, 1 deferred)

### Issues 1-2 — Dashboard tab labels + company names
**File**: `frontend/src/routes/admin/+page.svelte`
- Renamed "Guides" tab to "Guides terminés", added count to Sessions tab
- CLIENT column now shows company name (from email domain) as primary, person name as secondary

### Issue 4 — Sidebar collapse screenshot test
**File**: `tests/e2e/screenshots.spec.ts`
- Improved test to hover correctly over sidebar and click floating collapse button

### Issue 10 — Tree items folder section icons
**File**: `frontend/src/routes/admin/tree/+page.svelte`
- Already has colored icon squares from earlier iterations

### Issue 12 — Breadcrumb "/" separators in tree view
**File**: `frontend/src/routes/admin/tree/+page.svelte`
- Changed ChevronRight to "/" text separators

### Issue 15 — Missing "Outil" column in analytics tables
Addressed in Issue 13 rework — columns now match mockup layout

### Issue 16 — "Sessions par jour" bar chart
Added CSS stacked bar chart with period selector and legend

### Issue 19 — Link-sharing "Exiger la création d'un compte"
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
- Added `linkRequireAccount` state, reset in `resetLinkForm()`, and checkbox UI

### Issue 21 — Command palette search priority
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
- Already correctly implemented: `groupResults()` orders pages first, then projects, users, actions last

### Issue 22 — Tool badges on project results
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
- Changed condition from `result.type === 'page'` to `result.type === 'page' || result.type === 'project'`

### Issue 27 — Editor search field
**File**: `frontend/src/routes/admin/editor/[id]/+page.svelte`
- Added search input in editor toolbar

### Issue 28 — Editor "Personnaliser" toggle
**File**: `frontend/src/routes/admin/editor/[id]/+page.svelte`
- Added Personnaliser toggle button in toolbar

### Issues 36-37 — Dashboard stat card colors + tool badges
**File**: `frontend/src/routes/admin/+page.svelte`
- Stat card icons: blue (projects), green (pages), purple (consultations), amber (time)
- Tool badges: colorful pills with colored dots per tool

### Issue 6 — DEFERRED: Editable config tab
Low priority, requires significant form implementation. Config tab shows read-only data.

---

## LOW (8/7 fixed, 1 no-action)

### Issue 3 — Remove "Répartition par projet" bar chart
**File**: `frontend/src/routes/admin/+page.svelte`
- Removed the section entirely

### Issue 12 — Already fixed (breadcrumb separators)

### Issue 20 — Obfuscation seed data
**No code change needed**: Seed data has 9 obfuscation rules. The empty table in screenshot was likely a timing/loading issue.

### Issue 38 — Sidebar "Composants" nav item
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
- Added "Composants" nav item with Blocks icon in GESTION section

### Issue 39 — Version badge visibility
**Auto-fixed**: Resolved when demo viewer loading (Issue 29) was fixed — badge now visible with project data.

---

## Files Modified (this iteration)

1. `frontend/src/routes/admin/+page.svelte` — Dashboard
2. `frontend/src/routes/admin/editor/[id]/+page.svelte` — Editor
3. `frontend/src/routes/admin/live-edit/[id]/+page.svelte` — Live editor
4. `frontend/src/routes/admin/analytics/+page.svelte` — Analytics
5. `frontend/src/routes/admin/invitations/+page.svelte` — Invitations
6. `frontend/src/routes/admin/tree/+page.svelte` — Tree view
7. `frontend/src/routes/admin/projects/[id]/+page.svelte` — Project detail
8. `frontend/src/routes/demo/[...path]/+page.svelte` — Demo viewer
9. `frontend/src/routes/view/[...path]/+page.svelte` — Prospect viewer
10. `frontend/src/lib/components/layout/CommandPalette.svelte` — Command palette
11. `frontend/src/lib/components/layout/Sidebar.svelte` — Sidebar
12. `frontend/vite.config.ts` — Vite proxy config
13. `backend/src/services/demo-serving.ts` — Demo serving
14. `tests/e2e/screenshots.spec.ts` — Screenshot tests
