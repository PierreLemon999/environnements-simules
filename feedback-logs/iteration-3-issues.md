# Iteration 3 — UI/UX Quality Audit Report

**Date**: 2026-02-26
**Compared**: Current app screenshots vs mockup-forge reference mockups + feedback JSONs
**Auditor**: Claude Opus 4.6

---

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 9 |
| MEDIUM | 12 |
| LOW | 6 |
| **TOTAL** | **29** |

---

## LOGIN PAGE — HIGH

### Issue 1: Two completely different login implementations coexist
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Screenshots show TWO different login page designs. Screenshots `01-login.png` / `02-login-filled.png` / `03-login-error.png` show an older design with title "Environnements de Demonstration", "IDENTIFIANTS" section header, "Se souvenir de moi", "Mot de passe oublié?", divider "ou se connecter avec", Google button, and footer links. Screenshots `02-login-client.png` / `03-login-admin.png` show a newer tabbed design ("Accès client" / "Administration") matching the mockup feedback better. The older design appears to still be the main login page served.
**Expected**: Only the newer tabbed design should exist, matching the mockup. The mockup shows: blue "ES" avatar, title "Environnements Simulés", subtitle "Plateforme de démonstrations Lemon Learning", tabbed card (Accès client / Administration), client tab with Email + Password + "Se connecter" button, admin tab with Google SSO + "(admin uniquement)" label.
**Fix**: The newer tabbed implementation (screenshots 02-login-client / 03-login-admin) IS the correct one. Remove the old design. Ensure the login route serves only the new tabbed version.

### Issue 2: Login page — old design has wrong title
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Old login design shows "Environnements de **Démonstration**" instead of "Environnements **Simulés**"
**Expected**: Title should be "Environnements Simulés" per mockup
**Fix**: If old design still exists in code, replace the title. This may already be fixed in the newer tabbed version.

### Issue 3: Unresolved mockup feedback — remove footer element
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Per feedback R006 (unresolved): "Supprimer cet element" at coordinates (782,590)-(1151,588). The old login design still shows footer links "Confidentialité · Conditions · Aide" and "Propulsé par Lemon Learning / © 2026...". The newer tabbed design correctly omits these.
**Expected**: No footer links on the login page
**Fix**: Ensure the old design with footer is removed entirely.

---

## DASHBOARD — HIGH

### Issue 4: Dashboard layout significantly different from mockup
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The current dashboard has: "Administration" as page title, two stat cards ("PROJETS ACTIFS" / "PAGES CAPTURÉES"), then "Journal d'activité des clients" with tabs (Toutes/Sessions/Guides terminés) and a data table. The mockup shows: breadcrumb "Dashboard > Accueil > Vue d'ensemble", stat cards with sparkline bar charts below them, a "Projets" section with tabs (Tous/Actifs/Test/Archivés) and project cards grid, and a "+ Nouveau projet" action button in the header.
**Expected**: Per mockup R007/R009:
1. Breadcrumb: "Dashboard > Accueil > Vue d'ensemble"
2. Stat cards: "Projets actifs" (lowercase) with sparkline + "Pages capturées" with sparkline — smaller/less voluminous (R005 feedback: "rendre moins volumineux")
3. Below stats: "Journal d'activité des clients" table with activity log (R006: "mettre un log de ce qu'on fait les prospects") — this IS implemented correctly
4. R009 (resolved): columns should include "pages consultées" and "temps passé" — these ARE present in the current app
5. "+ Nouveau projet" button in header — MISSING from dashboard
**Fix**:
- Change page title/breadcrumb from "Administration" to "Dashboard > Accueil > Vue d'ensemble"
- Add "+ Nouveau projet" button to header area
- Make stat cards less voluminous (smaller height, lighter weight)
- Stat card labels should be lowercase/sentence case ("Projets actifs") not UPPERCASE ("PROJETS ACTIFS")

