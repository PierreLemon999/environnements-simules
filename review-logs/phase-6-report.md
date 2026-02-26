# Phase 6 Review Report: Tree View & Page Detail

**Date:** 2026-02-26
**Reviewer:** Claude (automated)
**Mockup reference:** `maquette-tree-view-24fev26/v7/index.html`

---

## Features Tested

### Tree Panel (left)
- [x] Project selector (dropdown) — switches between all 7 projects
- [x] Version selector (footer with prev/next arrows + status badge)
- [x] Tab system: Arborescence / Liste / Carte du site
- [x] Search filter — filters tree nodes in real-time
- [x] Stats bar — shows page count, modal count, error count with colored dots
- [x] Tree structure — nested nodes with expand/collapse, health dots
- [x] Breadcrumb at bottom of tree panel (appears on page selection)
- [x] Resizable panel (drag handle between tree and detail)

### Detail Panel (right)
- [x] Top bar with breadcrumb + sub-tabs + action buttons (single row)
- [x] Sub-tabs: Aperçu, Éditeur HTML, Liens & Navigation, JavaScript
- [x] Browser frame preview with traffic light dots, URL bar, and iframe content
- [x] Placeholder views for Editor, Links, JavaScript tabs
- [x] Empty state ("Sélectionnez une page") when no page selected

### Layout
- [x] Sidebar auto-collapses to 48px icon rail on `/admin/tree`
- [x] Three-panel layout: sidebar (48px) + tree panel (~320px) + detail panel
- [x] Full viewport height usage (no scrollbar on outer page)

### API Endpoints
- [x] `GET /projects` — returns all projects with page counts
- [x] `GET /projects/:id` — returns project with versions array
- [x] `GET /versions/:id/tree` — returns nested tree structure
- [x] `GET /projects/:id/obfuscation` — returns obfuscation rules
- [x] Demo page served via `/demo-api/:subdomain/:path` for iframe preview

---

## Issues Found & Fixed

### CRITICAL — Layout broken: sidebar overlapping tree view
**Severity:** Critical
**Description:** The main admin sidebar (260px) remained fully expanded on the tree page, pushing the three-panel layout off-screen. The tree view needs the full viewport width.
**Fix:** Added route-aware auto-collapse in `frontend/src/routes/admin/+layout.svelte`:
- Added `isTreePage` derived state checking `$page.url.pathname === '/admin/tree'`
- Added `$effect` to force `collapsed = true` when on tree page

### MEDIUM — Detail panel layout didn't match mockup
**Severity:** Medium
**Description:** The detail panel used a vertical scrolling layout with stacked cards (metadata, obfuscation rules, guides). The mockup shows a single-row top bar with breadcrumb + inline sub-tabs + action buttons, then full-height content area.
**Fix:** Complete restructure of detail panel:
- Top bar: `<nav>` breadcrumb left, underlined sub-tabs center, action buttons right
- Content fills remaining height (browser preview, or placeholder for other tabs)
- Browser frame styled with traffic light dots (#ff5f57, #ffbd2e, #28c840), monospace URL bar
- Sub-tab content is full-height instead of card-based

### MEDIUM — Tree panel header didn't match mockup
**Severity:** Medium
**Description:** Tree panel had only a project dropdown, missing the compact title showing "ProjectName — VersionName" and the custom tab buttons.
**Fix:**
- Added compact header: `<h2>Salesforce CRM — Lightning v2024.1</h2>`
- Replaced shadcn Tabs with custom styled buttons (dark active pill, matching mockup)
- Replaced shadcn Input with native `<input>` for search (lighter styling)
- Added compact stats bar with colored dots (blue for pages, purple for modals, red for errors)

### MEDIUM — Tree nodes missing colored category badges
**Severity:** Medium
**Description:** The mockup shows folder nodes with colored letter badges (e.g., blue "O" for Opportunités). The implementation only had generic folder icons.
**Fix:** Added `sectionColors` and `sectionBgColors` arrays. Folder nodes now render a colored rounded square with the first letter of the folder name, matching the mockup's category icon pattern.

### LOW — Version status values inconsistent
**Severity:** Low
**Description:** Code had TypeScript type `'active' | 'test' | 'deprecated'` but DB schema uses `'draft' | 'active' | 'archived'`. Status labels were wrong.
**Fix:** Changed version status type to `string`, updated `getVersionStatusLabel` to handle `draft → 'Brouillon'` and `archived|deprecated → 'Archivée'`.

### LOW — Resize handle too prominent
**Severity:** Low
**Description:** Resize handle had `GripVertical` icon and `w-2` width, making it visually heavy.
**Fix:** Slimmed to `w-1.5` with no icon, just a hover highlight.

---

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/routes/admin/+layout.svelte` | Auto-collapse sidebar on tree page route |
| `frontend/src/routes/admin/tree/+page.svelte` | Complete rewrite: tree panel header, tabs, search, stats, colored folder badges, detail topbar with breadcrumb + sub-tabs + action buttons, browser frame preview |

---

## Remaining Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| "Carte du site" tab shows placeholder | Low | By design — graph visualization deferred to later phase |
| Éditeur HTML/Liens/JavaScript tabs show placeholders | Low | By design — detailed in separate mockup (Éditeur de Pages) |
| No pure folder nodes in seed data | Info | Tree structure from API has hybrid nodes (page + children), so colored folder badges only appear on grouping-only nodes. Seed data doesn't have these. |
| Version "Lightning v2023.2" has status `deprecated` in DB | Low | Should be `archived` per schema. Seed data inconsistency, not a code issue. |
| Liste view doesn't match mockup table layout | Low | Shows clickable list items rather than a table with columns. Acceptable for MVP. |

---

## Screenshots

- `/tmp/phase6-v2-initial.png` — Initial tree view state (no page selected)
- `/tmp/phase6-v2-detail.png` — Page selected, detail panel showing preview
- `/tmp/phase6-v2-search.png` — Search filter active ("Opport"), tree filtered

---

## Verification Summary

All core interactions work correctly:
1. **Tree loads** with correct data from API
2. **Page selection** highlights item in tree, shows detail panel with preview
3. **Search filter** correctly filters tree nodes
4. **Project selector** switches between projects and reloads tree
5. **Version selector** navigates between versions with arrows
6. **Sub-tabs** switch between preview and placeholder views
7. **Browser frame** renders actual captured page content via iframe
8. **Sidebar** auto-collapses on tree page for maximum content width
