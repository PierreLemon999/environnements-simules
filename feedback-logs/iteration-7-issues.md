# Iteration 7 — UI/UX Quality Audit

**Date**: 2026-02-26
**Compared**: Current app screenshots vs mockup-forge reference mockups (latest retours)
**Auditor**: Claude Opus 4.6

---

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 8     |
| MEDIUM   | 11    |
| LOW      | 5     |
| **TOTAL** | **26** |

---

## LOGIN PAGE (01-login, 02-login-filled, 02-login-client, 03-login-admin, 03-login-error)

### Login — Two Different Designs Coexist — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Screenshots 01/02/03 show the OLD login design (single form with "Environnements de Démonstration" title, "IDENTIFIANTS" section label, "Se souvenir de moi", "Mot de passe oublié", Google SSO at bottom). Screenshots 02-login-client and 03-login-admin show the NEW tab-based design ("Accès client" / "Administration" tabs, "Environnements Simulés" title, "Plateforme de démonstrations Lemon Learning" subtitle). The old design appears in some test paths while the new design appears in others.
**Expected**: Only the new tab-based design should exist. The mockup shows a clean card with two tabs: "Accès client" (email+password form) and "Administration" (Google SSO with explanation text).
**Fix**: Ensure all login routes consistently render the new tab-based login component. The old design should be fully removed. Check if the test screenshots are stale or if there's a conditional rendering path.

### Login Client Tab — Missing Background Decoration — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The new login design (02-login-client) shows a purple/lavender gradient circle in the top-right corner as a decorative element. This matches the mockup's background treatment.
**Expected**: Mockup has subtle gradient blobs on the background. The app has them — this is fine.
**Fix**: No fix needed for this specific element.

### Login Admin Tab — Correct Implementation — OK
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The "Administration" tab (03-login-admin) correctly shows: "Connectez-vous avec votre compte Google Lemon Learning pour accéder à l'administration.", a "Continuer avec Google" button, and "(admin uniquement)" text in gray below. This matches the mockup feedback R007 which requested "(admin uniquement) en grisé".
**Expected**: Matches mockup.
**Fix**: None needed.

### Login Old Design — Still Visible — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The old login (screenshots 01, 02-login-filled, 03-login-error) still shows title "Environnements de Démonstration" instead of "Environnements Simulés", has a section label "IDENTIFIANTS", shows "Se souvenir de moi" checkbox and "Mot de passe oublié" link, and places Google SSO below a divider "ou se connecter avec". This old layout is a completely different design from the mockup.
**Expected**: The new tab-based login design everywhere. No "Se souvenir de moi", no "Mot de passe oublié", no "IDENTIFIANTS" label.
**Fix**: The screenshots 01/02/03 appear to be from a previous test run and may be stale. If the login page code has been updated, re-run the screenshot tests. If not, the login page needs to be fully migrated to the tab-based design.

---

## DASHBOARD (04-dashboard, 05-dashboard-collapsed)

### Dashboard — Missing Global Search Bar — HIGH
**File**: `frontend/src/routes/admin/+layout.svelte` or `frontend/src/lib/components/layout/Header.svelte`
**Issue**: The mockup (R005) shows a prominent search bar in the top header: "Rechercher pages, projets, utilisateurs... ⌘K". The current app has no search bar in the header — only the notification bell, help icon, and Extension button.
**Expected**: A centered search input in the header with placeholder text "Rechercher pages, projets, utilisateurs..." and a ⌘K shortcut indicator.
**Fix**: Add a search input to the Header component that triggers the CommandPalette on click/focus, positioned between the page title and the right-side icons.

### Dashboard — Missing "+ Nouveau projet" Button — MEDIUM
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: The mockup shows a blue "+ Nouveau projet" button in the top-right header area. The current app only has "Extension" button there.
**Expected**: Both "Extension" and "+ Nouveau projet" buttons in the header.
**Fix**: Add a primary blue "Nouveau projet" button next to the Extension button in the header, visible on Dashboard and Projects pages.

