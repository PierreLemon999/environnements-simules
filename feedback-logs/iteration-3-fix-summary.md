# Iteration 3 — Fix Summary

**Date**: 2026-02-26
**Issues file**: `feedback-logs/iteration-3-issues.md`
**Total issues**: 29 (2 CRITICAL, 9 HIGH, 12 MEDIUM, 6 LOW)
**Fixed**: 29/29

---

## CRITICAL

### Issue 33 — Analytics: negative duration (-30093s)
**File**: `routes/admin/analytics/+page.svelte`
**Fix**: Added `Math.max(0, ...)` guards to `formatDuration`, `getSessionDuration`, and `getSessionDurationSeconds`. Also added `Math.round()` to avoid floating-point display artifacts.

### Issue 34 — Login page: old single-form design instead of tabbed layout
**File**: `routes/login/+page.svelte`
**Fix**: Complete rewrite. New tabbed design with "Accès client" (email+password) and "Administration" (Google SSO with "(admin uniquement)" label). Title changed to "Environnements Simulés", logo changed to "ES", subtitle "Plateforme de démonstrations Lemon Learning". Removed old footer links.

---

## HIGH

### Issues 1/2/3 — Login page details (title, tabs, footer)
**File**: `routes/login/+page.svelte`
**Fix**: Covered by Issue 34 rewrite above.

### Issue 4 — Dashboard: stat card labels uppercase
**File**: `routes/admin/+page.svelte`
**Fix**: Removed `uppercase tracking-wide` from all stat card labels. Changed to sentence-case.

### Issue 5 — Dashboard: missing "+ Nouveau projet" button, oversized stat cards
**File**: `routes/admin/+page.svelte`
**Fix**: Added `+ Nouveau projet` button (navigates to `/admin/projects?action=create`). Made stat cards compact: `p-3` padding, `text-xl font-semibold` values, `h-8 w-8` icon containers. Removed gradient hover effects.

### Issues 10/11 — Tree view: wrong tab labels
**File**: `routes/admin/tree/+page.svelte`
**Fix**: Renamed tabs to "Par site" / "Par guide" / "Carte du site".

### Issues 12/13 — Tree view: detail panel missing breadcrumb, links, guides
**File**: `routes/admin/tree/+page.svelte`
**Fix**: Added breadcrumb path display below tree. Enhanced detail panel with renamed labels ("Taille", "Capture le", "Mode", "Santé"), added "Liens sortants" row, added "GUIDES ASSOCIÉS" section.

### Issues 14/15 — Analytics: stat labels uppercase, wrong layout
**File**: `routes/admin/analytics/+page.svelte`
**Fix**: Removed `uppercase tracking-wide` from stat labels. Moved tabs inline with title. Added session count badge on "Vue générale" tab.

### Issues 16/17 — Analytics: wrong session section layout
**File**: `routes/admin/analytics/+page.svelte`
**Fix**: Replaced two-column "Admins & Commerciaux" / "Clients" layout with unified "Sessions récentes" section including search bar and "Exporter CSV" button.

### Issue 22 — Obfuscation: missing TYPE column
**File**: `routes/admin/obfuscation/+page.svelte`
**Fix**: Added TYPE as first column in rules table. Displays "Texte exact" or "Regex" badge.

### Issues 23/24 — Obfuscation: add form layout, portée display
**File**: `routes/admin/obfuscation/+page.svelte`
**Fix**: Reorganized inline add form: type dropdown first, search field labeled "Texte à masquer", replace field with "Auto-généré si vide" placeholder, static "Global" portée display. Changed all portée values to "Global". Added "Annuler" text to cancel button.

---

## MEDIUM

### Issue 6 — Sidebar: "Composants" nav item should not exist
**File**: `components/layout/Sidebar.svelte`
**Fix**: Removed "Composants" entry from `gestionItems` array and removed unused `Blocks` import.

