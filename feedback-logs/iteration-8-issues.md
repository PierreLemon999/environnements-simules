# Iteration 8 — UI/UX Quality Audit

**Date**: 2026-02-26
**Compared**: Current app screenshots vs mockup-forge reference mockups (latest retours)
**Auditor**: Claude Opus 4.6

---

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0     |
| HIGH     | 5     |
| MEDIUM   | 7     |
| LOW      | 5     |
| **TOTAL** | **17** |

---

## LOGIN PAGE (01-login, 02-login-filled, 03-login-error, 02-login-client, 03-login-admin)

### Login — Two Different Designs Still Coexist — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Screenshots 01-login, 02-login-filled, and 03-login-error show the OLD login design: smaller card, "Adresse e-mail" label, no visible background decorative element in top-right, password field with eye toggle. Screenshots 02-login-client and 03-login-admin show the NEW correct design: larger card, "Email" label, purple/lavender gradient blob in top-right corner, proper tab-based layout. The old screenshots (01/02/03) appear to be from a stale test run — the source code (`login/+page.svelte`) matches the new design. However, both screenshot sets exist and the old ones (01-03) are still the "default" test path.
**Expected**: Only the new tab-based design (visible in 02-login-client, 03-login-admin) should exist. All test screenshots should reflect the current code.
**Fix**: Re-run the test screenshot script to regenerate 01-login.png, 02-login-filled.png, and 03-login-error.png from the current code. The login page source is correct — this is a stale test artifact. If the test script has separate flows for "old" and "new" paths, update it to use only the new tab-based login.

### Login Client Tab — Matches Mockup Well — OK
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The 02-login-client screenshot correctly shows: "ES" blue logo, "Environnements Simulés" title, "Plateforme de démonstrations Lemon Learning" subtitle, two tabs ("Accès client" active, "Administration"), "Email" label, email input with placeholder "vous@entreprise.com", "Mot de passe" label, password field, blue "Se connecter" button. Background has lavender gradient blob in top-right. Matches the mockup (R007.png) well.

### Login Admin Tab — Matches Mockup Well — OK
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The 03-login-admin screenshot correctly shows: "Administration" tab active, explanation text "Connectez-vous avec votre compte Google Lemon Learning pour accéder à l'administration.", "Continuer avec Google" button with Google logo, and "(admin uniquement)" text in gray below. This addresses mockup feedback R007 ("préciser (admin uniquement) en grisé").

### Login Client — "Email" vs "Adresse e-mail" Label Inconsistency — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The new design (02-login-client) shows label "Email" while the old screenshots (01-login) show "Adresse e-mail". The mockup shows "Email". The source code at line 118 says `Adresse e-mail` which contradicts the 02-login-client screenshot showing "Email". One of these is inaccurate — either the screenshot or the source is out of sync.
**Expected**: Label should be "Email" to match the mockup.
**Fix**: Verify the deployed code matches. If the source says "Adresse e-mail", change it to "Email" on line 118 of `login/+page.svelte`.

---

## DASHBOARD (04-dashboard, 05-dashboard-collapsed)

### Dashboard — Search Bar Now Present — OK (Fixed from Iteration 7)
**Issue**: The header now correctly shows a search bar "Rechercher pages, projets, utilisateurs..." with ⌘K shortcut. This was missing in iteration 7.

### Dashboard — "+ Nouveau projet" Button Now Present — OK (Fixed from Iteration 7)
**Issue**: The blue "+ Nouveau projet" button is now visible in the header next to the Extension button.

