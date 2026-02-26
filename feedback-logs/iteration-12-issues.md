# Iteration 12 — Visual & Functional QA Report

**Date**: 2026-02-26
**Compared**: Current app screenshots vs reference mockups (latest retours/)
**Previous iteration**: 11 issues (0 CRITICAL, 2 HIGH, 5 MEDIUM, 4 LOW)

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH     | 14 |
| MEDIUM   | 13 |
| LOW      | 8 |
| **TOTAL** | **39** |

Note: This iteration includes 3 newly-captured pages (Editor, Demo Viewer, Commercial Viewer) that were NOT tested in previous iterations, accounting for most new CRITICAL/HIGH issues.

---

## LOGIN — OK

Screenshots 01-login, 02-login-filled, 02-login-client, 03-login-admin, 03-login-error all correctly implement the login page:
- Centered card with ES blue logo, "Environnements Simulés" title, "Plateforme de démonstrations Lemon Learning" subtitle
- "Accès client / Administration" tab switcher
- Email + password fields with icons
- Blue "Se connecter" button
- Google SSO on admin tab with "(admin uniquement)" — matches R007
- Error state with red banner — correct
- No footer element — matches R006 (delete request)
- Background decorative elements present

The tab-based layout (client vs admin) differs from mockup v4 which shows a single-level layout, but this was an intentional design decision made in earlier iterations and is functionally correct. The key feedback items R006 (no footer) and R007 ("admin uniquement") are both satisfied.

---

## DASHBOARD — MEDIUM

**File**: `frontend/src/routes/admin/+page.svelte`

### Issue 1 — MEDIUM: Dashboard activity tab labels differ from mockup

**Issue**: The current tabs show "Toutes 4", "Sessions", "Guides 3". The mockup R009 shows "Toutes 24", "Sessions 16", "Guides terminés 8". The third tab should be "Guides terminés" (not just "Guides"), and the Sessions tab should show a count.
**Expected**: Tab labels: "Toutes {count}", "Sessions {count}", "Guides terminés {count}"
**Fix**: In `+page.svelte`, rename the "Guides" tab to "Guides terminés" and add count badges to the Sessions tab.

### Issue 2 — MEDIUM: Activity table CLIENT column shows individual names instead of company names

**Issue**: The current table shows "Marie Laurent / Lemonlearning", "Jean-Marc Dubois / Techvision". The mockup R009 shows company names as the primary display (e.g., "Acme Corp", "BNP Paribas") with company initials in the avatar.
**Expected**: CLIENT column should prioritize company/organization name as primary identifier.
**Fix**: Update the table cell rendering to show company name (from email domain or assignment metadata) as the primary text, with person name as secondary.

### Issue 3 — LOW: "Répartition par projet" bar chart section not in mockup

**Issue**: The current dashboard has a "Répartition par projet" horizontal bar chart section between stat cards and the activity table. This section does not exist in the mockup R009.
**Expected**: Mockup goes directly from stat cards to "Journal d'activité des clients".
**Fix**: Consider removing this section, or keep it as a useful addition beyond the mockup. Low priority.

---

## DASHBOARD (Collapsed sidebar) — MEDIUM

### Issue 4 — MEDIUM: Sidebar collapse screenshot appears identical to expanded view

**Issue**: Screenshots 04-dashboard and 05-dashboard-collapsed appear to show the same expanded sidebar state. The collapse functionality may not be triggered correctly during the test.
**Expected**: Screenshot 05 should show sidebar at 48px width with icons only.
**Fix**: Check the screenshot test to ensure it properly triggers sidebar collapse before capturing.

---

## PROJECTS — OK

Screenshot 06-projects shows a well-implemented projects page with project cards grid, tab filters, search, and "Nouveau projet" button. Matches design expectations.

---

## PROJECT DETAIL — HIGH

**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`

### Issue 5 — HIGH: Missing health breakdown indicators next to progress ring

**Issue**: The mockup shows three health indicators beside the progress ring: green dot "79 pages OK", amber dot "4 avertissements", red dot "3 erreurs". The current implementation only shows the ring with percentage and "santé" label — no breakdown.
**Expected**: To the right of the progress ring, a vertical list showing OK/warning/error counts with colored dots.
**Fix**: Add health breakdown indicators next to the ring:
```svelte
<div class="flex flex-col gap-1.5 text-xs">
    <div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
        <span>{okCount} pages OK</span>
    </div>
    <div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full bg-amber-500"></span>
        <span>{warnCount} avertissements</span>
    </div>
    <div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full bg-red-500"></span>
        <span>{errorCount} erreurs</span>
    </div>
