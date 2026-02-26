# Iteration 14 — UI/UX Quality Audit

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 7 |
| MEDIUM | 8 |
| LOW | 5 |

---

## LOGIN PAGE (screenshots 01, 02-login-filled, 03-login-error) — vs mockup maquette-login

The login page exists in TWO different versions in screenshots:
- **01-login.png** / **02-login-filled.png** / **03-login-error.png**: Single-form design with "Identifiants" section header, remember me checkbox, Google SSO, and "(admin uniquement)" text. This matches the mockup feedback.
- **02-login-client.png** / **03-login-admin.png**: Tab-based design ("Accès client" / "Administration") with separate flows. This is a DIFFERENT design from the mockup.

### Issue 1 — Login: Two conflicting login page designs — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The app appears to have two different login page designs. The tab-based version (02-login-client, 03-login-admin) uses "Accès client / Administration" tabs, while the other screenshots (01, 02-filled, 03-error) use a single form with "Identifiants" heading. The mockup shows a SINGLE form approach (no tabs) with email+password fields and a Google SSO button below. The tab-based design was NOT in the mockup.
**Expected**: Single unified login form matching mockup: email field, password field, "Se souvenir de moi" checkbox, "Mot de passe oublié?" link, blue "Se connecter" button, then "ou se connecter avec" divider, then "Continuer avec Google" button, then "(admin uniquement)" in gray below.
**Fix**: If the tab-based version is the current live version, it needs to be reverted to the single-form design matching the mockup. If both exist as different states, consolidate to one version matching the approved mockup.

### Issue 2 — Login: Title says "Environnements de Démonstration" instead of "Environnements Simulés" — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: In screenshots 01/02-filled/03-error, the title reads "Environnements de Démonstration" with subtitle "Lemon Learning". The tab-based version correctly shows "Environnements Simulés" with "Plateforme de démonstrations Lemon Learning".
**Expected**: Title should be "Environnements Simulés" (matching the project name and the tab-based version).
**Fix**: Update the title text in the login page component.

### Issue 3 — Login: Logo shows "ED" instead of "ES" — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: In screenshots 01/02-filled/03-error, the blue avatar shows "ED" (for "Environnements de Démonstration"). It should show "ES" for "Environnements Simulés".
**Expected**: Blue rounded-square avatar with "ES" text, matching the sidebar avatar.
**Fix**: Change the avatar text from "ED" to "ES".

---

## DASHBOARD (screenshots 04, 05-collapsed) — vs mockup maquette-admin-dashboard

### Issue 4 — Dashboard: Missing breadcrumb "Accueil > Vue d'ensemble" — LOW
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The mockup shows breadcrumb "Accueil > Vue d'ensemble" next to the "Dashboard" title. The current app only shows the "Dashboard" title without breadcrumbs in the header area (breadcrumbs are in the general header bar as "Accueil > ...").
**Expected**: Breadcrumb trail matching mockup layout.
**Fix**: Minor — the current breadcrumb in the header area is acceptable but differs from mockup placement.

### Issue 5 — Dashboard: Only 2 stat cards instead of mockup's implied 3+ — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The mockup shows 2 stat cards (Projets actifs, Pages capturées) with a dashed area for "pages consultées - temps passé" (R009 feedback). The current app shows 4 cards (Projets actifs, Pages capturées, Démos actives, Sessions ce mois). Having 4 cards is actually BETTER than the mockup's 2 — this is an enhancement. However, the mockup's dashed area specifically requested "pages consultées" and "temps passé" as metrics, which are not present as named cards.
**Expected**: The R009 feedback asked to add "pages consultées" and "temps passé" metrics. The current "Sessions ce mois" card does show "20 pages consultées" and "690min temps moyen" in sub-text, which partially addresses this.
**Fix**: Acceptable as-is. The data is present, just organized differently than the mockup sketched.

### Issue 6 — Dashboard: Activity log shows real data vs mockup empty state — OK
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The mockup shows "Journal d'activité des clients" with tabs (Toutes 24, Sessions 16, Guides terminés 8) but empty content area. The current app shows the same section with actual data rows including client avatars, project names, actions, and dates. This is correct behavior with seeded data.
**Expected**: Activity log with data rows when data exists.
**Fix**: None needed — this is correct.