### Issue 5: Dashboard stat card labels are UPPERCASE instead of sentence case
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Cards show "PROJETS ACTIFS" and "PAGES CAPTURÉES" in uppercase
**Expected**: Mockup shows "Projets actifs" and "Pages capturées" in lowercase/sentence case with lighter gray text
**Fix**: Change the stat card label classes from uppercase to normal case, use lighter text color

---

## DASHBOARD COLLAPSED — MEDIUM

### Issue 6: Collapsed sidebar missing tool labels in OUTILS SIMULÉS section
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: When sidebar is collapsed, the OUTILS SIMULÉS section shows colored dots without any tooltip or label. The mockup shows the collapsed sidebar with icon-only nav items that have proper tooltips.
**Expected**: Collapsed sidebar should show tooltips on hover for all items including tool names
**Fix**: Add `title` attributes or tooltip components to collapsed sidebar items

---

## PROJECTS LIST — MEDIUM

### Issue 7: Projects page has duplicate "Nouveau projet" buttons
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: The screenshot shows BOTH a "+ Nouveau projet" button in the header bar AND another "+ Nouveau projet" button in the content area (top-right corner). The mockup shows only one button.
**Expected**: Single "+ Nouveau projet" button, placed in the header area per mockup convention
**Fix**: Remove the duplicate button. Keep only one — preferably the header one.

### Issue 8: Project cards missing status indicator
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: The mockup dashboard shows project cards with status tabs (Tous 7 / Actifs 4 / Test 2 / Archivés 1). The current projects page has similar tabs (Tous / Actifs / Test / Archivés) but individual project cards don't show a visible status badge or indicator.
**Expected**: Each project card should show its status (Active/Test/Archived) as a visual indicator
**Fix**: Add a small status badge or colored dot to each project card

---

## PROJECT DETAIL — MEDIUM