</div>
```

### Issue 6 — MEDIUM: Configuration tab is read-only, mockup shows editable settings

**Issue**: The mockup's Configuration tab has editable inputs, toggles, and dropdowns (subdomain, SSL, analytics, obfuscation mode). The current implementation shows read-only static text.
**Expected**: Interactive form elements for editing project settings.
**Fix**: Replace static display with interactive controls that call PUT /projects/:id.

### Issue 7 — MEDIUM: Tab "Assignations" shows 0 count on initial load

**Issue**: Assignations tab badge shows "0" because data is loaded lazily only when tab is clicked. The mockup shows correct counts immediately.
**Expected**: Tab badges should show correct counts on page load.
**Fix**: Load assignment counts eagerly in `onMount` alongside other project data.

---

## TREE VIEW — HIGH

**File**: `frontend/src/routes/admin/tree/+page.svelte`

### Issue 8 — HIGH: Tree view missing rich detail panel when page is selected

**Issue**: When a page is selected, the right panel shows only "Sélectionnez une page" placeholder or basic info. The mockup R003 shows: breadcrumb path at top, browser-frame preview, sub-tabs (Aperçu/Editeur HTML/Liens & Navigation/JavaScript), page metadata (URL, file size, capture date, links count), action buttons (Comparer, Recapturer).
**Expected**: Rich detail panel with preview, metadata, sub-tabs, and action buttons.
**Fix**: Enhance the selected page panel with:
- Breadcrumb: "Accueil / Contacts / Fiche client"
- Sub-tabs: "Aperçu", "Editeur HTML", "Liens & Navigation", "JavaScript"
- Browser-frame preview component
- Page metadata section
- "Comparer" and "Recapturer" action buttons

### Issue 9 — HIGH: Tree panel missing resizable handle (R002 feedback)

**Issue**: R002 says "bien, mais possibilité d'agrandir ce volet". The mockup includes a drag-to-resize handle. The current tree panel has a fixed width.
**Expected**: Draggable resize handle on the tree panel's right border.
**Fix**: Add a resize handle element with JavaScript for drag-to-resize. Min 240px, max 600px.

### Issue 10 — MEDIUM: Tree items missing folder section icons with colored backgrounds

**Issue**: The mockup shows each folder section with a small colored icon square (16x16px, rounded, colored background with white icon). Current uses plain folder icons with inline color.
**Expected**: Colored background squares for section icons matching the mockup style.
**Fix**: Wrap folder icons in colored-background containers matching section colors.

### Issue 11 — MEDIUM: Missing "Modale" badges on modal pages

**Issue**: The mockup clearly shows purple "Modale" badges next to modal pages (e.g., "Nouveau contact — [Modale]"). The current tree does mark pages but the badge styling may differ.
**Expected**: Purple-themed "Modale" badge with layers icon.
**Fix**: Ensure modal badges use purple background (#f3e8ff) and purple text (#7c3aed) with a layers icon.

### Issue 12 — LOW: Breadcrumb separator should use "/" not chevron icons

**Issue**: The detail panel breadcrumb uses ChevronRight icons. The mockup uses "/" text separators with lighter opacity.
**Expected**: "/" separators with opacity ~0.4.
**Fix**: Replace ChevronRight with "/" span elements.

---

## ANALYTICS — HIGH

**File**: `frontend/src/routes/admin/analytics/+page.svelte`

### Issue 13 — HIGH: Analytics should show two side-by-side session tables, not a unified list

**Issue**: The current app shows a single "Sessions récentes — 4 sessions" unified list. The mockup R005 clearly shows **two separate tables**: "Admins & Commerciaux — 33 sessions" (left) and "Clients — 51 sessions" (right), each with their own search field. The iteration-11 report incorrectly stated the mockup wanted a single list — the R005 mockup image confirms two tables.
**Expected**: Two-column layout: "Admins & Commerciaux" table on the left, "Clients" table on the right.
**Fix**: The code already has `adminSessions`, `clientSessions`, and separate search queries defined but not used on the overview tab. Render two side-by-side table Cards on the overview tab using these existing data structures.

### Issue 14 — HIGH: Missing stat cards — should be 3 separate cards, not 1 combined

**Issue**: The current app has one "Sessions totales" card with embedded chart and inline sub-metrics. The mockup shows **3 separate stat cards**: "Sessions totales" (blue), "Utilisateurs uniques" (purple), "Temps moyen / session" (amber), each with their own sparkline.
**Expected**: 3-column stat card grid with individual sparklines and accent colors.
**Fix**: Split the single card into 3 separate stat cards with distinct colors and individual sparkline charts.

### Issue 15 — MEDIUM: Missing "Outil" (tool) column in session tables

**Issue**: Current table columns are: Utilisateur, Type, Début, Durée, Événements, Statut. Mockup shows: Utilisateur, Rôle, Outil, Durée, Pages, Visites uniques, Date.
**Expected**: Add "Outil" column showing the tool/project name with colored dot. Replace "Événements" with "Pages". Replace "Statut" with "Visites uniques".
**Fix**: Restructure table columns to match mockup.

### Issue 16 — MEDIUM: Missing bar chart "Sessions par jour"

**Issue**: No bar chart exists. Mockup shows a full-width "Sessions par jour" stacked bar chart below the tables with 7j/14j/30j period selector and Client/Admin legend.
**Expected**: CSS or SVG stacked bar chart with daily bars and period controls.
**Fix**: Add a chart card section below the session tables.

---

## INVITATIONS — HIGH

**File**: `frontend/src/routes/admin/invitations/+page.svelte`

### Issue 17 — HIGH: "requireAccount" checkbox value never sent to backend

**Issue**: The "Exiger la création d'un compte" checkbox exists in UI (matching R005 feedback) but `handleCreateEmail` on line ~371 sends only `email`, `name`, and `expiresInDays`. The `formRequireAccount` value is never transmitted.
**Expected**: The checkbox value should be included in the POST request.
**Fix**: Add `requireAccount: formRequireAccount ? 1 : 0` to the assignment creation payload.

### Issue 18 — HIGH: Link-sharing form missing "2 ans" expiry option

**Issue**: Per R002 feedback (resolved), expiry options should go up to "2 ans". The email form correctly has it, but the link-sharing form only goes up to "1 an".
**Expected**: Both forms offer identical expiry options including "2 ans".
**Fix**: Add `<option value={730}>2 ans</option>` to the link-sharing expiry select.

### Issue 19 — MEDIUM: Link-sharing form missing "Exiger la création d'un compte" checkbox

**Issue**: R005 applies to both invitation modes. The email form has the checkbox but the link-sharing form does not.
**Expected**: Both forms should offer the account creation requirement option.
**Fix**: Add the same checkbox to the link-sharing form.

---

## USERS — OK

Screenshot 11-users is well-implemented. No dedicated mockup exists. Implementation follows design system correctly with user cards, role badges, filters, and search.

---

## OBFUSCATION — LOW

**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`

