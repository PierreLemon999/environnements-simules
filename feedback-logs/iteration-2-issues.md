# Iteration 2 — UI/UX Quality Audit

**Date**: 2026-02-25
**Auditor**: Claude (automated)
**Scope**: All 14 screenshots vs reference mockups (iteration 2 — after auth fix and login rewrite)

---

## Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 1     | Blocks usage entirely |
| HIGH     | 12    | Clearly wrong / major deviation from mockup |
| MEDIUM   | 10    | Noticeable difference from mockup |
| LOW      | 6     | Polish / minor refinement |

---

## CRITICAL ISSUES

---

## [DASHBOARD — Stats Cards] — CRITICAL
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The dashboard shows a "DURÉE MOYENNE" stat card with value `-483m -59s` — a negative duration that is clearly a bug in the duration formatting logic. This is visible data corruption shown to the user.
**Expected**: A positive duration like `12m 34s` or `0m 0s` if no data. The mockup shows stat cards with clean positive values.
**Fix**: Fix the duration formatting function in the dashboard component. The `averageSessionDurationSeconds` from the API is likely negative or the formatting function is broken. Add `Math.abs()` or handle the case where sessions have no `endedAt` timestamp (resulting in negative duration calculations).

---

## HIGH ISSUES

---

## [LOGIN PAGE — Still Uses Tabs] — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Screenshots `02-login-client.png` and `03-login-admin.png` show the OLD tab-based UI with "Accès client" / "Administration" tabs, "ES" logo, and "Environnements Simulés" branding. However, screenshot `01-login.png` shows the CORRECT new unified design. This means the test captured both old and new states — the old login page (02, 03) still exists or the test navigated to a cached/different state.
**Expected**: All login screenshots should show the unified design from `01-login.png` (no tabs, "ED" logo, "Environnements de Démonstration").
**Fix**: Verify that the old tab-based login code has been fully removed. The screenshots `02-login-client.png` and `03-login-admin.png` appear to come from the OLD `+page.svelte` before the rewrite. Check if the test harness is navigating correctly and that there's no route conflict.

---

## [DASHBOARD — Layout Differs from Mockup] — HIGH
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The app dashboard has a fundamentally different layout than the mockup:
- **App**: Shows 4 stat cards in a row (PROJETS ACTIFS, PAGES CAPTURÉES, SESSIONS 7J, DURÉE MOYENNE), then a "Projets" table with project list rows, then "Journal d'activité des clients" below.
- **Mockup (R009)**: Shows only 2 stat cards at the top ("Projets actifs" + "Pages capturées"), then a "Journal d'activité des clients" section with detailed table (columns: CLIENT, OUTIL, DÉMO, ACTION, PAGES CONSULTÉES, TEMPS PASSÉ, DATE). The mockup has NO project list table on the dashboard.
**Expected**: Dashboard should match mockup layout: 2 stat cards + client activity log table (not project list).
**Fix**: Remove the "Projets" section from the dashboard. Replace with the proper "Journal d'activité des clients" table with columns matching the mockup. The stat cards should be reduced to 2 (Projets actifs, Pages capturées) or kept at 4 if the extra metrics are useful, but the mockup only has 2 visible stat cards plus empty slots.

---

## [DASHBOARD — Client Activity Log Missing Proper Table] — HIGH
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The "Journal d'activité des clients" section in the app shows simple rows with avatar + name + event count + relative time. The mockup shows a full table with columns: CLIENT (with avatar), OUTIL (tool badge), DÉMO (demo name), ACTION (action badge: Consulté, Guide complété, etc.), PAGES CONSULTÉES, TEMPS PASSÉ, DATE. The mockup also has "Toutes 24 / Sessions 16 / Guides terminés 8" tab filters with counts.
**Expected**: Proper data table with all columns from the mockup, plus tab filters with counts.
**Fix**: Rewrite the activity log section to use a proper table with the mockup's column structure. Fetch session data from `/api/analytics/sessions` and format into the table.

---