## DASHBOARD — OK (matches mockup structure well, with enhancements)

---

## DASHBOARD COLLAPSED (screenshot 05) — vs mockup collapsed state

### Issue 7 — Dashboard Collapsed: Sidebar icons are correct but some don't match mockup — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The collapsed sidebar shows icons for all sections. The icon set generally matches the mockup's collapsed view. Some icons differ slightly (the mockup uses simpler line icons). The colored dots for OUTILS SIMULÉS are present in both.
**Expected**: Icons matching the mockup's collapsed sidebar.
**Fix**: Minor icon differences — acceptable.

## DASHBOARD COLLAPSED — OK

---

## PROJECTS (screenshot 06) — No dedicated mockup (project list not in mockup set)

### Issue 8 — Projects: No dedicated mockup exists — LOW
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: There is no mockup for the projects list page. The current implementation shows a card grid with project names, tool names, descriptions, version counts, page counts, and dates. This looks clean and functional.
**Expected**: N/A (no mockup reference).
**Fix**: None needed — the implementation looks professional.

## PROJECTS — OK

---

## PROJECT DETAIL (screenshot 07) — vs mockup maquette-project-detail

The mockup for project detail doesn't have a retours folder (no feedback iterations), so we compare against the v2 base mockup. The mockup wasn't available as a PNG, so comparing against the general design system.

### Issue 9 — Project Detail: Page looks well-structured — OK
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: The project detail page shows project header with health percentage ring, metadata (pages, versions, demos, guides), created by info, and tabs (Versions, Assignations, Demandes MAJ, Configuration). Version list shows version cards with action buttons (Ouvrir démo, Arborescence, Dupliquer). This matches expected functionality.
**Expected**: Project detail with versions management.
**Fix**: None needed.

## PROJECT DETAIL — OK

---

## TREE VIEW (screenshot 08) — vs mockup maquette-tree-view

### Issue 10 — Tree View: Missing right panel content vs mockup — MEDIUM
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The mockup (R003) shows a tree view with the left panel containing a hierarchical tree AND a right panel that should show page details/editing sub-tabs when a page is selected. The current screenshot shows the tree on the left with an empty right panel showing "Sélectionnez une page" placeholder. The mockup feedback (R003) says "ajoute les sous onglet permettant l'edition (HTML etc...)" — the right panel should have editing sub-tabs.
**Expected**: When a page is selected in the tree, the right panel should show page details with sub-tabs for editing (HTML, metadata, etc.). The mockup shows this is covered by the page editor mockup.
**Fix**: The empty state is correct when no page is selected. The editor integration (sub-tabs) is handled by navigating to the editor page. This is acceptable behavior.

### Issue 11 — Tree View: Missing view tabs (Arborescence/Liste/Carte du site) counts — LOW
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The tree view shows tabs "Arborescence / Liste / Carte du site" which matches the mockup. However, the mockup shows "Par site / Par guide" sub-tabs below, which the current app also has. The page count indicators (86 pages, 12 modales, 3 erreurs) in the mockup differ from the app's counts (8 pages, 0 modales, 0 erreurs) but this is just seed data differences.
**Expected**: Structural match — the tab structure is correct.
**Fix**: None needed — seed data difference is expected.

## TREE VIEW — OK (minor differences are seed data)

---

## ANALYTICS (screenshot 09) — vs mockup maquette-analytics

### Issue 12 — Analytics: Layout structure matches mockup well — OK
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The mockup shows: header tabs (Vue générale, Par client, Par outil, Guides), "En direct" badge, project filter, date range. Then stat cards (Sessions totales with chart). Then two-column layout: "Admins & Commerciaux" table with search, and "Clients" table with search. Then "Sessions par jour" chart. The current app matches this structure very closely.
**Expected**: Analytics dashboard with stat cards, two user tables, and session chart.
**Fix**: None needed — structure matches well.

### Issue 13 — Analytics: "Utilisateurs uniques" card exists in app but not in mockup — LOW
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The app shows 3 stat cards (Sessions totales, Utilisateurs uniques, Temps moyen/session) while the mockup only clearly shows "Sessions totales" with a mini chart. The additional cards are enhancements.
**Expected**: At minimum "Sessions totales" card.
**Fix**: Enhancement — acceptable.