### Issue 20 — LOW: Rules table appears empty in screenshot

**Issue**: Screenshot 12-obfuscation shows the table headers but no data rows. This is likely a seed data or API loading issue for the selected project.
**Expected**: Populated rules with search/replace pairs.
**Fix**: Verify seed data includes obfuscation rules and that `loadRules()` correctly fetches them for the selected project.

---

## UPDATE REQUESTS — OK

Screenshot 13-update-requests is well-implemented with stat cards, status badges, and action buttons. No dedicated mockup exists. Follows design system correctly.

---

## COMMAND PALETTE — MEDIUM

**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`

### Issue 21 — MEDIUM: Command palette prioritizes quick actions over search results

**Issue**: The mockup R003 shows real search results grouped by category (PAGES, PROJETS) with rich metadata (tool badges, dates). The current palette opens with quick actions (ACTIONS — 7 résultats) and may not transition well to real search results when a query is typed.
**Expected**: When search query is non-empty, show API search results with project/tool badges and metadata. Quick actions only when input is empty.
**Fix**: Ensure search results from the API are prioritized over quick actions when query text exists. Add colored tool badges to page results.

### Issue 22 — LOW: Tool badges should appear on project results too

**Issue**: Tool badges only render for `type === 'page'` results. Mockup shows them on project results too.
**Expected**: Tool badges on both page and project results.
**Fix**: Change condition from `result.type === 'page'` to `result.type === 'page' || result.type === 'project'`.

---

## EDITOR — CRITICAL

**File**: `frontend/src/routes/admin/editor/[id]/+page.svelte`

### Issue 23 — CRITICAL: Editor page does not render — shows dashboard instead

**Issue**: Screenshot 15-editor shows the main dashboard page, NOT the editor. The editor route is either crashing on mount, failing to load page data, or redirecting to the dashboard. The `/pages/:id/content` endpoint may not exist or the page ID routing may be broken.
**Expected**: Full editor interface with sidebar page list, dark code editor with line numbers, HTML content, toolbar, and tab navigation.
**Fix**: Debug the editor route:
1. Verify the backend has `GET /pages/:id` endpoint that returns page data
2. Check if `/pages/:id/content` or `PATCH /pages/:id/content` endpoints exist
3. Ensure the admin layout does not interfere with editor rendering
4. Add error handling so failures show an error state, not a redirect to dashboard

### Issue 24 — HIGH: Editor missing "JavaScript" tab

**Issue**: Mockup R004 shows 3 tabs: "Éditeur HTML", "Liens & Navigation", "JavaScript". Current code only has 2 tabs: "html" and "links".
**Expected**: A third "JavaScript" tab showing detected JS scripts with count badge.
**Fix**: Add `TabsTrigger` with value "javascript" and corresponding content panel.

### Issue 25 — HIGH: Editor missing full breadcrumb navigation

**Issue**: Mockup shows "Retour à l'arborescence > Salesforce > Demo Q1 > Fiche Contact > Éditeur". Current code only has a small "Retour à l'arborescence" link.
**Expected**: Full breadcrumb hierarchy from project down to current page.
**Fix**: Add breadcrumb bar showing project > version > page > "Éditeur".

### Issue 26 — HIGH: Editor sidebar should show tree-organized pages, not flat list

**Issue**: Mockup R003/R004 shows a tree-structured page list with sections, icons, health dots, and search. Current sidebar is a flat list.
**Expected**: Tree-organized sidebar matching the tree view structure.
**Fix**: Implement tree structure grouping pages by URL hierarchy.

### Issue 27 — MEDIUM: Editor missing search/find-in-editor field

**Issue**: Mockup shows a "Recherche" search input in the editor toolbar. Current code has no in-editor search.
**Expected**: Search field for finding text within the HTML code editor.
**Fix**: Add search input with find/highlight functionality.

### Issue 28 — MEDIUM: Editor missing "Personnaliser" toggle

**Issue**: Mockup R002/R004 shows a "Personnaliser" toggle in the top-right. Not implemented.
**Expected**: Toggle button for customization mode.
**Fix**: Add toggle button in toolbar top-right area.

---

## DEMO VIEWER (Commercial) — CRITICAL

**File**: `frontend/src/routes/demo/[...path]/+page.svelte`

### Issue 29 — CRITICAL: Demo content fails to load — shows "Page introuvable"

**Issue**: Screenshot 16-demo-viewer shows "Page introuvable / La démo demandée n'existe pas ou n'est pas disponible." The header shows "Chargement..." instead of the project name. 0 pages loaded. The backend endpoint `GET /demo/:subdomain/*` likely fails when the wildcard path is empty.
**Expected**: The iframe should load and display demo page content. Header should show "Démo Salesforce — Acme Corp".
**Fix**:
1. Backend: Ensure `/demo/:subdomain/` (empty path) resolves to the project's start/home page
2. Frontend: Fix the iframe URL — likely using hardcoded `localhost:3001` which may not work through Vite proxy. Use relative URL or configured base URL
3. Add fallback: when no page path specified, auto-navigate to the first available page

### Issue 30 — HIGH: Hardcoded `localhost:3001` URL in iframe

**Issue**: The demo viewer uses `http://localhost:3001/demo/...` as the iframe URL. This will break in production and may not work through SvelteKit's Vite proxy.
**Expected**: Relative URL like `/api/demo/${subdomain}/${pagePath}` or configured environment-based URL.
**Fix**: Change `demoApiUrl` to use the API client's base URL or a relative path.

### Issue 31 — HIGH: Missing stats row (pages, clients, last activity)

**Issue**: Mockup R010 shows "5 Pages capturées", "3 Clients connectés", "il y a 2 min Dernière activité". Current toolbar only shows "0 pages".
**Expected**: Full stats row with three metrics and icons.
**Fix**: Add stats section fetching data from analytics API.

### Issue 32 — HIGH: Missing action buttons row with proper styling

**Issue**: Mockup shows 4 styled buttons: "Partager le lien" (green filled), "Copier l'URL" (outlined), "Ouvrir en tant que client" (outlined), "Paramètres" (outlined with gear). Current has small unstyled text buttons "Partager", "Copier", "Vue client".
**Expected**: Properly styled action buttons matching mockup layout.
**Fix**: Restyle buttons with proper variants, add "Paramètres" button, make "Partager le lien" green.

### Issue 33 — MEDIUM: "Partager le lien" should open advanced sharing dialog

**Issue**: R010 feedback states sharing should be "plus avancé en terme de partage (durée de validité du lien etc...)". Current just copies URL.
**Expected**: Share dialog with link validity duration, optional password, generated URL.
**Fix**: Create share dialog component with advanced options.

---

## COMMERCIAL/PROSPECT VIEWER — CRITICAL

**File**: `frontend/src/routes/view/[...path]/+page.svelte`

### Issue 34 — CRITICAL: Prospect viewer is completely blank — no demo content loads

**Issue**: Screenshot 17-commercial-viewer shows a white page with only the LL widget in bottom-right. No demo content renders at all. Same root cause as Issue 29 — the backend doesn't resolve empty page paths.
**Expected**: Full-screen Salesforce demo page rendered in iframe, with only the LL floating widget visible.
**Fix**: Same backend fix as Issue 29 — handle empty path by serving start page. Also fix the hardcoded `localhost:3001` URL issue (same as Issue 30).

### Issue 35 — HIGH: No error state shown when demo fails to load

**Issue**: The page shows blank white instead of any error feedback. The iframe loads a URL but content may be 404.
**Expected**: User-friendly error message like "Cette démo n'est pas disponible."
**Fix**: Add iframe load failure detection (timeout, message event, or onerror). Show error UI when content fails.

---

## CROSS-CUTTING ISSUES

### Issue 36 — MEDIUM: Dashboard stat card icon colors are all the same

**Issue**: Current stat cards use gray/muted icons. The mockup shows each card with a distinct accent color icon (blue for projects, green for pages, purple for consultations, amber for time).
**Expected**: Per-card colored icon backgrounds.
**Fix**: Add distinct color classes to each stat card's icon container.

### Issue 37 — MEDIUM: Dashboard activity tool badges should be colorful pills with dots

**Issue**: Current uses generic `<Badge variant="secondary">` for tool names (e.g., "Salesforce"). The mockup shows colorful pill-shaped badges with a colored dot per tool (Salesforce=cyan, SAP=blue, Workday=amber).
**Expected**: Tool-specific colored badges with dots.
**Fix**: Replace Badge with custom styled spans per tool with distinct background/text colors.

### Issue 38 — LOW: Sidebar missing "Composants" nav item in GESTION section

**Issue**: The mockup R009 shows "Composants" in the GESTION section between "Obfuscation" and "Paramètres". The current sidebar does not have this item.
**Expected**: "Composants" nav item in GESTION section.
**Fix**: Add nav item if the feature is planned, or ignore if intentionally deferred.

### Issue 39 — LOW: Version badge on demo viewer not prominently displayed

**Issue**: Mockup R010 shows "v2.1 — Production" as a prominent green badge. Current implementation has the badge but it may not be visible when project data fails to load.
**Expected**: Green version badge next to project selector.
**Fix**: Will be visible once Issue 29 (demo loading) is fixed.

---

## Summary of Changes Since Iteration 11

### Fixed (verified as resolved from iteration 11):
- Analytics now shows a unified "Sessions récentes" with "Exporter CSV" button (was split in iteration 11, but NOTE: mockup R005 actually shows the split — see Issue 13)
- Tree view now has "Par site" / "Par guide" sub-tabs (Issue 5 from iter-11 resolved)

### Still present from iteration 11:
- Tree view still missing rich detail panel (HIGH — was Issue 4, now Issue 8)
- Command palette focused on quick actions (MEDIUM — was Issue 10, now Issue 21)
- Sidebar collapse screenshot issue (MEDIUM — was Issue 3, now Issue 4)

### New issues (from newly-tested pages):
- Editor page doesn't render at all (CRITICAL — Issue 23)
- Demo viewer fails to load content (CRITICAL — Issue 29)
- Prospect viewer completely blank (CRITICAL — Issue 34)
- Multiple HIGH issues on editor, demo viewer, and invitations

### Priority Fix Order:
1. **Issues 29, 34** (CRITICAL): Fix backend `/demo/:subdomain/` empty path handling + frontend iframe URLs
2. **Issue 23** (CRITICAL): Fix editor route loading/rendering
3. **Issue 17** (HIGH): Send `requireAccount` to backend — single line fix
4. **Issue 18** (HIGH): Add "2 ans" option to link-sharing expiry — single line fix
5. **Issues 13-14** (HIGH): Analytics layout — two tables + 3 stat cards
6. **Issues 8-9** (HIGH): Tree view rich detail panel + resizable handle
7. **Issues 30, 35** (HIGH): Fix hardcoded URLs + add error states in viewers

---

TOTAL_ISSUES: 39
CRITICAL: 4
HIGH: 14
MEDIUM: 13
LOW: 8
