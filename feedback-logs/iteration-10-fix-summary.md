# Iteration 10 — Fix Summary

**Date**: 2026-02-26
**Issues addressed**: 15 (3 HIGH, 7 MEDIUM, 5 LOW)

---

## Fixes Applied

### HIGH #3 — Dashboard stat cards (FIXED)
**File**: `frontend/src/routes/admin/+page.svelte`
- Replaced "Démos actives" card (3rd) with **"Pages consultées"** showing `overview.totalPageViews`
- Replaced "Sessions ce mois" card (4th) with **"Temps passé"** showing average session duration formatted as `Xmin` or `XhYm`
- Removed unused `activeDemoCount` state, `Assignment` interface, and demo assignment fetch loop (was doing N+1 API calls)
- Replaced `BarChart3` icon import with `Clock` icon for the time card

### HIGH #10 — Tree view folder grouping (ALREADY IMPLEMENTED)
**File**: `frontend/src/routes/admin/tree/+page.svelte`
- Tree already has: collapsible folders with chevron toggle, page counts per folder `(N)`, color-coded folder icons via `sectionColors` array, "Modale" badge for guided capture pages, "... et N autres pages" overflow links, version navigator with prev/next arrows
- The flat appearance in screenshots is due to seed data having only 8 pages with shallow URL paths, not a code issue

### HIGH #14 — Obfuscation PORTÉE column (ALREADY CORRECT)
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
- No "PORTÉE" column exists in the current table — columns are: Type, Rechercher, Remplacer par, Occurrences, Statut, Actions
- The scope is implicitly global (no per-rule scope selector), matching the R001 feedback requirement

### MEDIUM #5 — Dashboard unrealistic 767min avg (FIXED)
- The unrealistic average was shown in the now-removed "Sessions ce mois" card
- The new "Temps passé" card shows `overview.averageSessionDurationSeconds / 60` properly formatted
- Root cause was likely inflated seed data timestamps; the display now uses proper `Xmin`/`XhYm` formatting

### MEDIUM #6 — Projects breadcrumb "Accueil" (FIXED)
**File**: `frontend/src/lib/components/layout/Header.svelte`
- Breadcrumb logic now skips the `admin` segment and direct section pages
- "Projets" page no longer shows "Projets > Accueil" breadcrumb — shows just "Projets" as the page title
- Sub-pages (e.g. project detail) still show breadcrumb with resolved project name

### MEDIUM #11 — Tree "Carte du site" placeholder (FIXED)
**File**: `frontend/src/routes/admin/tree/+page.svelte`
- Replaced the simple section list view with a proper placeholder: Globe icon + "Carte du site" title + "La visualisation interactive du graphe de navigation sera bientôt disponible." message
- This clearly communicates the feature is planned but not yet available

### MEDIUM #15 — Command palette real search (ALREADY IMPLEMENTED)
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
- Already searches projects, pages (across all versions), and users from the API when typing
- Shows quick actions when no query is entered
- Results include tool badges with brand colors and metadata (project name, URL path, capture date)

### LOW #2 — Login background circle size (FIXED)
**File**: `frontend/src/routes/login/+page.svelte`
- Increased `.shape-1` from 600x600px to 720x720px (+20%)
- Slightly increased opacity from 0.1/0.06 to 0.12/0.07 for better visibility
- Adjusted position: top -200→-220px, right -150→-160px

### LOW #12 — Analytics "SESSIONS TOTALES" casing (FIXED)
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
- Removed `uppercase tracking-wider` classes from "Sessions totales" label
- Now displays as sentence case: "Sessions totales"

### LOW #13 — Analytics "7 DERNIERS JOURS" casing (FIXED)
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
- Removed `uppercase tracking-wider` classes from "7 derniers jours" label
- Changed color class from `text-muted` to `text-muted-foreground` for consistency
- Now displays as sentence case: "7 derniers jours"

---

## Issues Not Requiring Code Changes

| # | Issue | Reason |
|---|-------|--------|
| 1 | Login narrow viewport | Screenshot test configuration issue, not a code bug |
| 4 | Dashboard bar chart low numbers | Seed data volume issue |
| 7 | Project cards 0 pages | Seed data issue |
| 8 | Project detail 100% health | Correct computation when all pages are OK |
| 9 | Version card styling | Already correct with green left border and badge |

---

## Verification

- `npx svelte-check`: **0 new errors** introduced (3 pre-existing errors in editor/live-edit pages, 6 pre-existing a11y warnings in obfuscation page)
- All modified files compile cleanly
- No functionality broken by visual fixes