## [DASHBOARD — Missing "Composants" Nav Item] — HIGH
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The mockup sidebar GESTION section has: Utilisateurs, Obfuscation, Demandes MAJ, **Composants**, Paramètres. The app sidebar has: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres — missing "Composants".
**Expected**: A "Composants" nav item should appear in the GESTION section between "Demandes MAJ" and "Paramètres".
**Fix**: Add a `{ href: '/admin/components', label: 'Composants', icon: ??? }` entry to the `gestionItems` array in `Sidebar.svelte` (around line 37). Use an appropriate icon like `Blocks` or `Component` from lucide.

---

## [DASHBOARD — Sidebar Tool Counts Missing] — HIGH
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The mockup sidebar OUTILS SIMULÉS section shows page counts next to each tool: Salesforce 128, SAP SuccessFactors 74, Workday 52, ServiceNow 38, HubSpot 24, Zendesk 16. The app sidebar shows tool names with colored dots but NO page counts.
**Expected**: Each tool in the sidebar should show a page count number aligned to the right.
**Fix**: Fetch page counts per tool/project and display them next to each tool name in the sidebar.

---

## [DASHBOARD — Sidebar Badge Counts Missing] — HIGH
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The mockup shows badge counts on nav items: Projets (7), Analytics (24), Invitations (2), Demandes MAJ (5 in red). The app shows NO badge counts on any nav items.
**Expected**: Badge counts matching the mockup on relevant nav items.
**Fix**: Add badge props to nav items and fetch counts from the API to display them.

---

## [DASHBOARD — Header Missing Search Bar] — HIGH
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: The mockup header has a search bar "Rechercher..." with Cmd+K shortcut in the center. The app header has a search input but its styling and position may differ. More critically, the mockup header has notification icon, help icon, and "Extension" button on the right. The app appears to match this roughly but needs verification of exact placement.
**Expected**: Search bar centered in header with Cmd+K hint, matching the mockup exactly.
**Fix**: Verify header search bar triggers the command palette on click (which appears to work from screenshot 14). Ensure search bar styling matches mockup (border, rounded corners, placeholder text, Cmd+K badge).

---

## [PROJECT DETAIL — Shows UUID in Breadcrumb] — HIGH
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: The breadcrumb in the header shows the raw UUID `c56e1527-0a00-4071-8105-25322c8a8659` instead of the project name "Salesforce CRM".
**Expected**: Breadcrumb should show: Administration > Projets > Salesforce CRM (not the UUID).
**Fix**: The header breadcrumb builder should resolve project names from IDs. Pass the project name to the header component or resolve it from the URL params.

---

## [TREE VIEW — Missing "Carte du site" Tab] — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The mockup tree view has 3 tabs: "Arborescence", "Liste", "Carte du site". The app has only 2 tabs: "Par site", "Par guide". The "Carte du site" tab in the mockup shows an interactive node graph/mind map of pages with connections. This is completely missing.
**Expected**: Three tabs matching mockup: Arborescence (tree view), Liste (list), Carte du site (site map visualization).
**Fix**: Add the site map visualization tab. The mockup shows nodes connected by lines (like a mind map) with page counts per section. This is a complex feature that may use a library like D3 or a simple SVG-based layout.

---

## [TREE VIEW — Tree Structure Differs from Mockup] — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The mockup tree view shows:
- Expandable sections with page counts: Accueil (8), Contacts (14), Opportunités (18), etc.
- Modal page badges (dotted border, "Modale" label)
- Error page badges (red border)
- Status dots (green = OK, red = error) per page
- A "... et 8 autres pages" link for collapsed sections
- Breadcrumb at bottom: "Accueil / Contacts / Fiche client"

The app shows a simpler tree with just bullet points and page icons, a health bar (8 OK, 0 Avert., 0 Erreur), and no modal badges or page counts per section.
**Expected**: Rich tree matching the mockup with expand/collapse, page counts, modal badges, error indicators.
**Fix**: Enhance the tree view component to match the mockup's richer structure.

---