## ANALYTICS — OK

---

## INVITATIONS (screenshot 10) — vs mockup maquette-invitation-clients

### Issue 14 — Invitations: Structure matches mockup with improvements — OK
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The mockup shows: header with breadcrumb, stat cards (invitations envoyées count), invitation list with search and filters, and a right panel for creating new access ("Générer un accès"). The current app matches this with stat cards (Invitations envoyées, Liens actifs, Connexions), a list table on the left, and the "Générer un accès" form on the right with tabs (Invitation par email / Partager un lien).
**Expected**: Invitation management with list and creation form.
**Fix**: None needed.

### Issue 15 — Invitations: "Exiger la création d'un compte" checkbox present — OK
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The unresolved feedback R005 requested "exiger la creation d'un compte". The current app shows a checkbox "Exiger la création d'un compte" with helper text "Le client devra créer un compte" in the form. This feedback has been addressed.
**Expected**: Account creation requirement option.
**Fix**: Already implemented — this resolves the unresolved feedback.

## INVITATIONS — OK

---

## USERS (screenshot 11) — No dedicated mockup

### Issue 16 — Users: Clean implementation without mockup reference — OK
**File**: `frontend/src/routes/admin/users/+page.svelte`
**Issue**: No mockup exists for the users page. The current implementation shows a user list with tabs (Tous, Admins, Clients), search field, user rows with avatar, name, email, auth method (Google SSO), role badge, and date. Clean and functional.
**Expected**: N/A.
**Fix**: None needed.

## USERS — OK

---

## OBFUSCATION (screenshot 12) — vs mockup maquette-obfuscation

### Issue 17 — Obfuscation: Good match with mockup structure — OK
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The mockup shows: project selector, tabs (Règles auto / Manuel), rules table with columns (RECHERCHER, REMPLACER PAR, PORTÉE, OCCURRENCES, STATUT), add rule form at bottom, and a right panel for preview. The feedback R001 said "toujours global" (delete scope selector). The current app shows: project selector, tabs (Règles auto / Manuel), rules table, an "Aperçu en direct" preview panel on the right with coverage stats, HTML source view, and apply button. The "Masquage dans l'éditeur" section at the bottom is an addition.
**Expected**: Obfuscation rules management with preview.
**Fix**: None needed — the scope selector was removed per feedback (rules are always global). The additional "Masquage dans l'éditeur" section is an enhancement.

## OBFUSCATION — OK

---

## UPDATE REQUESTS (screenshot 13) — No dedicated mockup

### Issue 18 — Update Requests: Clean implementation — OK
**File**: `frontend/src/routes/admin/update-requests/+page.svelte`
**Issue**: No dedicated mockup exists. The implementation shows stat cards (En attente, En cours, Terminées), filter tabs, and request cards with status badges, descriptions, metadata, and action buttons. Professional and functional.
**Expected**: N/A.
**Fix**: None needed.

## UPDATE REQUESTS — OK

---

## COMMAND PALETTE (screenshot 14) — vs mockup maquette-command-palette

### Issue 19 — Command Palette: Missing category tabs and page results — HIGH
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The mockup shows a command palette with: search input, category tabs (Projets, Demos, Utilisateurs, Captures), "PAGES" section with page results showing project badges (SALESFORCE, SAP, SERVICENOW), and "PROJETS" section below. The current app shows: search input, "ACTIONS" section with 5 action items (Créer un projet, Nouvelle capture, Aller au Dashboard, Voir les Analytics, Gérer les utilisateurs), and navigation hints at the bottom.
**Expected**: Command palette with category tabs, page search results with project badges, and project search results — functioning as a true search/navigation tool, not just an actions menu.
**Fix**: The command palette needs major rework to add:
1. Category tabs (Projets, Demos, Utilisateurs, Captures) as in the mockup — renamed to "recherche admin" per R004 feedback
2. PAGES section showing actual page search results with project badges
3. PROJETS section showing matching projects
4. The current "ACTIONS" list should be kept but the palette should primarily function as a search tool

### Issue 20 — Command Palette: Renamed to "recherche admin" per feedback — MEDIUM
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: R004 feedback requested renaming from "command palette" to "recherche admin". The current implementation still shows generic actions without this naming.
**Expected**: The feature should be labeled "Recherche admin" or similar.
**Fix**: Update the component name/header if visible in the UI. The search placeholder "Rechercher une page, un projet, une action..." is good but the internal name should reflect the rename.

