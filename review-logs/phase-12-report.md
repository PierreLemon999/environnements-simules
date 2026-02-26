# Phase 12 — Page Editor & Live Edit Review

## Features Tested

### Page Editor (`/admin/editor/:pageId`)

#### HTML Tab
- Three-panel layout: 48px icon sidebar + 280px page list + main editor
- Page list sidebar with search, page icons, and active highlight
- Code editor textarea with dark theme, line numbers, and syntax-like styling
- Toolbar row with Format, Undo, Redo, Search buttons
- Bottom status bar: line/column position, HTML badge, UTF-8, file size, save buttons
- "Enregistrer" and "Enregistrer et prévisualiser" in bottom bar
- Cursor position tracking (updates line/col on click and keyup)

#### Links Tab (Liens)
- Source page header showing page icon, title, and URL path
- Grouped tree view: links categorized into Navigation, Content, External groups
- Collapsible groups with ChevronDown toggle and link count badges
- Per-link cards showing anchor text, URL, mapped status badge
- Target page dropdown for link mapping
- Right-side mini map panel (visible on xl+ screens) with SVG connectors and summary stats
- Bottom bar with link statistics (total detected, mapped, unmapped)

#### JavaScript Tab
- Warning banner about disabled scripts affecting page behavior
- Card-based layout for each detected script (inline/external)
- Toggle switches for enabling/disabling individual scripts
- Script source preview and verified badges
- Add Script section with code input and "Ajouter un script" button

#### Top Toolbar
- Tab navigation: HTML, Liens (with link count badge), JavaScript
- Page name display next to tabs
- Preview and back-to-tree buttons
- Responsive layout without truncation

### Live Edit (`/admin/live-edit/:pageId`)
- Three-mode interface: Édition, Validation, Prévisualisation
- Full-page iframe rendering captured HTML content
- Edit mode with visual overlay and click-to-select editing
- Validation scanner with accessibility/performance/SEO checks
- Preview mode showing clean rendered page
- Page info header with title and URL

### Backend API
- `GET /api/pages/:id` — page metadata with title, URL path, status
- `GET /api/pages/:id/content` — raw HTML content of captured page
- `PATCH /api/pages/:id/content` — save edited HTML content
- `GET /api/versions/:id/pages` — list pages in a version (used for sidebar)

## Issues Found & Fixed

### 1. Missing HTML editor toolbar — SEVERITY: High
**Problem:** The HTML tab had no toolbar for Format, Undo, Redo, or Search. The mockup shows a dedicated row with these editing controls.
**Fix:** Added a toolbar row below the tabs with Format (AlignLeft icon), Undo (Undo2 icon), Redo (Redo2 icon), and Search (Search icon) buttons styled as ghost icon buttons with divider separators.

### 2. Missing bottom status bar — SEVERITY: High
**Problem:** No status bar at the bottom of the editor showing cursor position, encoding, and file info. The mockup shows "Ligne X, Col Y | HTML | UTF-8 | size".
**Fix:** Added a bottom bar with:
- Live cursor position tracking (line and column)
- HTML language badge
- UTF-8 encoding indicator
- File size display (computed from content length)
- Moved "Enregistrer" and "Enregistrer et prévisualiser" buttons to the bottom bar

### 3. Links tab: flat table instead of grouped tree view — SEVERITY: High
**Problem:** Links tab showed a simple flat HTML table listing all links. The mockup uses a grouped tree view with collapsible sections (Navigation, Contacts & Relations, External) and per-link mapping dropdowns.
**Fix:** Complete rewrite of the Links tab:
- Added link grouping logic categorizing links into Navigation (same-domain internal), Content (relative paths), and External groups
- Collapsible group headers with toggle chevron, group name, and link count badge
- Individual link cards with anchor text, URL, mapped/unmapped status badges
- Target page dropdown selector for link mapping
- Right-side mini map panel (xl+ screens) with SVG connector visualization and summary stats
- Bottom bar with link statistics