## [ANALYTICS — Different Layout from Mockup] — HIGH
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The app analytics page shows 4 stat cards, a bar chart "Sessions (7 derniers jours)", then two side-by-side cards "Admins & Commerciaux" and "Clients". The mockup analytics shows: a single large "Sessions totales" stat with sparkline, then below it "Admins & Commerciaux" (33 sessions) with search, and "Clients" (51 sessions) with search — both as tables. The mockup also has a session detail side panel (R004) that opens when clicking a session, showing "Score d'engagement", Role, Duration, and Parcours timeline.
**Expected**: Analytics should match mockup layout with proper session tables and detail panel.
**Fix**: Restructure the analytics page. The current bar chart is acceptable but the layout and table structure need to match the mockup. Add the session detail side panel feature.

---

## [ANALYTICS — Missing Date Range Picker] — HIGH
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The mockup shows a date range picker in the top-right: "01 fév — 24 fév 2026" with a calendar icon. The app only has a "Tous les projets" dropdown filter but no date range picker.
**Expected**: Date range picker matching the mockup.
**Fix**: Add a date range picker component in the analytics header area.

---

## MEDIUM ISSUES

---

## [LOGIN PAGE — Background Styling Differences] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte` (line 262)
**Issue**: The app background uses `linear-gradient(135deg, #f8faff 0%, #f0f4ff 50%, #f8f9fb 100%)` which has a blue-ish tint. The mockup uses `--bg: #fafafa` (neutral warm gray) with subtle blue radial gradient overlays. The overall feel differs slightly — app background is cooler/bluer, mockup is warmer/neutral.
**Expected**: Background should be neutral `#fafafa` base with subtle blue gradient overlays as in the mockup CSS.
**Fix**: Change the base background from the blue-tinted gradient to `#fafafa` and rely on the `.bg-gradient` overlays for the subtle blue touches.

---

## [LOGIN PAGE — Missing Opacity Animation on bg-shapes] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte` (CSS around line 243)
**Issue**: The mockup `shapeFloat` animation includes opacity transitions: `0%, 100% { opacity: 0.5 } ... 75% { opacity: 0.9 }`. The app's `shapeFloat` animation only does transform (translate + scale) but does NOT animate opacity. The shapes may be fully visible or invisible instead of pulsing in and out.
**Expected**: Shapes should fade in/out as they float, matching mockup animation.
**Fix**: Add `opacity` keyframes to the `shapeFloat` animation in the login page CSS.

---

## [DASHBOARD — Sidebar Logo Uses "ES" not "ED"] — MEDIUM
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The sidebar logo shows "ES" with text "Env. Simulés". The dashboard mockup shows "ES" too with "Env. Simulés" / "Lemon Learning" — so this matches the mockup. However, the login page uses "ED" / "Environnements de Démonstration". There's an inconsistency between the login branding ("ED") and the admin sidebar branding ("ES").
**Expected**: Either both should use "ED" / "Environnements de Démonstration" or both use "ES" / "Environnements Simulés". The mockup admin sidebar uses "ES" so the admin is fine, but needs decision on consistency.
**Fix**: Align branding — the mockup shows "ES" in the admin sidebar (correct in app), "ED" on login (correct in new login). This is a design decision more than a bug, but flag for review.

---

## [DASHBOARD — Missing "Nouveau projet" Button] — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The app dashboard has a "+ Nouveau projet" button in the header. The mockup dashboard does NOT have this button — it only has the Extension button, notification bell, and help icon. The "+ Nouveau projet" button appears on the Projects page in the mockup, not the Dashboard.
**Expected**: No "+ Nouveau projet" button on the Dashboard header. It should only appear on the Projects page.
**Fix**: Make the "+ Nouveau projet" button conditional — show it only on the Projects page route, not on Dashboard.

---