### Dashboard — Stats Cards Missing Top Border Color — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The current dashboard has 4 stats cards (Projets actifs, Pages capturées, Démos actives, Sessions ce mois) with an orange top border. The mockup shows cards without colored top borders — they're clean white cards with subtle shadows.
**Expected**: Clean white stat cards without colored top borders, matching the mockup's minimal style.
**Fix**: Remove the `border-t-4 border-t-orange-...` class from stat cards. Use clean white bg with subtle border-border only.

### Dashboard — Stats Cards Have Colored Icons Not Matching Mockup — LOW
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Current stats cards show colored icon backgrounds (blue folder, green eye, orange chart). The mockup shows more subtle, monochrome file icons.
**Expected**: Subtle gray/muted icons without colored backgrounds.
**Fix**: Change icon styling to use muted colors without bg-color circles.

### Dashboard — Activity Table Mostly Correct — OK
**Issue**: The "Journal d'activité des clients" section with tabs (Toutes, Sessions, Guides), search, filters, and the data table are well-implemented and match the mockup structure.

### Dashboard — Sidebar "Composants" Item Missing — MEDIUM
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The mockup sidebar under GESTION shows: Utilisateurs, Obfuscation, Demandes MAJ, **Composants**, Paramètres. The current app sidebar shows: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres — missing "Composants".
**Expected**: A "Composants" nav item between "Demandes MAJ" and "Paramètres" in the GESTION section.
**Fix**: Add a "Composants" item to `gestionItems` in `Sidebar.svelte` with an appropriate icon (e.g., `Component` or `Puzzle` from lucide). This links to a future `/admin/components` page.

### Dashboard — Sidebar Projects Don't Show "HubSpot" and "Zendesk" — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The mockup shows 6 simulated tools in OUTILS SIMULÉS (Salesforce 128, SAP SuccessFactors 74, Workday 52, ServiceNow 38, HubSpot 24, Zendesk 16). The current app shows only 4 (Salesforce 8, SAP SuccessFactors, Workday, ServiceNow 5). This is a data issue, not a UI bug — seed data has fewer projects.
**Expected**: More tools listed. This is data-dependent and not a code bug.
**Fix**: Update seed data to include HubSpot and Zendesk projects, or accept that this is seed-data-dependent.

### Dashboard — Collapsed Sidebar Identical to Expanded — HIGH
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Screenshot 05-dashboard-collapsed looks IDENTICAL to 04-dashboard. The sidebar is NOT collapsed — it still shows the full 220px sidebar with text labels. The mockup shows a 48px icon-only sidebar when collapsed.
**Expected**: When collapsed, sidebar should show only icons (no text labels), ES avatar (no title), no section headers, approximately 48px wide.
**Fix**: Check the collapsed state logic in Sidebar.svelte. The collapse toggle button exists (the `ChevronsLeft` icon) but the collapsed state may not be toggling correctly, or the test isn't triggering it. Verify the `collapsed` prop binding and CSS transitions.

---

## PROJECTS LIST (06-projects)

### Projects — Overall Layout Correct — OK
**Issue**: The projects page shows cards in a grid with project avatar, name, tool name, status badge, description, version count, page count, and date. This matches the mockup structure reasonably well.

### Projects — Missing Stats Bar/Horizontal Charts — MEDIUM
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: The dashboard mockup (R005) shows a section below stat cards with horizontal bar charts representing project page counts as colored blocks. The current app jumps directly to the activity table.
**Expected**: A mini project overview section with colored page-count bars before the activity table on the dashboard.
**Fix**: Add a project summary visualization section to the dashboard page between stat cards and the activity table, showing colored bars per project.

---

## PROJECT DETAIL (07-project-detail)

### Project Detail — Health Score Ring Good — OK
**Issue**: The health score ring (86% santé) is correctly implemented with a circular progress indicator. Matches mockup concept.

### Project Detail — Version Cards Well Implemented — OK
**Issue**: Version cards show name, status badge (Actif), language badge, date, and action buttons (Ouvrir demo, Arborescence, Dupliquer, more). This matches the mockup requirements.

---

## TREE VIEW (08-tree)

