# Phase 11 — Analytics Dashboard Review

## Features Tested

### Overview Tab (Vue générale)
- 3 stat cards: Sessions totales, Utilisateurs uniques, Temps moyen/session
- Sparkline mini-charts in each card
- Two side-by-side tables: Admins & Commerciaux / Clients
- "Sessions par jour" stacked bar chart with period selector (7j/14j/30j)
- Tab navigation: Vue générale, Par client, Par outil, Guides
- Top-right controls: En direct indicator, project filter dropdown, date range

### Par client / Par outil Tabs
- Sessions récentes table with search and CSV export
- User type badges (Admin/Client)
- Status badges (En cours/Terminée)
- Click-to-detail on each row

### Guides Tab
- Guide stat cards: Guides lancés, Guides terminés, Taux de complétion
- Guide detail table with completion progress bars

### Session Detail Panel
- Right-side panel opens on row click
- User info with avatar and role badge
- Circular engagement score gauge (SVG ring)
- Session metrics grid (Durée, Événements, Début, Fin)
- Activity timeline with event icons

### Backend API
- `GET /api/analytics/overview` — aggregated stats
- `GET /api/analytics/sessions` — enriched session list
- `GET /api/analytics/sessions/:id` — session detail with events
- `GET /api/analytics/guides` — guide statistics
- `POST /api/analytics/events` — event recording (public)

## Issues Found & Fixed

### 1. Missing "Outil" (Tool) column — SEVERITY: Medium
**Problem:** Both the Admin and Client tables were missing the "Outil" column that the mockup shows with colored dots and tool names (Salesforce, ServiceNow, etc.)
**Root cause:** Backend sessions endpoint did not enrich sessions with version→project data.
**Fix:**
- Backend (`analytics.ts`): Added version→project enrichment to both `/sessions` and `/sessions/:id` endpoints. Now returns `version: { id, name, project: { id, name, toolName } }`.
- Frontend: Added `version` field to Session/SessionDetail interfaces. Added "Outil" column to both Admin and Client tables with colored dot indicators using known tool colors.

### 2. Bar chart bars invisible — SEVERITY: High
**Problem:** The "Sessions par jour" bar chart showed only thin lines instead of visible bars, even when data was present.
**Root cause:** Bars used CSS percentage heights (`height: {cH}%`) inside a flex container without explicit height, causing percentage-based sizing to fail.
**Fix:** Rewrote bar chart to use pixel-based heights calculated from `barHeight = 150px`. Bars now render at correct proportional height with `Math.max(px, 4)` minimum.

### 3. Bar chart legend colors inverted — SEVERITY: Low
**Problem:** Chart legend showed "Admin" (primary blue) and "Client" (orange/warning), but mockup uses primary blue for Clients and pale blue for Admins.
**Fix:** Swapped colors — Clients now use `bg-primary` (blue) and Admins use `bg-blue-200` (pale blue). Updated legend labels to "Clients" and "Admins & Commerciaux" with total counts.

### 4. Default bar chart period — SEVERITY: Low
**Problem:** Default period was 7 days, mockup shows 14 days.
**Fix:** Changed `barChartPeriod` default from 7 to 14.

### 5. Missing pagination in tables — SEVERITY: Low
**Problem:** Tables showed only first 10 rows with no pagination. Mockup shows pagination footer with page numbers.
**Fix:** Added pagination state (7 items per page) with "Affichage X-Y sur Z" footer and page navigation buttons for both Admin and Client tables.

### 6. Client avatar color mismatch — SEVERITY: Low
**Problem:** Client avatars used `bg-warning/10 text-warning` (orange), mockup uses purple for prospect avatars.
**Fix:** Changed to `bg-purple-100 text-purple-600` for client table avatars.

### 7. Visit bar styling — SEVERITY: Low
**Problem:** Visit progress bars all used `bg-primary`, mockup shows conditional coloring (high=blue, mid=amber, low=muted).
**Fix:** Added conditional coloring based on visit percentage threshold.

### 8. Today highlight on bar chart — SEVERITY: Low
**Problem:** Last day label in bar chart not highlighted.
**Fix:** Added `isToday` check — last day label now shows in blue bold text.

### 9. Added chart legend footer — SEVERITY: Low
**Problem:** Bar chart had no summary below it. Mockup shows a legend with total counts.
**Fix:** Added border-top separated legend showing "Clients N" and "Admins & Commerciaux N" with dot + count.

## Files Modified

### Backend
- `backend/src/routes/analytics.ts` — Added `projects` import, version→project enrichment in `/sessions` and `/sessions/:id`

### Frontend
- `frontend/src/routes/admin/analytics/+page.svelte` — Added version to interfaces, Outil column in both tables, pagination, bar chart fix (pixel heights), legend colors, avatar colors, chart legend footer

## Test Results

All 4 Playwright functional tests pass:
- ✅ Overview tab — all key elements visible
- ✅ Tab switching — Par client and Guides tabs work
- ✅ Session detail panel — opens with engagement score, activity timeline
- ✅ CSV export buttons — present and functional

API verification:
- ✅ `GET /analytics/overview` — returns correct aggregated stats
- ✅ `GET /analytics/sessions` — returns sessions enriched with version/project/tool info
- ✅ `GET /analytics/sessions/:id` — returns full detail with events and version info
- ✅ `GET /analytics/guides` — returns guide stats with play/completion counts

## Remaining Items (Non-blocking)

- **Date range picker is static** — shows "01 fév — 24 fév 2026" as a button but doesn't open a picker. The mockup shows this as a static display too, so this is acceptable.
- **Project filter dropdown** — Renders and populates with projects from API but doesn't filter session data. Would need additional filtering logic.
- **Sorting columns** — Mockup shows sort indicators on column headers. Current implementation doesn't support column sorting. Low priority.
- **"Par outil" tab** — Currently shows the same sessions table as "Par client". Could be enhanced with tool-grouped view.