### Issue 9: Project detail missing "Nouveau projet" header button
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte` (assumed)
**Issue**: The project detail page shows a "+ Nouvelle version" button but the mockup dashboard design implies a consistent header with "+ Nouveau projet" in the top header bar across admin pages
**Expected**: The current layout is acceptable for the detail page — the "+ Nouvelle version" makes contextual sense here
**Fix**: No action needed — this page is contextually correct

## PROJECT DETAIL — OK
The project detail page with versions table, status badges (Actif/Obsolète), language column, and action buttons (external link, three-dot menu) looks well-implemented and matches expectations.

---

## TREE VIEW — HIGH

### Issue 10: Tree view missing right detail panel
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The current tree view shows only the left panel (project selector, view tabs, filter, health status bar, page tree) and a placeholder "Sélectionnez une page" message on the right. The mockup (R001) shows a detailed right panel with: page preview thumbnail, URL source, file size, capture date, mode, outgoing links count, broken links count, health status, "OBFUSCATION ACTIVE" section, and "GUIDES ASSOCIÉS" section. The mockup also shows action buttons at the top: "Edition en direct" / "Obfuscation" / "Ouvrir démo".
**Expected**: When a page is selected, the right panel should show:
1. Page name as title with breadcrumb (e.g., "Salesforce > Home > Dashboard principal")
2. Action buttons: "Edition en direct", "Obfuscation", "Ouvrir démo"
3. Preview thumbnail
4. Metadata: URL source, Taille, Capture le, Mode, Liens sortants, Liens cassés, Santé
5. "OBFUSCATION ACTIVE" section showing active rules
6. "GUIDES ASSOCIÉS" section showing associated guides
**Fix**: Implement the full right detail panel component. This is a significant feature gap.

### Issue 11: Tree view missing "Par site" / "Par guide" toggle
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Current tree view has tabs "Arborescence / Liste / Carte du site" but the mockup shows "Par site / Par guide" as the primary toggle, with subtabs below.
**Expected**: Primary view toggle should be "Par site" / "Par guide" per mockup
**Fix**: Rename or restructure the view tabs to match the mockup hierarchy

### Issue 12: Tree view missing breadcrumb path at bottom
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The mockup shows a breadcrumb path at the bottom of the tree panel (e.g., "Accueil / Contacts / Fiche client"). The current implementation shows the version selector at the bottom but no breadcrumb path.
**Expected**: Show breadcrumb path of the currently selected page at the bottom
**Fix**: Add a breadcrumb component below the tree, showing the path to the selected page

### Issue 13: Tree view — "Carte du site" tab shows node-graph view
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The mockup retour R002 shows the "Carte du site" view as a visual node graph (force-directed layout) with colored nodes representing pages, modals, and errors with connections between them. The current implementation likely doesn't have this visual graph view.
**Expected**: The "Carte du site" tab should show an interactive node graph visualization
**Fix**: This is a significant feature. Consider using a library like d3-force or vis-network for the graph view.

---

## ANALYTICS — HIGH

### Issue 14: Analytics "DURÉE MOYENNE" shows nonsensical value
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The stat card "DURÉE MOYENNE" displays "-30093s" which is a negative value and makes no sense. This is a data computation bug.
**Expected**: Should show a positive, human-readable duration like "12m 34s" per the mockup
**Fix**: Fix the average duration calculation in the analytics page. The issue is likely in how session durations are computed from the API data — possibly subtracting timestamps in wrong order or not handling null values.

### Issue 15: Analytics stat card labels are UPPERCASE
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: Cards show "SESSIONS TOTALES", "PAGES VUES", "UTILISATEURS UNIQUES (7J)", "DURÉE MOYENNE" in all caps
**Expected**: Mockup shows "Sessions totales" in sentence case with lighter text
**Fix**: Change label classes from uppercase to normal case

### Issue 16: Analytics missing "Sessions récentes" section with search + "Exporter CSV"
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The mockup (R001) shows a "Sessions récentes" section at the bottom with a count badge, search input, and "Exporter CSV" button. The current implementation shows "Admins & Commerciaux" and "Clients" sections instead.
**Expected**: Below the chart, show "Sessions récentes XX sessions" with a search bar and "Exporter CSV" button, followed by a sessions table
**Fix**: Add the "Sessions récentes" section with search and export functionality. The current "Admins & Commerciaux" / "Clients" split is different from the mockup — consider whether this is intentional or should be replaced.

### Issue 17: Analytics tabs positioning differs from mockup
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: In the current app, tabs (Vue générale, Par client, Par outil, Guides) are positioned below the title. In the mockup, they're positioned inline with the title in the header area, with "Vue générale" having a filled/badge style with count.
**Expected**: Tabs should be in the header row: "Analytics" title on left, then tabs "Vue générale (84)" / "Par client" / "Par outil" / "Guides" inline
**Fix**: Move tabs to the header area and style "Vue générale" tab with a filled badge showing total count

---

## INVITATIONS — MEDIUM

### Issue 18: Invitations page button label differs from mockup
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The current button says "+ Nouvel accès" while the mockup says "+ Nouvelle Invitation" (R001/R003)
**Expected**: Button should say "+ Nouvelle Invitation" per mockup
**Fix**: Change the button label from "Nouvel accès" to "Nouvelle Invitation"

### Issue 19: Invitations missing breadcrumb
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The mockup shows breadcrumb "Invitations > Accueil > Gestion des invitations" in the header. The current implementation just shows "Invitations" in the breadcrumb area.
**Expected**: Full breadcrumb: "Invitations > Accueil > Gestion des invitations"
**Fix**: Update the breadcrumb in the Header component or page to show the full path

### Issue 20: Invitations stat card labels are UPPERCASE
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: Cards show "INVITATIONS ENVOYÉES" and "CLIENTS ACTIFS" in all caps
**Expected**: Mockup shows "Invitations envoyées" and "Clients actifs" in sentence case
**Fix**: Change label case to match mockup

---

## USERS — LOW

### Issue 21: Users page not present in mockups — appears acceptable
**File**: `frontend/src/routes/admin/users/+page.svelte`
**Issue**: No specific mockup exists for the users page, but the current implementation looks clean with tabs (Tous/Admins/Clients), search, role badges, and auth method indicators.
**Expected**: N/A — no reference mockup
**Fix**: No action needed

## USERS — OK
The implementation looks well-structured and consistent with the design system.

---

## OBFUSCATION — HIGH

### Issue 22: Obfuscation table missing TYPE column
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The mockup shows columns: TYPE / RECHERCHER / REMPLACER PAR / PORTÉE / OCCURRENCES / STATUT / ACTIONS. The current implementation is missing the TYPE column (should show "Texte exact" or "Regex").
**Expected**: Add TYPE column as the first column in the rules table
**Fix**: Add a "TYPE" column showing the rule type (texte exact / regex)

### Issue 23: Obfuscation — "Portée" dropdown removed per feedback
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: Feedback R001 says "toujours global" with a "delete" gesture on the portée dropdown in the add form. This means the scope is always global and shouldn't have a dropdown selector. Current implementation shows "Toutes les pages" with a globe icon which is correct for display, but the add form should not offer a portée choice.
**Expected**: Portée should always be "Global" — no dropdown needed in the add rule form
**Fix**: Remove the portée dropdown from the inline add form. Hardcode to "Global".

### Issue 24: Obfuscation inline add form differs from mockup
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The mockup shows an inline add form at the bottom of the table with fields: Type dropdown, "Texte à masquer...", "Auto-généré si vide", scope (Global), and Ajouter/Annuler buttons. The current implementation has a "+ Ajouter une règle" button that may open a different form style.
**Expected**: Inline form at the bottom of the table matching the mockup
**Fix**: Implement the inline add form at the bottom of the table with the fields shown in the mockup

---

## DEMANDES MAJ (Update Requests) — LOW

### Issue 25: No specific mockup for Update Requests page
**File**: `frontend/src/routes/admin/update-requests/+page.svelte` (inferred from route)
**Issue**: The current implementation looks functional with stat cards (En attente / En cours / Terminées), tabs, and request cards with status badges and action buttons. No specific mockup exists for comparison.
**Expected**: N/A
**Fix**: No action needed — the implementation follows design system patterns well

## DEMANDES MAJ — OK
Good implementation consistent with the overall design system.

---

## COMMAND PALETTE — MEDIUM

### Issue 26: Command palette doesn't search pages
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The mockup shows search results including "Pages" results (e.g., "Dashboard principal" with a SALESFORCE badge, showing project info). The current implementation searches projects and users but NOT pages. The "Pages" tab exists but has no backend search functionality for pages.
**Expected**: Command palette should search across pages (with project badge), projects, users, and actions — matching the mockup
**Fix**: Add page search to the command palette by querying the pages API endpoint and displaying results with project name badges

### Issue 27: Command palette search results don't show project badges
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The mockup shows page results with colored project badges (e.g., "SALESFORCE" in blue, "SAP" in red). Current implementation only shows subtitle text.
**Expected**: Search results for pages should include colored project name badges
**Fix**: Add project badge styling to page search results

### Issue 28: Command palette — feedback says remove shortcuts and rename to "recherche admin"
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: Feedback R003 (resolved) says: "raccourcis non nécessaires. Et renomme la maquette et la feature 'résultat de recherche'". The keyboard shortcuts (⌘P, ⌘N) shown next to action items were requested to be removed, and the feature should be conceptualized as "recherche admin" (admin search) rather than a command palette.
**Expected**: Per R003: remove keyboard shortcut badges from action items. The feature name should be "recherche admin" conceptually.
**Fix**: Remove the `subtitle` keyboard shortcut text (⌘P, ⌘N) from the quickActions entries. Actions should still appear but without keyboard shortcut hints next to them.

---

## SIDEBAR — MEDIUM

### Issue 29: Sidebar section labels differ slightly from mockup
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The mockup (R009) shows the sidebar with section labels: PRINCIPAL, GESTION, OUTILS SIMULÉS. The nav items under GESTION include "Composants" which is not in the design spec (CLAUDE.md lists: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres). The current app sidebar shows "Composants" as a nav item.
**Expected**: GESTION section should contain: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres. "Composants" is not in the spec.
**Fix**: Verify if "Composants" is intentionally added or should be removed from the sidebar. Per CLAUDE.md spec, it's not listed.

---

## HEADER — LOW

### Issue 30: Header breadcrumbs are inconsistent across pages
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: The mockup shows breadcrumbs like "Dashboard > Accueil > Vue d'ensemble" and "Invitations > Accueil > Gestion des invitations". The current implementation shows simpler breadcrumbs like "Administration > Projets" or just "Administration".
**Expected**: Richer breadcrumbs matching the mockup patterns with intermediate levels
**Fix**: Update breadcrumb generation to include "Accueil" or descriptive intermediate segments

### Issue 31: Header search placeholder text differs
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: Current: "Rechercher..." — Mockup: "Rechercher pages, projets, utilisateurs... ⌘K"
**Expected**: More descriptive placeholder: "Rechercher pages, projets, utilisateurs..."
**Fix**: Update the search input placeholder text

---

## GLOBAL DESIGN SYSTEM — MEDIUM

### Issue 32: Stat card labels use UPPERCASE tracking across all pages
**File**: Multiple files (dashboard, analytics, invitations)
**Issue**: All stat cards use uppercase label text with letter-spacing (e.g., "PROJETS ACTIFS", "SESSIONS TOTALES", "INVITATIONS ENVOYÉES"). The mockup consistently uses sentence case with lighter gray text.
**Expected**: Sentence case labels: "Projets actifs", "Sessions totales", "Invitations envoyées"
**Fix**: Update the stat card components/styles across all pages to use sentence case. If there's a shared StatCard component, fix it there.

---

## CRITICAL ISSUES

### Issue 33: Analytics shows negative/nonsensical duration (-30093s)
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The "DURÉE MOYENNE" stat card displays "-30093s" — this is a CRITICAL data display bug visible to users.
**Expected**: Positive, human-readable duration (e.g., "2m 45s")
**Fix**: Debug the duration calculation. Likely issues: timestamps subtracted in wrong order, missing null checks, or incorrect unit conversion.

### Issue 34: Login page may serve wrong version
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Two different login designs exist (old "Environnements de Démonstration" design and new tabbed "Environnements Simulés" design). If the old design is still being served as the default, users see an outdated, incorrect page.
**Expected**: Only the new tabbed design should be served
**Fix**: Verify which design is served at /login and ensure it's the new tabbed version only.

---

## PAGES NOT YET IMPLEMENTED (tracked but not bugs)

The following pages from the mockups have no corresponding implementation yet:
- **Page Editor** (`/admin/editor/[id]`) — mockup exists (maquette-page-editor-25fev26)
- **Demo Viewer** (`/demo/[...path]`) — mockup exists (maquette-demo-viewer-24fev26)
- **Commercial Viewer** (`/view/[...path]`) — mockup exists (maquette-commercial-viewer-24fev26)

These are tracked in PHASES.md and not counted as bugs.

---

## SUMMARY

| Page | Verdict |
|------|---------|
| Login | HIGH — two designs coexist, old one may be served |
| Dashboard | HIGH — layout differs significantly from mockup |
| Dashboard Collapsed | MEDIUM — missing tooltips |
| Projects List | MEDIUM — duplicate buttons |
| Project Detail | OK |
| Tree View | HIGH — missing detail panel, wrong tab labels, missing graph view |
| Analytics | CRITICAL — negative duration, HIGH — layout differences |
| Invitations | MEDIUM — wrong button label, uppercase labels |
| Users | OK |
| Obfuscation | HIGH — missing TYPE column, add form differences |
| Update Requests | OK |
| Command Palette | MEDIUM — missing page search, missing project badges |
| Sidebar | MEDIUM — extra "Composants" item |
| Header | LOW — breadcrumb and placeholder differences |

TOTAL_ISSUES: 29
CRITICAL: 2
HIGH: 9
MEDIUM: 12
LOW: 6