## [INVITATIONS — Different Layout from Mockup] — MEDIUM
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The app invitations page shows 2 stat cards + a client list table. The mockup invitations page (R004/R005) shows a much simpler layout in collapsed sidebar mode with just "Invitations envoyées" stat and minimal content. The app has a richer implementation than the mockup but the mockup may be incomplete. The button label differs: app says "+ Nouvelle invitation", mockup says "+ Nouvel accès".
**Expected**: Button label should be "+ Nouvel accès" to match the mockup.
**Fix**: Change button text from "Nouvelle invitation" to "Nouvel accès".

---

## [OBFUSCATION — Layout Differences from Mockup] — MEDIUM
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The mockup shows: project selector as a pill badge ("Salesforce — Démo Q1" with dot), "Règles auto 7" / "Manuel 3" as styled pill tabs, table columns: RECHERCHER, REMPLACER PAR, PORTÉE, OCCURRENCES, STATUT, + actions. An "Appliquer globalement" toggle at top-right. The app shows: project dropdown select, "Règles auto 1" / "Manuel" as plain tabs, table columns: RECHERCHER, REMPLACER PAR, TYPE, STATUT, ACTIONS — missing PORTÉE and OCCURRENCES columns.
**Expected**: Table should include PORTÉE and OCCURRENCES columns. Project selector should be a styled pill/badge. "Appliquer globalement" toggle should be present.
**Fix**: Add the missing table columns and the global toggle. Style the project selector as a pill badge with colored dot.

---

## [OBFUSCATION — Badge Says "3 actives" but Only 1 Rule Shown] — MEDIUM
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The header badge says "3 actives" but the table only shows 1 rule (Acme Corporation → Entreprise Demo). The count doesn't match the displayed data.
**Expected**: Badge count should match the actual number of visible/active rules.
**Fix**: Ensure the badge count is dynamically calculated from the filtered rules list, not hardcoded.

---

## [COMMAND PALETTE — Different Layout from Mockup] — MEDIUM
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The app command palette shows tabs "Tous, Pages, Projets, Utilisateurs, Actions" and an ACTIONS section with items like "Créer un projet", "Nouvelle capture", etc. The mockup command palette (R002) shows similar tabs "Tous 12, Pages 4, Projets 3, Utilisateurs 2, Actions 3" with counts, then categorized results: UTILISATEURS (Marie Cuvier, Thomas Lefebvre) and ACTIONS RAPIDES (Nouvelle capture, Créer un projet, Assigner une démo). The mockup results show descriptive subtitles and keyboard shortcuts (⌘N, ⌘P, ⌘O).
**Expected**: Tab badges should show result counts. Results should show user entries with roles and descriptions. Action items should show keyboard shortcuts.
**Fix**: Add count badges to tabs, user search results, and keyboard shortcut hints on action items.

---

## [COMMAND PALETTE — Missing Footer Hints] — MEDIUM
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The app palette footer shows "Naviguer / Ouvrir / Esc · Fermer" which approximates the mockup's "↕ Naviguer / ↵ ouvrir / tab catégorie / esc fermer / EnvSim". The mockup footer is more detailed with a tab-to-switch-category hint and an "EnvSim" branding label.
**Expected**: Footer should match mockup exactly with all keyboard hints.
**Fix**: Update footer text to include "tab catégorie" hint and "EnvSim" branding.

---

## LOW ISSUES

---

## [LOGIN PAGE — Font Loading] — LOW
**File**: `frontend/src/app.html` or `frontend/src/app.css`
**Issue**: The mockup explicitly loads Inter from Google Fonts. Need to verify the app does too. The login page looks correct in screenshots, suggesting Inter is loaded, but this should be confirmed.
**Expected**: Inter font loaded consistently.
**Fix**: Verify `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">` is in `app.html`.

---

## [DASHBOARD — Stat Card Top Border Accent Missing] — LOW
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The mockup stat cards have a colored top border that appears on hover (blue gradient for first card, green for second, purple for third, amber for fourth). The app stat cards have colored icons but may not have the hover top-border effect.
**Expected**: Subtle colored top border on hover per the mockup CSS `.stat-card:hover::after`.
**Fix**: Add `::after` pseudo-element with gradient top border that shows on hover.

---