---

## EDITOR (screenshot 15) — vs mockup maquette-page-editor

### Issue 21 — Editor: Screenshot shows DASHBOARD instead of editor — CRITICAL
**File**: `frontend/src/routes/admin/editor/[id]/+page.svelte`
**Issue**: Screenshot 15 (labeled "15-editor.png") actually shows the Dashboard page, NOT the editor. This means either: (a) the test navigation to the editor failed and it redirected to dashboard, or (b) the screenshot was taken incorrectly. The editor page likely crashes or fails to load properly.
**Expected**: A code editor page matching the page-editor mockup: left panel with page tree, center with HTML code editor with syntax highlighting, top bar with tabs (Accueil, Annuler, Rechercher, Remplacer, Rechercher), and right panel buttons (Enregistrer et prévisualiser, Enregistrer). The mockup (R004) shows smart links capability.
**Fix**: Investigate why the editor page is not loading. Likely the page ID in the test URL doesn't match any actual page in the database, causing a redirect to dashboard. Check the routing and error handling in `frontend/src/routes/admin/editor/[id]/+page.svelte`.

---

## DEMO VIEWER (screenshot 16) — vs mockup maquette-demo-viewer

### Issue 22 — Demo Viewer: Shows 404 error instead of demo content — CRITICAL
**File**: `frontend/src/routes/demo/[...path]/+page.svelte`
**Issue**: The demo viewer screenshot shows a raw "404 - Page non trouvée" error with text "Project with subdomain 'test' not found". The error is displayed as unstyled HTML (raw h1 and p tags). Additionally, there's a floating "LL" badge overlay that appears partially cut off at the top center.
**Expected**: Per the mockup (maquette-demo-viewer R002): a full-page iframe showing the captured demo page with Salesforce-like content. The demo viewer should show the captured HTML with obfuscation applied, navigation tabs, and a Lemon Learning floating widget (golden "LL" circle) in the bottom-right corner. Error states should be styled with a proper error page design.
**Fix**:
1. The test uses subdomain "test" which doesn't exist. The test should use a valid subdomain from seed data (e.g., "salesforce").
2. The 404 error page needs proper styling — it's currently raw HTML with no CSS.
3. The "LL" floating widget is visible but overlapping the error content incorrectly.

---

## COMMERCIAL VIEWER (screenshot 17) — vs mockup maquette-commercial-viewer