### 4. JavaScript tab: flat table instead of card layout — SEVERITY: Medium
**Problem:** JS tab showed a basic table with rows for each script. The mockup uses individual cards with toggle switches and action buttons.
**Fix:** Rewrote JS tab with:
- Warning banner about script behavior impact
- Card-based layout for each script with toggle on/off switches
- Script type indicators (inline vs external) with verified badges
- Source code preview area
- "Ajouter un script" section at bottom

### 5. Toolbar buttons truncated — SEVERITY: Medium
**Problem:** Right-side toolbar buttons (Preview, Back to tree) were cut off/invisible when the window wasn't wide enough, due to competing elements in the toolbar.
**Fix:** Simplified the top toolbar:
- Removed duplicate "Enregistrer et prévisualiser" from top bar (moved to bottom bar)
- Removed "Personnaliser" button (not in mockup)
- Shortened "Retour à l'arborescence" to "Retour" (with icon)
- Ensured flex-shrink-0 on action buttons to prevent truncation

### 6. Live-edit breadcrumb shows "live-edit" — SEVERITY: Low
**Problem:** The Header breadcrumb showed the raw URL segment "live-edit" instead of a French label.
**Fix:** Added `'live-edit': 'Édition en direct'` to the `segmentLabels` map in `Header.svelte`.

### 7. Missing link count badge on tab — SEVERITY: Low
**Problem:** The "Liens" tab had no count indicator. Mockup shows the number of detected links next to the tab label.
**Fix:** Added a badge showing `detectedLinks.length` next to "Liens" tab text when links are detected.

### 8. Missing page name in editor header — SEVERITY: Low
**Problem:** No indication of which page was being edited (only visible in sidebar selection).
**Fix:** Added page name display next to the tab bar, showing the page title from the loaded metadata.

## Files Modified

### Frontend
- `frontend/src/routes/admin/editor/[id]/+page.svelte` — Complete rewrite of editor page: added HTML toolbar, bottom status bar, grouped links tree view with mini map, JS card layout with toggles, fixed toolbar layout, added cursor tracking, link grouping logic, page name display
- `frontend/src/lib/components/layout/Header.svelte` — Added `'live-edit': 'Édition en direct'` to segmentLabels

## Test Results

All 5 Playwright functional tests pass:
- ✅ Editor page — HTML tab loads with code editor and toolbar
- ✅ Editor page — Links tab accessible with grouped view
- ✅ Editor page — JavaScript tab accessible with card layout
- ✅ Live edit page — Iframe loads with captured page content
- ✅ Editor save — Content modification and save button functional

API verification:
- ✅ `GET /pages/:id` — returns page metadata
- ✅ `GET /pages/:id/content` — returns HTML content (4136 chars for test page)
- ✅ `PATCH /pages/:id/content` — saves modified content successfully
- ✅ `GET /versions/:id/pages` — returns page list for sidebar

## Remaining Items (Non-blocking)

- **Mini map SVG connectors** — The right-side mini map shows placeholder connector lines. Real link-to-page mapping visualization would require actual page layout data to draw accurate connections.
- **Link mapping persistence** — The target page dropdown in the links tab updates locally but doesn't persist mapping via API. Would need a new endpoint like `POST /api/pages/:id/link-mappings`.
- **Script toggle persistence** — Toggle switches update locally but don't persist. Would need a new endpoint for script configuration.
- **Format button** — Displays in toolbar but no HTML formatter is wired up. Could integrate a library like `js-beautify` for HTML formatting.
- **Undo/Redo** — Toolbar buttons are present but rely on native textarea undo. A proper undo stack could be implemented for more reliable behavior.
- **Smart Link detection** — Mockup shows a "Smart Link" button for intelligent link detection. Current implementation uses regex-based link extraction which covers most cases.
- **Syntax highlighting** — Editor uses a dark-themed textarea with monospace font but not true syntax highlighting. A library like CodeMirror or Monaco could be integrated for full syntax support.
