# Phase 13 — Demo Viewers Review

## Features Tested

### Backend Demo Serving API

- `GET /api/demo/:subdomain/` — Resolves project by subdomain, finds active version, serves index page HTML
- `GET /api/demo/:subdomain/:path` — Serves specific page by URL path with fallback chain (exact match → index → home → dashboard → first page)
- Obfuscation pipeline — Rules applied sequentially (plain text and regex) to HTML content before serving
- Link rewriting — Internal hrefs and form actions rewritten to `/demo/:subdomain/:urlPath`
- Tag manager injection — Custom `<script>` injected before `</body>` when active for the project
- Content headers — Correct `Content-Type: text/html`, `Cache-Control: public, max-age=3600`
- 7 projects seeded, Salesforce has 8 pages with active version

### Commercial Viewer (`/demo/[...path]`)

- Full-screen iframe loading demo content via `/demo-api/` proxy
- Tongue tab at top center — small dark tab with "LL" text and chevron, toggles dropdown card
- Dropdown card from top center with slide animation (cardDropIn/cardSlideOut)
- Card header: LL Demo logo, project name (e.g. "Salesforce — Accueil"), activity indicator ("il y a 2 min"), version badge ("Lightning v2024.1"), close button
- Search bar inside card
- 3×2 action grid: Partager (primary blue), Copier l'URL, Vue client, Paramètres, 3 en ligne (green dot), Rechercher
- Share view inside card: back navigation, "Partager le lien" title, URL input, duration selector (7 jours), password toggle, "Copier le lien de partage" button
- LL badge at bottom-right (48px yellow circle, pulseGlow animation)
- Toast notifications for copy actions
- Click-outside-to-close behavior on dropdown card
- Admin auth required (JWT token in localStorage)

### Prospect Viewer (`/view/[...path]`)

- Full-screen iframe loading demo content via `/demo-api/` proxy
- LL badge at bottom-right (48px yellow circle, pulseGlow animation)
- No toolbar, no controls, no info panel — pure demo viewing experience
- Token-based access verification (checks `demo_token` in URL or localStorage)
- Loading state and error handling for failed page loads

## Issues Found & Fixed

### 1. Commercial viewer: permanent top toolbar instead of tongue tab — SEVERITY: High
**Problem:** The commercial viewer had a permanent dark toolbar (`bg-[#1a1a2e]`) fixed at the top of the screen with navigation buttons, project selector dropdown, and action icons. The mockup v5 specifies a minimal tongue tab at top center that opens a floating dropdown card on click.
**Fix:** Complete rewrite of `frontend/src/routes/demo/[...path]/+page.svelte`. Removed the permanent toolbar and replaced it with a tongue tab (44px × 28px dark rounded-b tab centered at top) that toggles a dropdown card on click.

### 2. Commercial viewer: floating card position and layout wrong — SEVERITY: High
**Problem:** The action card was positioned at bottom-right corner and used a 4-column action grid. The mockup shows the card dropping from top center with a 3×2 (3-column, 2-row) action grid.
**Fix:** Repositioned the card to drop from top center (left: 50%, transform: translateX(-50%)), applied `grid-template-columns: repeat(3, 1fr)` for the 3×2 layout, and added cardDropIn/cardSlideOut CSS animations.

### 3. Commercial viewer: share was a separate dialog — SEVERITY: Medium
**Problem:** Clicking "Partager" opened a separate modal dialog overlay. The mockup shows the share UI as an alternate view inside the same dropdown card, with a back arrow to return to the main action grid.
**Fix:** Implemented share as a card view state (`showShare` flag). Clicking the Partager tile sets `showShare = true`, showing the share form inside the same card. A back arrow returns to the main grid. Share view includes URL input, duration selector, password toggle, and copy button.