### Tree — Missing Right Panel Detail View — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: When a page is selected in the tree, the mockup shows a right panel with: page thumbnail preview, URL source, file size (Taille), capture date, capture mode, outgoing links count, broken links count, health status (Santé: OK), obfuscation active section (company names, rules count), and associated guides. The current app shows only a placeholder: "Sélectionnez une page — Cliquez sur une page dans l'arborescence pour voir ses détails..."
**Expected**: Full page detail panel on the right when a page is selected.
**Fix**: Implement the page detail panel in the tree view that loads page metadata, obfuscation rules, and guides when a tree node is clicked. The panel should match the mockup layout with thumbnail, metadata table, obfuscation section, and guides section.

### Tree — Missing "Carte du site" Tab Content — MEDIUM
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The mockup (R002) shows a "Carte du site" tab that displays a visual sitemap (node-graph style) with pages as boxes connected by lines, showing module categories, page counts, and modal indicators. The current app has the tab but may not implement the visual sitemap.
**Expected**: A visual graph/sitemap view showing pages as connected nodes when "Carte du site" tab is active.
**Fix**: Implement the sitemap visualization in the "Carte du site" tab, potentially using a canvas-based or SVG-based graph layout.

### Tree — Status Bar Matches — OK
**Issue**: The tree view correctly shows health status bar (8 OK, 0 Avert., 0 Erreur) with colored progress bar. Matches mockup.

### Tree — Version Navigation Footer Correct — OK
**Issue**: Bottom bar shows "Lightning v2024.1 Active" with prev/next arrows and page count. Matches mockup.

---

## ANALYTICS (09-analytics)

### Analytics — Overall Structure Correct — OK
**Issue**: The analytics page correctly shows: tabs (Vue générale, Par client, Par outil, Guides), "En direct" indicator, project filter, date range picker, Sessions totales card with chart, and Sessions récentes table. This is well-implemented.

### Analytics — Missing Split Session Tables — MEDIUM
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The mockup (R005) shows the sessions table split into two columns: "Admins & Commerciaux — 33 sessions" on the left and "Clients — 51 sessions" on the right, each with their own search bar. The current app shows a single unified "Sessions récentes — 4 sessions" table.
**Expected**: Two-column session table layout separating internal (Admin) sessions from external (Client) sessions.
**Fix**: Split the sessions table into two side-by-side tables: one for Admin sessions and one for Client sessions, each with their own heading, count, and search bar.

### Analytics — Missing Session Detail Side Panel — MEDIUM
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The mockup (R003/R004) shows that clicking a session row opens a right side panel with: user avatar, name, email, "Score d'engagement" ring (92), role badge (Prospect), duration (12m 34s), and a "PARCOURS" section showing the user's page navigation timeline. The current app shows a chevron ">" on session rows but there's no evidence of a slide-out detail panel.
**Expected**: Clicking a session row should open a right-side detail panel with engagement score, role, duration, and navigation path timeline.
**Fix**: Implement a slide-out/side panel component for session details that appears when a table row is clicked, showing the engagement metrics and page navigation path.

---

## INVITATIONS (10-invitations)

### Invitations — Unicode Encoding Bug — CRITICAL
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The entire invitations page shows raw Unicode escape sequences instead of French characters. Examples: "G\u00e9rez les acc\u00e8s d\u00e9mo" instead of "Gérez les accès démo", "Invitations envoy\u00e9es" instead of "Invitations envoyées", "G\u00e9n\u00e9rer un acc\u00e8s" instead of "Générer un accès", "S\u00e9lectionner une version" instead of "Sélectionner une version", "3 mois (recommand\u00e9)" instead of "3 mois (recommandé)", "Exiger la cr\u00e9ation d'un compte" instead of "Exiger la création d'un compte". This affects all French text on the page.
**Expected**: Proper French characters (é, è, ê, ô, etc.) rendered correctly.
**Fix**: The Svelte file contains escaped Unicode sequences (`\u00e9` etc.) instead of actual UTF-8 characters. Replace all `\u00XX` sequences with their actual characters throughout the file. For example: `\u00e9` → `é`, `\u00e8` → `è`, `\u00e0` → `à`, `\u00ea` → `ê`, `\u00fb` → `û`, `\u00c9` → `É`. Run a find-and-replace on the entire file.

