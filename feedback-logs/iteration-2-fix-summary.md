# Iteration 2 — Fix Summary

**Date**: 2026-02-25
**Fixer**: Claude (automated)
**Issues file**: `feedback-logs/iteration-2-issues.md`

---

## Results

| Severity | Total | Fixed | Skipped | Notes |
|----------|-------|-------|---------|-------|
| CRITICAL | 1     | 1     | 0       | |
| HIGH     | 12    | 11    | 1       | Login tab issue (02/03 screenshots) is a test harness artifact, not a code bug |
| MEDIUM   | 10    | 10    | 0       | |
| LOW      | 6     | 4     | 2       | Users page + settings page have no mockup to compare |

**svelte-check**: 3 errors (all pre-existing in `editor/[id]` and `live-edit/[id]` — not introduced by these fixes), 6 a11y warnings (pre-existing in obfuscation page).

---

## Fixes by File

### `frontend/src/routes/admin/+page.svelte` (Dashboard)

- **[CRITICAL] Negative duration**: Applied `Math.max(0, Math.round(...))` to `averageSessionDurationSeconds` before formatting
- **[HIGH] Layout mismatch**: Removed the "Projets" section entirely. Replaced with proper "Journal d'activité des clients" table with columns: CLIENT, OUTIL, DÉMO, ACTION, PAGES CONSULTÉES, TEMPS PASSÉ, DATE
- **[HIGH] Tab counts**: Added session count badges to activity log tabs
- **[MEDIUM] Stat card hover**: Added top-border gradient effect on hover for stat cards

### `frontend/src/lib/components/layout/Header.svelte`

- **[HIGH] Nouveau projet button**: Made conditional — only shows on `/admin/projects` path
- **[HIGH] Breadcrumb UUID**: Added async project name resolution with cache. Breadcrumb now shows project name instead of raw UUID on `/admin/projects/:id`
- Added HelpCircle icon button, "components" to breadcrumb label map

### `frontend/src/lib/components/layout/Sidebar.svelte`

- **[HIGH] Composants nav item**: Added "Composants" with Blocks icon in GESTION section
- **[HIGH] Badge counts**: Added dynamic badge counts from API (projects, sessions, update requests)
- **[HIGH] Tool page counts**: Added page count numbers next to tool names in OUTILS SIMULÉS
- **[LOW] Online status dot**: Added green status dot on avatar
- Added "Lemon Learning" subtitle under branding

### `frontend/src/routes/admin/tree/+page.svelte` (Tree View)

- **[HIGH] Carte du site tab**: Added third "Carte du site" tab with section-based page visualization
- **[HIGH] Tab naming**: Renamed "Par site" → "Arborescence", "Par guide" → "Liste"
- **[HIGH] Modal badge**: Added "Modale" dashed badge for guided capture pages
- **[HIGH] Error indicator**: Added red left border for pages with `healthStatus === 'error'`
- Added "... et X autres pages" collapsed indicator for folders with >20 children

### `frontend/src/routes/admin/analytics/+page.svelte`

- **[HIGH] Date range picker**: Added date range picker button in header
- **[MEDIUM] Session count badges**: Added session count badges to "Admins & Commerciaux" and "Clients" card titles

### `frontend/src/routes/login/+page.svelte`

- **[MEDIUM] Background color**: Changed from blue-tinted gradient to neutral `#fafafa`
- **[MEDIUM] Shape animation**: Added opacity keyframes to `shapeFloat` animation

### `frontend/src/routes/admin/invitations/+page.svelte`

- **[MEDIUM] Button text**: Changed "Nouvelle invitation" → "Nouvel accès"

### `frontend/src/routes/admin/obfuscation/+page.svelte`

- **[MEDIUM] Missing columns**: Added PORTÉE and OCCURRENCES columns to the rules table (replacing TYPE column)
- **[MEDIUM] Badge count**: Verified badge is already dynamically calculated from `rules.filter(r => r.isActive).length`
- **[MEDIUM] Global toggle**: Added "Appliquer globalement" toggle in header
- **[MEDIUM] Project selector**: Restyled as pill badge with green status dot

### `frontend/src/lib/components/layout/CommandPalette.svelte`

- **[MEDIUM] Tab count badges**: Added dynamic count badges to category tabs
- **[MEDIUM] Keyboard shortcuts**: Action items now display their shortcuts as `<kbd>` badges
- **[MEDIUM] Footer hints**: Added "Tab Catégorie" hint and "EnvSim" branding to footer
- Added Tab key support to cycle through categories

### `frontend/src/routes/admin/projects/+page.svelte`

- **[LOW] Hover lift**: Added `hover:-translate-y-0.5 hover:shadow-md transition-all duration-200` to project cards

### `frontend/src/app.html`

- **[LOW] Inter font**: Added Google Fonts preconnect + Inter font stylesheet
- **[LOW] Title encoding**: Fixed "Simules" → "Simulés"

---

## Skipped Issues

1. **[HIGH] Login page tabs (screenshots 02/03)**: The screenshots showing old tab-based login were captured from a stale test state. The actual `+page.svelte` code has already been rewritten to the correct unified design. This is a test harness issue, not a code bug.
2. **[LOW] Users page**: No mockup exists for comparison. Current implementation looks clean.
3. **[LOW] Settings page**: No mockup exists. Not mentioned in issues.