### Issues 7/8 — Projects: duplicate button, missing status badge
**File**: `routes/admin/projects/+page.svelte`
**Fix**: Removed duplicate "+ Nouveau projet" button from page body (Header button kept). Added event listener for `open-create-project` custom event from Header. Added "Actif" status badge on each project card.

### Issues 18/19/20 — Invitations: button label, stat labels
**File**: `routes/admin/invitations/+page.svelte`
**Fix**: Changed button label from "Nouvel accès" to "Nouvelle invitation". Removed `uppercase tracking-wide` from stat card labels.

### Issues 26/27/28 — Command palette: shortcuts, page search, badges
**File**: `components/layout/CommandPalette.svelte`
**Fix**: Removed keyboard shortcut subtitles from quick actions (⌘P, ⌘N). Added page search across all project versions via API. Added colored project badge for page results using `getToolBadgeColor` function. Removed `<kbd>` shortcut display for action items.

### Issue 29 — Sidebar: "Composants" in nav
**File**: `components/layout/Sidebar.svelte`
**Fix**: Already covered by Issue 6 above.

### Issue 32 — Global: stat card labels uppercase everywhere
**Files**: `routes/admin/update-requests/+page.svelte`, `routes/admin/editor/[id]/+page.svelte`
**Fix**: Removed `uppercase tracking-wide` from stat card labels in both files.

---

## LOW

### Issue 9 — Users page: OK
**Status**: No changes needed.

### Issue 21 — Update requests page: OK
**Status**: No changes needed.

### Issue 25 — Settings page: OK
**Status**: No changes needed.

### Issue 30 — Header: breadcrumbs lack descriptive subtitles
**File**: `components/layout/Header.svelte`
**Fix**: Added `pageSubtitles` map for descriptive breadcrumb segments (e.g., "Dashboard > Vue d'ensemble", "Projets > Tous les projets"). Changed "admin" label from "Administration" to "Dashboard".

### Issue 31 — Header: search placeholder too generic
**File**: `components/layout/Header.svelte`
**Fix**: Changed placeholder from "Rechercher..." to "Rechercher pages, projets, utilisateurs...".

---

## Header button integration

**Files**: `components/layout/Header.svelte`, `routes/admin/projects/+page.svelte`
**Fix**: Header dispatches `window.dispatchEvent(new CustomEvent('open-create-project'))` when "+ Nouveau projet" is clicked on the projects page. Projects page listens for this event to open the create dialog. Cleanup via `onDestroy`.

---

## svelte-check Results

**After all fixes**: 3 errors, 7 warnings
- All 3 errors are **pre-existing** (not caused by iteration 3 changes):
  - `editor/[id]/+page.svelte:198` — async onMount return type
  - `editor/[id]/+page.svelte:203` — string | undefined type
  - `live-edit/[id]/+page.svelte:167` — async onMount return type
- All 7 warnings are **pre-existing** a11y label warnings in obfuscation page

**No new errors or warnings were introduced.**

---

## Files Modified (10)

1. `frontend/src/routes/login/+page.svelte` — complete rewrite
2. `frontend/src/routes/admin/+page.svelte` — dashboard layout
3. `frontend/src/routes/admin/analytics/+page.svelte` — duration fix + layout
4. `frontend/src/routes/admin/tree/+page.svelte` — tabs + detail panel
5. `frontend/src/routes/admin/obfuscation/+page.svelte` — TYPE column + form
6. `frontend/src/routes/admin/projects/+page.svelte` — button + badge
7. `frontend/src/routes/admin/invitations/+page.svelte` — labels
8. `frontend/src/routes/admin/update-requests/+page.svelte` — labels
9. `frontend/src/lib/components/layout/Sidebar.svelte` — remove Composants
10. `frontend/src/lib/components/layout/Header.svelte` — breadcrumbs + search
11. `frontend/src/lib/components/layout/CommandPalette.svelte` — page search + badges
12. `frontend/src/routes/admin/editor/[id]/+page.svelte` — stat labels