### 4. Commercial viewer: missing card header elements — SEVERITY: Medium
**Problem:** The dropdown card was missing the LL Demo logo, project activity indicator, and version badge that the mockup specifies in the card header.
**Fix:** Added card header with: LL Demo SVG logo (16px circle + "LL Demo" text), project name and current page title, "il y a 2 min" activity indicator, version badge ("Lightning v2024.1"), and close button.

### 5. Prospect viewer: had toolbar and info panel — SEVERITY: High
**Problem:** The prospect viewer included a hover toolbar at top-right with "Guides", "Plein écran", and "Info" buttons, plus an expandable info panel showing "Environnement de démo" details and a fullscreen toggle. The mockup v4 specifies only a full-screen demo with an LL badge — no controls at all.
**Fix:** Complete rewrite of `frontend/src/routes/view/[...path]/+page.svelte`. Removed all toolbar, info panel, expanded widget, and fullscreen toggle code. Kept only the full-screen iframe and the LL badge at bottom-right.

### 6. Prospect viewer: expandable widget not in mockup — SEVERITY: Medium
**Problem:** There was an expandable widget overlay showing demo metadata (project name, description, version info) that is not present in the mockup.
**Fix:** Removed entirely as part of the prospect viewer rewrite.

### 7. LL badge styling mismatch — SEVERITY: Low
**Problem:** The LL badge used different sizing and colors than specified in the mockup (48px, #fbbf24 yellow, with pulseGlow animation).
**Fix:** Both viewers now use consistent LL badge styling: 48px circle, `background: #fbbf24`, white "LL" text (16px bold), with pulseGlow box-shadow animation matching the mockup specification.

## Files Modified

### Frontend
- `frontend/src/routes/demo/[...path]/+page.svelte` — Complete rewrite: replaced permanent toolbar with tongue tab + dropdown card design (v5 mockup), 3×2 action grid, share view inside card, LL badge, toast notifications, CSS animations
- `frontend/src/routes/view/[...path]/+page.svelte` — Complete rewrite: simplified to full-screen iframe + LL badge only (v4 mockup), removed toolbar/info panel/widget

## Test Results

All 3 Playwright E2E tests pass:
- ✅ Commercial viewer: tongue tab + dropdown card (7.5s)
- ✅ Commercial viewer: share view inside card (7.1s)
- ✅ Prospect viewer: full screen + LL badge only (5.9s)

Backend API verification:
- ✅ `GET /api/demo/salesforce/` — returns HTML content with obfuscation applied
- ✅ 7 projects accessible, Salesforce has 8 captured pages
- ✅ Obfuscation rules applied (e.g., "Acme Corporation" → "Entreprise Demo")
- ✅ X-Frame-Options: SAMEORIGIN — works correctly with same-origin /demo-api/ proxy

Screenshot verification:
- ✅ Commercial viewer initial state: tongue tab visible at top center, full-screen iframe, LL badge bottom-right
- ✅ Commercial viewer card open: dropdown card from top center with correct header, 3×2 action grid
- ✅ Commercial viewer share: share form inside card with URL input, duration, password, copy button
- ✅ Prospect viewer: clean full-screen demo with only LL badge, no toolbar or controls

## Remaining Items (Non-blocking)

- **Search functionality** — Search bar in commercial viewer card is present but filters nothing (no backend search endpoint for demo pages)
- **Paramètres tile** — Opens no settings panel; would need a settings view for demo display preferences
- **"3 en ligne" tile** — Shows green dot but no real-time user presence system is implemented
- **Share link generation** — Copy button copies the current URL but doesn't generate actual tokenized share links via API (would need `POST /api/demo-assignments`)
- **Duration selector** — Present in share view but not wired to API for setting expiration on generated links
- **Password protection toggle** — UI toggle exists but no backend integration for password-protecting shared links
- **Activity indicator** — Shows static "il y a 2 min" text; would need real session/analytics data to show actual last activity
- **Version badge** — Shows hardcoded "Lightning v2024.1"; could fetch actual version name from API