### Issue 23 — Commercial Viewer: Shows 404 error instead of demo content — CRITICAL
**File**: `frontend/src/routes/view/[...path]/+page.svelte`
**Issue**: Same as demo viewer — shows raw "404 - Page non trouvée" with "Project with subdomain 'test' not found". The commercial viewer should show the demo page with a toolbar at the top (dark header bar with project info, version badge, stats, action buttons).
**Expected**: Per the commercial viewer mockup (R010): dark toolbar at top with "LL Demo" branding, project name "Démo Salesforce — Acme Corp", version badge "v2.1 — Production", stats (pages, clients, last activity), action buttons (Partager le lien, Copier l'URL, Ouvrir en tant que client, Paramètres), Salesforce navigation tabs below, and a golden "LL" floating widget at bottom-right.
**Fix**:
1. The test uses subdomain "test" which doesn't exist. Use a valid subdomain.
2. The 404 page needs styled error handling.
3. The commercial viewer's dark toolbar and all its features need to work end-to-end.

---

## SIDEBAR (general component, visible in all admin screenshots)

### Issue 24 — Sidebar: Mostly matches mockup with minor differences — OK
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The sidebar matches the mockup design well: "ES" blue avatar + "Env. Simulés" / "Lemon Learning" branding, PRINCIPAL section (Dashboard, Projets, Arborescence, Analytics, Invitations) with badge counts, GESTION section (Utilisateurs, Obfuscation, Demandes MAJ, Composants, Paramètres) with red badge on Demandes MAJ, OUTILS SIMULÉS section with colored dots and page counts, user avatar at bottom with name and role.
**Expected**: Linear-style sidebar matching mockup.
**Fix**: None needed — sidebar implementation is very close to mockup.

---

## HEADER (general component, visible in all admin screenshots)

### Issue 25 — Header: Search bar and Extension button present — OK
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: The header shows search input with keyboard shortcut hint (⌘K), notification bell with red dot, help icon, and "Extension" button. This matches the mockup's header with notification bell, help icon, and Extension button.
**Expected**: Header with search, notifications, help, and extension button.
**Fix**: None needed.

---

## GENERAL ISSUES

### Issue 26 — Login page: Two different designs exist in screenshots — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The test suite captures two completely different login page designs. Screenshots 01/02-filled/03-error show a design with "Identifiants" section header, single form, Google SSO with "(admin uniquement)". Screenshots 02-login-client/03-login-admin show a tab-based design with "Accès client / Administration" tabs. Only ONE should exist.
**Expected**: One consistent login page design matching the approved mockup (single form with Google SSO).
**Fix**: Determine which design is the current live version and ensure consistency. The tab-based design is NOT in the mockup, so the single-form design should be used. If both exist, the test may be capturing different states or the page was redesigned mid-iteration.

### Issue 27 — Demo/View routes: Error page has no styling — HIGH
**File**: `frontend/src/routes/demo/[...path]/+page.svelte` and `frontend/src/routes/view/[...path]/+page.svelte`
**Issue**: When demo pages fail to load (404), the error is rendered as raw, unstyled HTML (default browser h1/p rendering). There is no error page design, no branding, and no helpful navigation.
**Expected**: Styled 404 page with project branding, helpful message, and navigation options.
**Fix**: Add a properly styled error state to both demo viewer and commercial viewer components with centered layout, icon, title, message, and action buttons.

### Issue 28 — Demo/View routes: Floating "LL" widget overlaps error content — HIGH
**File**: `frontend/src/routes/demo/[...path]/+page.svelte`
**Issue**: The Lemon Learning floating widget ("LL" golden circle) renders even on error pages, overlapping the unstyled error content. On the demo viewer (screenshot 16), it appears partially cut off at the top center of the page.
**Expected**: The "LL" widget should only appear when a demo page is successfully loaded, not on error states.
**Fix**: Conditionally render the widget only when `iframeLoaded` is true and no error state exists.

### Issue 29 — Command Palette: Only shows actions, not search results — HIGH
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The command palette functions as a simple actions menu (5 predefined actions) rather than a search tool. The mockup shows it functioning as a full search interface with page results, project results, and category tabs.
**Expected**: A search-first command palette that searches pages, projects, users, etc. with category filtering.
**Fix**: Major rework needed — add API integration to search across pages/projects, display results in categorized sections (PAGES, PROJETS), add project badges to results, and maintain the actions list as a fallback when no search query is entered.

### Issue 30 — Editor page fails to load (redirects to Dashboard) — HIGH
**File**: `frontend/src/routes/admin/editor/[id]/+page.svelte`
**Issue**: The editor page screenshot shows the Dashboard instead of the editor, indicating the editor page either crashes on load, can't find the page ID, or redirects on error.
**Expected**: Code editor page with page tree, HTML editing, and preview capabilities.
**Fix**: Debug the editor page routing and error handling. Ensure it handles missing/invalid page IDs gracefully with an error state rather than silently redirecting.

---

# Summary

## Pages with NO issues (matching mockup or acceptable):
- Dashboard (expanded) — OK
- Dashboard (collapsed) — OK
- Projects list — OK (no mockup, clean implementation)
- Project Detail — OK
- Tree View — OK
- Analytics — OK
- Invitations — OK (also resolved unresolved R005 feedback)
- Users — OK (no mockup, clean implementation)
- Obfuscation — OK
- Update Requests — OK (no mockup, clean implementation)
- Sidebar — OK
- Header — OK

## Pages with issues:
- Login — 3 issues (inconsistent designs, wrong title/logo)
- Command Palette — 2 issues (missing search, missing categories)
- Editor — 1 issue (fails to load)
- Demo Viewer — 1 issue (404 error, no styled error page)
- Commercial Viewer — 1 issue (404 error, no styled error page)
- General — 5 cross-cutting issues

---

TOTAL_ISSUES: 23
CRITICAL: 3
HIGH: 7
MEDIUM: 8
LOW: 5