## [PROJECTS PAGE — No Dedicated Mockup but Looks Good] — LOW
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: There is no dedicated projects list mockup, but the app's project cards page looks clean and well-structured (cards with tool avatars, descriptions, meta info). Minor issue: the cards could benefit from hover effects matching the mockup's card system (translateY(-2px) + shadow on hover).
**Expected**: Cards with hover lift effect.
**Fix**: Add `hover:translate-y-[-2px] hover:shadow-md transition-all` to project cards.

---

## [USERS PAGE — No Dedicated Mockup] — LOW
**File**: `frontend/src/routes/admin/users/+page.svelte`
**Issue**: No mockup exists for the users page, so no direct comparison is possible. The page looks clean with proper tab filtering, role badges, and auth method indicators. Looks acceptable.
**Expected**: N/A — no mockup to compare.
**Fix**: No changes needed unless a mockup is created.

---

## [UPDATE REQUESTS — No Dedicated Mockup] — LOW
**File**: `frontend/src/routes/admin/update-requests/+page.svelte`
**Issue**: No dedicated mockup for update requests page. The app shows a clean card-based layout with status badges (En attente, En cours, Terminée), action buttons, and metadata. Looks acceptable.
**Expected**: N/A — no mockup to compare.
**Fix**: No changes needed unless a mockup is created.

---

## [DASHBOARD — Collapsed Sidebar Shows Truncated Labels] — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: In the collapsed sidebar screenshot (05), the OUTILS SIMULÉS section shows truncated single letters (S, S, W) instead of clean icon-only display. The section labels "PRINCIPAL", "GESTION", "OUTILS SIMULÉS" are still partially visible as small rotated text. The mockup collapsed sidebar shows only icons with no text at all.
**Expected**: Fully clean icon-only sidebar when collapsed — no text labels, no truncated tool names.
**Fix**: Hide section labels and tool text completely when collapsed. For tools, show only the colored dot (no text).

---

## [SIDEBAR — Missing Online Status Dot on Avatar] — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The mockup user section shows a green online status dot on the avatar (bottom-right of the "ML" circle). The app avatar shows "ML" but no green online dot.
**Expected**: Small green dot on the avatar indicating online status.
**Fix**: Add `::after` pseudo-element to the avatar with a green dot and pulse animation matching the mockup CSS.

---

## PAGES NOT YET IMPLEMENTED (No Screenshot Available)

| Page | Mockup Folder | Status |
|------|--------------|--------|
| Page Editor | `maquette-page-editor-25fev26` (R004 feedback) | NOT IMPLEMENTED |
| Demo Viewer (prospect) | `maquette-demo-viewer-24fev26` (R002 feedback) | NOT IMPLEMENTED |
| Commercial Viewer | `maquette-commercial-viewer-24fev26` (R010 feedback) | NOT IMPLEMENTED |
| Settings page | No mockup | NOT IMPLEMENTED |
| Live Edit page | No mockup | Route exists but no screenshot |

---

## Summary

TOTAL_ISSUES: 29
CRITICAL: 1
HIGH: 12
MEDIUM: 10
LOW: 6

**Priority action items:**
1. **Fix negative duration display** (CRITICAL) — `-483m -59s` is user-facing data corruption
2. **Fix old login page still appearing** (HIGH) — screenshots 02/03 show the old tab-based login
3. **Rewrite dashboard layout** (HIGH x3) — remove project list, add proper activity log table, fix stat cards
4. **Add missing sidebar features** (HIGH x3) — badge counts, tool page counts, "Composants" nav item
5. **Fix project detail breadcrumb** (HIGH) — shows UUID instead of project name
6. **Enhance tree view** (HIGH x2) — add "Carte du site" tab, enrich tree structure
7. **Fix analytics layout** (HIGH x2) — restructure to match mockup, add date range picker
8. **Polish obfuscation page** (MEDIUM) — add missing columns, fix badge count
9. **Polish command palette** (MEDIUM) — add tab counts, keyboard shortcuts, footer
10. **Various LOW polish items** — hover effects, collapsed sidebar cleanup, online dot