### Invitations — Stats Card Labels Broken — CRITICAL
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: All three stat cards at the top show broken text due to unicode encoding: "Invitations envoy\u00e9es", "Liens actifs" (partially OK), "Connexions". The trend text also shows "0 expir\u00e9s" with raw escapes.
**Expected**: "Invitations envoyées", "Liens actifs", "Connexions" with proper accented characters.
**Fix**: Same as above — fix all Unicode escape sequences in the file.

### Invitations — Table Column Header Truncated — HIGH
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The table column header shows "PROJET/D\U00E9MO" with raw unicode instead of "PROJET/DÉMO". Additionally the STAT column header is truncated.
**Expected**: Clean "PROJET/DÉMO" and "STATUT" column headers.
**Fix**: Fix unicode sequences AND ensure table has enough width for all columns. Consider making the table horizontally scrollable or reducing padding.

### Invitations — "Nouvel accès" Button Label Broken — HIGH
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The blue button in top-right shows "Nouvel acc\u00e8s" instead of "Nouvel accès".
**Expected**: "Nouvel accès" properly rendered.
**Fix**: Fix unicode escape in the button label.

### Invitations — Right Panel Form Working — OK
**Issue**: The right-side "Générer un accès" form with tabs (Invitation par email / Partager un lien), name/email/company fields, project/version dropdowns, expiration, and "Exiger la création d'un compte" checkbox are all present and correctly structured. Layout matches mockup concept (two-column: list on left, form on right).

---

## USERS (11-users)

## Users — OK
**Issue**: The users page is well-implemented. Shows: title with user count breakdown (5 utilisateurs — 3 admins, 2 clients), filter tabs (Tous, Admins, Clients), search bar, user cards with avatar, name, email, auth method (Google SSO), role badge (Administrateur/Client), date, and action menu. The "+ Nouvel utilisateur" button is present. Layout and styling match the design system.

---

## OBFUSCATION (12-obfuscation)

### Obfuscation — Preview Shows [object Object] — HIGH
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The "Résultat" section of the live preview panel shows `[object Object]` instead of the actual obfuscated HTML output. This happens because `previewOutput = res.data` assigns an object (the API response `{data: string}`) to a string variable — it should be `res.data` where `res` is already `{data: string}`, meaning the actual string is at `res.data` but the API helper may be wrapping it again.
**Expected**: Should display the actual obfuscated HTML text, e.g., the input HTML with obfuscation rules applied (company names replaced, emails masked, etc.).
**Fix**: In `+page.svelte` line ~232, check the shape of the API response. The `post<{ data: string }>()` call returns `{ data: string }`, so `res.data` should be the string. However, the API response might be `{ data: { data: "..." } }`. Debug by logging `res` and adjust to `previewOutput = typeof res.data === 'object' ? JSON.stringify(res.data) : res.data` or unwrap correctly.

### Obfuscation — Table Missing "PORTÉE" Column — MEDIUM
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The mockup shows columns: RECHERCHER, REMPLACER PAR, PORTÉE, OCCURRENCES, STATUT. The current app shows: TYPE, RECHERCHER, REMPLACER PAR, OCCURRENCES, STATUT, ACTIONS. The mockup doesn't have TYPE or ACTIONS as separate columns, and the "PORTÉE" (scope: Global) column is missing. Per feedback R001, scope should always be "Global" (the per-page scope dropdown was removed).
**Expected**: Remove TYPE column, remove PORTÉE column (since scope is always Global per feedback), keep RECHERCHER, REMPLACER PAR, OCCURRENCES, STATUT, ACTIONS.
**Fix**: Actually, the current implementation is acceptable since TYPE (Texte/Regex) is useful info, and ACTIONS (edit/delete) are needed. The difference from mockup is minor. The key issue is the [object Object] preview bug.

### Obfuscation — Masquage dans l'éditeur Section Good — OK
**Issue**: The "Masquage dans l'éditeur" card with link to page editor and feature bullets is a nice addition not in the original mockup but adds value.

---

## UPDATE REQUESTS (13-update-requests)