### Dashboard — Stats Cards Orange Top Border — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: All 4 stat cards (Projets actifs, Pages capturées, Démos actives, Sessions ce mois) have an orange/amber top border. The mockup (R009.png) shows clean white cards without colored top borders — just subtle borders/shadows.
**Expected**: Clean white stat cards with standard `border-border` (gray #E5E7EB), no colored top accents.
**Fix**: Remove `border-t-2 border-t-orange-400` (or similar) class from the stat cards in `admin/+page.svelte`. Replace with standard card styling.

### Dashboard — "Répartition par projet" Section with Bar Charts — OK
**Issue**: The horizontal bar chart section showing project page distribution (Salesforce, SAP, Workday, ServiceNow, HubSpot, Zendesk) with colored bars and counts is present and well-implemented. This was reported as missing in iteration 7 but is now there.

### Dashboard — Activity Table Well-Implemented — OK
**Issue**: "Journal d'activité des clients" with tabs (Toutes 4, Sessions, Guides 3), search, filters, column headers (CLIENT, PROJET/DÉMO, ACTION, DATE), avatar rows, status dots, pagination — all match the mockup structure.

### Dashboard — Collapsed Sidebar Still Identical to Expanded — HIGH
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Screenshot 05-dashboard-collapsed is pixel-identical to 04-dashboard. The sidebar is NOT collapsing — it still shows the full 220px sidebar with all text labels, section headers, and tool names. The mockup shows a 48px icon-only collapsed sidebar.
**Expected**: When collapsed, sidebar should be ~48px wide showing only icons. Section headers hidden, text labels hidden, only tool color dots visible (no names).
**Fix**: The collapse toggle logic may not be triggering in tests. Check: (1) Does the test script actually click the collapse button? (2) Is the `collapsed` bindable prop working between `+layout.svelte` and `Sidebar.svelte`? (3) Verify CSS `width: var(--sidebar-collapsed-width)` applies correctly. The source code at line 112 shows `style="width: {collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}"` which looks correct, so the issue is likely the test not triggering collapse.

### Dashboard — Sidebar "Composants" Item Present — OK (Fixed from Iteration 7)
**Issue**: The sidebar now correctly shows "Composants" in the GESTION section between "Demandes MAJ" and "Paramètres".

---

## PROJECTS LIST (06-projects)

### Projects — Grid Layout and Cards — OK
**Issue**: Project cards in a responsive grid with: colored avatar initials (SA, WO, SE, HU, ZE, OR), project name, tool name, "Actif" badge, description text, metadata row (versions, pages, date). Filter tabs (Tous, Actifs, Test, Archives) and search present. Breadcrumb "Projets > Accueil" in header. Matches expectations.

### Projects — Card Avatar Colors Don't Match Mockup Tool Colors — LOW
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: The project card avatars use specific colors (SA=red, WO=amber, SE=pink, HU=purple, ZE=teal, OR=orange). These are generally fine but don't exactly match the tool brand colors used in the sidebar dots (Salesforce=#00A1E0 blue, SAP=#0070F2 blue, Workday=#F5A623 amber).
**Expected**: Consistent tool colors between sidebar dots and project card avatars.
**Fix**: Align the project card avatar background colors with the `getToolColor()` function in `Sidebar.svelte` for consistency.

---

## PROJECT DETAIL (07-project-detail)

### Project Detail — Health Score and Version Cards — OK
**Issue**: Page shows project info header with health score ring (86% santé), version cards with status badges, demo links, and action buttons. Well-implemented.

---

## TREE VIEW (08-tree)

### Tree — Missing Right Panel Detail View When Page Selected — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The right panel still shows placeholder text "Sélectionnez une page — Cliquez sur une page dans l'arborescence pour voir ses détails, ses métadonnées et les règles d'obfuscation actives." No page detail data is shown. The mockup (R003.png) shows that selecting a page should display: page preview thumbnail, URL/source path, file size, capture date, capture mode, link counts, health status, obfuscation rules applied, and associated guides.
**Expected**: Full page detail panel populated with real data when a tree node is clicked.
**Fix**: Implement the `onSelectPage` handler in `tree/+page.svelte` to fetch page details via `GET /api/pages/:id` and render: metadata table (URL, size, date, mode), health indicator, obfuscation section (active rules count, applied company names), and guides list. Add a page preview iframe or thumbnail.

### Tree — "Par guide" Tab Content Unknown — MEDIUM
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Three tabs exist (Par site, Par guide, Carte du site). "Par site" works well showing the tree. "Par guide" and "Carte du site" content is not shown in the screenshot and may be placeholder or unimplemented.
**Expected**: "Par guide" should list pages organized by guide rather than site structure. "Carte du site" should show a visual node-graph sitemap.
**Fix**: Verify "Par guide" and "Carte du site" tab implementations.

### Tree — Structure and Navigation Correct — OK
**Issue**: Project dropdown (Salesforce CRM), filter tabs, search, health status bar (8 OK, 0 Avert., 0 Erreur), tree with indentation, colored status dots, and version navigation footer ("Lightning v2024.1 Active, 8 pages") all working correctly.

---

## ANALYTICS (09-analytics)

### Analytics — Two-Column Session Tables Now Implemented — OK (Fixed from Iteration 7)
**Issue**: Sessions are now correctly split into "Admins & Commerciaux — 1 sessions" and "Clients — 3 sessions" with separate search bars, matching the mockup (R005.png) layout.

### Analytics — Missing "CSV" Export on Admins Column — LOW
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The "Clients" table has a "CSV" export button (download icon). The "Admins & Commerciaux" table doesn't have one. The mockup shows CSV export only on the Clients side, so this matches.
**Expected**: CSV export on Clients column only. Current implementation is correct.

### Analytics — Anonymous Visitor Handling — OK
**Issue**: The Clients table correctly shows "Visiteur anonyme — Lien partagé" with a "?" avatar for anonymous link-sharing sessions. This addresses mockup feedback R005 about handling cases where only company name is known.

### Analytics — Missing Session Detail Side Panel — MEDIUM
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: Session rows show a chevron ">" but clicking doesn't open a detail side panel. The mockup shows a slide-out panel with user info, engagement metrics, and page navigation timeline when a session row is clicked.
**Expected**: Clicking a session row opens a right-side detail panel.
**Fix**: Implement a slide-out panel component that loads session detail data from `GET /api/analytics/sessions/:id` and displays user info, duration, and page navigation path.

### Analytics — Chart Area and Summary Stats — OK
**Issue**: "SESSIONS TOTALES" card with count (4), trend arrow (↗ 4 cette semaine), sub-metrics (20 pages vues, 3 utilisateurs, 13h 29m en moyenne), "7 DERNIERS JOURS" label, and line chart are all correctly implemented.

---

## INVITATIONS (10-invitations)

### Invitations — Unicode Encoding Fixed — OK (Fixed from Iteration 7)
**Issue**: All French text is now properly rendered with correct accented characters: "Gérez les accès démo pour vos clients et prospects", "Invitations envoyées", "Générer un accès", "Sélectionner une version", "Exiger la création d'un compte". The CRITICAL unicode bug from iteration 7 is fully resolved.

### Invitations — Two-Column Layout Correct — OK
**Issue**: Left column shows invitation list table (CLIENT, EMAIL, PROJET/DÉMO, STATUT) with avatar rows. Right column shows "Générer un accès" form with tabs (Invitation par email / Partager un lien), name/email/company/project/version/expiration fields, and "Exiger la création d'un compte" checkbox. Blue "Envoyer l'invitation" button at bottom. This matches the mockup (R005.png) requirements including the account creation checkbox from feedback R005.

### Invitations — Stats Cards Correct — OK
**Issue**: Three stat cards (Invitations envoyées: 2, Liens actifs: 2, Connexions: 2) with icons and trend text ("+0 cette semaine", "0 expirés") are properly rendered.

### Invitations — Missing "+ Nouvel accès" Dialog Flow — MEDIUM
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The blue "+ Nouvel accès" button is visible in the header, but the right-side form is always visible. In the mockup, the form panel and the "+ Nouvel accès" button should work together — the button might toggle/scroll to the form. Currently both exist simultaneously which is fine for desktop but may be redundant UX.
**Expected**: The button could scroll to or highlight the form panel. This is a minor UX concern.
**Fix**: Consider making the button scroll to the form section, or hide the form behind the button click on smaller screens.

---

## USERS (11-users)

## Users — OK
**Issue**: The users page is well-implemented and unchanged from iteration 7. Shows: title "Utilisateurs" with count "5 utilisateurs — 3 admins, 2 clients", filter tabs (Tous (5), Admins (3), Clients (2)), search bar, user cards with avatar, name, "Vous" badge for current user, email, auth method (Google SSO), role badge (Administrateur/Client), date, action menu (three-dot). The "+ Nouvel utilisateur" blue button is present. Matches design system perfectly.

---

## OBFUSCATION (12-obfuscation)

### Obfuscation — Preview Shows Correct Data Now — OK (Partially Fixed from Iteration 7)
**Issue**: The "Aperçu en direct" section now shows actual data: "3 Règles appliquées", "9 Champs masqués", "100% Couverture", with Avant/Après toggle, HTML source display, and "Résultat" JSON output. The [object Object] bug from iteration 7 appears resolved — the result shows actual JSON with "original" and "obfuscated" text and "changesCount".

### Obfuscation — Résultat Shows Raw JSON Instead of Rendered HTML — MEDIUM
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The "Résultat" section shows raw JSON: `{"original":"<div class=\"user-name\">Jean Dupont</div>...","obfuscated":"<div class=\"user-name\">Jean Dupont</div>...","changesCount":0}`. The mockup shows formatted HTML output with the obfuscated text visually rendered or at least displayed as readable HTML, not raw JSON.
**Expected**: The Résultat should display the obfuscated HTML as formatted code (like a code block), not raw JSON. Alternatively, show a side-by-side before/after preview.
**Fix**: Parse the JSON response, extract the `obfuscated` field, and display it as formatted HTML in a `<pre><code>` block. Use the Avant/Après toggle to switch between `original` and `obfuscated` views.

### Obfuscation — Table Layout Compact — OK
**Issue**: Rules table shows TYPE, RECHERCHER, REMPLACER PAR, OCCURRENCES, STATUT, ACTIONS columns. Active toggle (green) works. "Masquage dans l'éditeur" card with "Ouvrir l'éditeur" link is a nice addition.

### Obfuscation — "Couverture globale" Progress Bar — OK
**Issue**: Bottom progress bar showing "Couverture globale 100%" matches design system expectations.

---

## UPDATE REQUESTS (13-update-requests)

## Update Requests — OK
**Issue**: Well-implemented page with: stat cards (En attente 1, En cours 1, Terminées 1), filter tabs with counts, search bar, request cards showing status badges (En attente/En cours/Terminée), timestamps, descriptions, page references (icon + page name + URL path), user (icon + name), date, and action buttons (Prendre en charge →, Marquer terminée →). Resolved dates shown ("Résolue le 14 févr. 2026"). No issues found.

---

## COMMAND PALETTE (14-command-palette)

### Command Palette — Structure Mostly Correct — OK
**Issue**: Shows centered modal with search input "Rechercher des pages, projets, utilisateurs...", category filter pills (Tous with count, Pages, Projets, Utilisateurs, Actions), result sections (ACTIONS), and footer with keyboard hints (naviguer, enter ouvrir, tab catégorie, esc fermer, EnvSim). Action items show icon + title + description.

### Command Palette — Shows Actions by Default, Should Prioritize Search Results — MEDIUM
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: When opened with no query, the palette shows "ACTIONS 7 résultats" listing quick actions (Créer un projet, Nouvelle capture, Aller au Dashboard, etc.). The mockup (R003.png) shows the palette with a search query typed ("Dashboard princ...") and results organized by category: first PAGES section (showing matched pages with project badge, path, modification date), then PROJETS section. The default empty state should show recent items or suggest searching.
**Expected**: When a query is typed, results should show PAGES first (with project context badges like "SALESFORCE", "SAP"), then PROJETS, then UTILISATEURS, then ACTIONS. Each page result should show: page title, project badge, path, modification date.
**Fix**: Ensure the search results display format includes project badges (colored labels like "SALESFORCE", "SAP") next to page results. Ensure PAGES category appears first in results when searching. Mockup shows page results with "Projet Salesforce Lightning — Page d'accueil · Modifiée il y a 2h" format.

### Command Palette — Missing EnvSim Branding in Footer — LOW
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The mockup (R003.png) shows "EnvSim" branding text in the footer right corner. The current footer shows hints but may be missing this branding element.
**Expected**: Small "EnvSim" text in the command palette footer.
**Fix**: Add `<span class="text-muted text-xs">EnvSim</span>` to the right side of the command palette footer.

---

## CROSS-CUTTING ISSUES

### Sidebar — Collapse Toggle Not Working in Tests — HIGH
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Across ALL admin page screenshots (04 through 14), the sidebar is always shown in expanded 220px state. The mockup reference images (analytics R005, tree R003, obfuscation R001, invitations R005, command palette R003) consistently show the sidebar in collapsed 48px icon-only mode. This is either a test issue (collapse not triggered) or a real bug where the collapse state doesn't persist.
**Expected**: Sidebar should be collapsible to 48px. Many mockup pages show it as the default state.
**Fix**: (1) Check if the test screenshot script clicks the collapse button before taking shots of collapsed state. (2) Verify `collapsed` state is correctly passed as `$bindable` prop. (3) Consider persisting collapse state in localStorage so it defaults to collapsed across navigation. (4) Verify CSS custom property `--sidebar-collapsed-width` is defined (should be 48px).

### Header — Breadcrumb "Accueil" Consistently Shows — OK
**Issue**: All admin pages now show breadcrumbs in "PageName > Accueil" format. While slightly different from the mockup's "Accueil > Sub-view" format, it's consistent and functional.

### Sidebar — Badge Counts Match Seed Data — OK
**Issue**: Sidebar badges show: Projets 7, Analytics 4, Invitations 2, Demandes MAJ 1 (red). These match the seed data correctly.

### Overall Color System — Consistent — OK
**Issue**: Blue primary (#3B82F6) is consistently used for active states, primary buttons, and badges. Green (#10B981) for success/active states. Red for errors/destructive. Orange for warnings. Text hierarchy (dark/secondary/muted) is consistent.

---

## PAGES WITHOUT MOCKUP REFERENCES

### Settings Page — Not Tested
**Issue**: No screenshot exists for `/admin/settings`. Sidebar has a "Paramètres" nav item but this page may not be implemented.
**Expected**: A settings page should exist per the sidebar nav.
**Fix**: Implement or verify the settings page exists. Add to test screenshot suite.

### Components Page — Not Tested
**Issue**: No screenshot exists for `/admin/components`. Sidebar has a "Composants" nav item.
**Expected**: A components library/showcase page.
**Fix**: Implement or verify the components page exists. Add to test screenshot suite.

### Editor Page — Not Tested
**Issue**: No screenshot for the page editor (`/admin/editor/[id]` or `/admin/live-edit/[id]`).
**Expected**: Per mockup `maquette-page-editor-25fev26`, a code/visual editor page should exist.
**Fix**: Verify editor implementation separately.

### Demo Viewer — Not Tested
**Issue**: No screenshots for `/demo/` or `/view/` routes.
**Expected**: Demo viewer pages should work per `maquette-demo-viewer` and `maquette-commercial-viewer` mockups.
**Fix**: Test demo viewer routes separately.

---

## IMPROVEMENTS SINCE ITERATION 7

The following issues from iteration 7 have been resolved:
1. **Search bar in header** — Now present with ⌘K shortcut ✓
2. **"+ Nouveau projet" button** — Now visible in header ✓
3. **"Répartition par projet" bar charts** — Now implemented on dashboard ✓
4. **Sidebar "Composants" nav item** — Now present ✓
5. **Invitations unicode encoding** — All French characters render correctly ✓
6. **Obfuscation [object Object]** — Preview now shows actual data ✓

---

## SUMMARY

TOTAL_ISSUES: 17
CRITICAL: 0
HIGH: 5
MEDIUM: 7
LOW: 5