## Update Requests — OK
**Issue**: The update requests page is well-implemented. Shows: stat cards (En attente 1, En cours 1, Terminées 1), filter tabs (Toutes, En attente, En cours, Terminées), search bar, and request cards with status badges, timestamps, descriptions, page/user info, and action buttons (Prendre en charge, Marquer terminée). The "Résolue le..." resolved date is shown. Matches design system expectations.

---

## COMMAND PALETTE (14-command-palette)

### Command Palette — Shows Actions, Not Search Results — HIGH
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The current command palette shows category tabs (Tous, Pages, Projets, Utilisateurs, Actions) and lists "ACTIONS 7 résultats" with items like "Créer un projet", "Nouvelle capture", "Aller au Dashboard", "Voir les Analytics", "Gérer les utilisateurs". The mockup (R002/R003) was renamed to "recherche admin" and shows search results with: category sections (UTILISATEURS with user cards showing role/team/status, then ACTIONS RAPIDES with keyboard shortcuts). The latest feedback (R003) says shortcuts are NOT necessary, and it should be renamed "recherche admin".
**Expected**: The command palette should function as an admin search tool: searching returns matched PAGES (with project tag, path, modification date), PROJETS, UTILISATEURS (with role/team info), and quick ACTIONS. No keyboard shortcuts displayed on action items.
**Fix**: Rename the modal title concept to "Recherche admin". Remove keyboard shortcut indicators (⌘I, ⌘P, etc.) from action items if they exist. The current implementation is close — the category tabs and result listing are correct. Main difference is the mockup shows actual search results (users with metadata, pages with project context) rather than just quick actions.

### Command Palette — Missing Keyboard Shortcut Indicators on Footer — LOW
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The bottom footer shows navigation hints (naviguer, ouvrir, tab catégorie, esc fermer). The mockup (R002) shows similar but also includes "EnvSim" branding. This is minor.
**Expected**: Footer hints are fine as-is.
**Fix**: Optional: add "EnvSim" branding in footer corner.

---

## PAGES WITHOUT MOCKUP REFERENCES

### Settings Page — Not Tested
**Issue**: No screenshot exists for `/admin/settings`. This page may not be implemented yet.
**Expected**: A settings page should exist per the sidebar nav.
**Fix**: Implement or verify the settings page exists.

### Editor Page — Not Tested
**Issue**: No screenshot for the page editor (`/admin/editor/[id]` or `/admin/live-edit/[id]`).
**Expected**: Per mockup `maquette-page-editor-25fev26`, a code/visual editor page should exist.
**Fix**: Verify editor implementation separately.

### Demo Viewer — Not Tested
**Issue**: No screenshots for `/demo/` or `/view/` routes.
**Expected**: Demo viewer pages should work per `maquette-demo-viewer` and `maquette-commercial-viewer` mockups.
**Fix**: Test demo viewer routes separately.

---

## CROSS-CUTTING ISSUES

### Sidebar — Does Not Match Mockup Collapsed State — HIGH
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The mockup shows the sidebar in collapsed (48px icon-only) state used throughout most mockup pages (analytics, tree, obfuscation, invitations all show collapsed sidebar with just icons). The current app always shows the full expanded 220px sidebar in all screenshots. The collapse toggle doesn't appear to work.
**Expected**: Sidebar should collapse to 48px icon-only mode. Most mockup pages show the collapsed state as default.
**Fix**: Debug the sidebar collapse mechanism. Ensure the `collapsed` state properly triggers CSS width transition and hides text labels. Consider making collapsed the default state, or ensure the toggle button works.

### Header — Missing Breadcrumb "Accueil" Navigation — LOW
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: The mockup breadcrumbs show "Accueil > Vue d'ensemble" format. The current app shows "Dashboard" or "PageName > Accueil". The breadcrumb pattern is slightly different but functional.
**Expected**: Consistent breadcrumb format matching mockup: "Page > Accueil > Sub-view".
**Fix**: Minor breadcrumb text adjustment. Low priority.

---

## SUMMARY

TOTAL_ISSUES: 26
CRITICAL: 2
HIGH: 8
MEDIUM: 11
LOW: 5
