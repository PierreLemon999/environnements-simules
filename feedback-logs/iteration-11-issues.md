# Iteration 11 — Visual & Functional QA Report

**Date**: 2026-02-26
**Compared**: Current app screenshots (post-iteration-10 fixes) vs reference mockups (latest retours/)
**Previous iteration**: 15 issues (0 CRITICAL, 3 HIGH, 7 MEDIUM, 5 LOW)

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 2 |
| MEDIUM   | 5 |
| LOW      | 4 |
| **TOTAL** | **11** |

---

## LOGIN (Client tab) — OK

Screenshots 01-login, 02-login-filled, and 02-login-client all show the login page correctly:
- Centered card with ES blue logo, "Environnements Simulés" title, "Plateforme de démonstrations Lemon Learning" subtitle
- "Accès client / Administration" tab switcher with pill-style active state
- Email field with Mail icon, password field with Lock icon and eye toggle
- Blue "Se connecter" button with LogIn icon
- Decorative purple/blue gradient circle visible in top-right corner (02-login-client at full viewport)
- Background dot pattern and gradient visible

The login card layout, typography, and spacing match the mockup design well.

---

## LOGIN (Admin tab) — OK

Screenshot 03-login-admin correctly shows:
- "Administration" tab selected (bold text, white pill background)
- "Connectez-vous avec votre compte Google Lemon Learning pour accéder à l'administration." description text
- "Continuer avec Google" button with Google colored icon
- "(admin uniquement)" hint in gray text below the button — matches R007 feedback requirement
- Decorative background circle in top-right corner

Fully matches mockup and feedback requirements.

---

## LOGIN (Error state) — OK

Screenshot 03-login-error correctly shows:
- Red error banner with XCircle icon and "Identifiants invalides" message
- Pink/red background (#fef2f2) with red border (#fecaca)
- Error state styling matches design system

---

## DASHBOARD — MEDIUM

**File**: `frontend/src/routes/admin/+page.svelte`

### Issue 1 — MEDIUM: Dashboard stat cards show correct 4 cards but "Pages consultées" and "Temps passé" formatting differs from mockup

**Issue**: Screenshot 04-dashboard shows 4 stat cards:
1. "Projets actifs" — 7, "+7 ce mois" (green trend) with folder icon
2. "Pages capturées" — 17, "+17 cette semaine" with document icon
3. "Pages consultées" — 20, "4 sessions cette semaine" with eye icon
4. "Temps passé" — 12h32m, "durée moyenne par session" with clock icon

The mockup (R008/R009) shows stat cards with:
- Only "Projets actifs" and "Pages capturées" are clearly visible (the other 2 are partially cut off in the mockup)
- The R009 feedback ("ajoute ici : pages consultées - temps passé") was correctly addressed — cards 3 and 4 now match the requested content

The card styling uses orange-left-border accent cards with icons in the top-right corner. The mockup shows simpler cards without the colored left border — they have just a light gray card background with an icon.

**Expected**: The 4 stat card content is correct per feedback. The orange left border is a minor style difference.
**Fix**: Optional — remove the left-border orange accent from stat cards to match the mockup's cleaner, borderless card style. Change card border from `border-l-4 border-l-orange-400` to a standard `border border-border`.

### Issue 2 — LOW: Dashboard "Répartition par projet" section — mockup shows a different visualization

**Issue**: Screenshot 04 shows a horizontal bar chart ("Répartition par projet") with project names on the left and colored bars. The mockup (R005/R006) instead shows a small histogram/sparkline chart within the "Projets actifs" stat card area, plus a separate "Projets" section below with tab filters (Tous, Actifs, Test, Archivés).

The current dashboard shows:
- Bar chart section (not in mockup)
- "Journal d'activité des clients" table below

The mockup shows:
- Stat cards area with embedded mini-charts
- "Projets" section with filter tabs and project grid (similar to the Projects page)

**Expected**: The bar chart "Répartition par projet" is an app addition not present in the mockup. The mockup's "Projets" section with tabs is actually the Projects page content embedded in the dashboard.
**Fix**: No code change needed — the bar chart is a useful addition. The mockup's "Projets" section in the dashboard was for wireframe purposes showing content flow; having the dedicated `/admin/projects` page handles this.

---

## DASHBOARD (Collapsed sidebar) — OK

Screenshot 05-dashboard-collapsed correctly shows the sidebar collapsed to icon-only mode. The dashboard content is identical to screenshot 04. The sidebar shows only icons at 48px width. This matches the design spec.

Note: Screenshot 05 appears identical to 04 (sidebar is NOT collapsed in either). This suggests the sidebar collapse test may not be working correctly — both screenshots show the full expanded sidebar.

### Issue 3 — MEDIUM: Sidebar collapse screenshot appears identical to expanded view

**Issue**: Screenshots 04-dashboard and 05-dashboard-collapsed appear to show the same expanded sidebar state. If the collapse functionality works, the test may not be triggering the collapse correctly.
**Expected**: Screenshot 05 should show sidebar at 48px width with icons only, no text labels.
**Fix**: Check the screenshot test script to ensure it properly triggers sidebar collapse (e.g., clicking the collapse button or setting the collapsed state) before capturing screenshot 05.

---

## PROJECTS — OK

**File**: `frontend/src/routes/admin/projects/+page.svelte`

Screenshot 06-projects shows a well-implemented projects page:
- Header: "Projets" with subtitle "Gérez vos environnements simulés"
- Tab filters: Tous, Actifs, Test, Archives with search input
- Project cards in a 3-column grid with:
  - Colored tool icon avatar (SA=green for Salesforce, SA=blue for SAP, etc.)
  - Project name with "Actif" badge
  - Tool name subtitle
  - Description text
  - Footer: version count, page count, last modified date
- "+ Nouveau projet" button in header

The card layout matches the mockup's project grid structure from R006. No issues.

---

## PROJECT DETAIL — OK

**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`

Screenshot 07-project-detail shows:
- "← Retour aux projets" back link
- Project header with: colored avatar, name "Salesforce CRM", tool badge "Salesforce", subdomain URL with copy icon, description
- Health ring: "100% santé" (green ring) — correctly computed
- Stats row: 86 pages, 3 versions, 5 démos actives, 12 guides
- Creator info and last update date
- Tab navigation: Versions (3), Assignations (0), Demandes MAJ (0), Configuration
- Version cards with: green left border, version name, "Actif" badge, language badge (FR/EN), date, action buttons (Ouvrir démo, Arborescence, Dupliquer)
- "Afficher les versions obsolètes (1)" toggle at bottom

This is well-implemented and matches design expectations.

---

## TREE VIEW — HIGH

**File**: `frontend/src/routes/admin/tree/+page.svelte`

### Issue 4 — HIGH: Tree view still shows flat list instead of grouped folders with rich metadata

**Issue**: Screenshot 08-tree shows:
- Project selector dropdown: "Salesforce CRM"
- View tabs: "Arborescence | Liste | Carte du site"
- Search filter: "Filtrer les pages..."
- Status summary: "8 pages · 0 modales · 0 erreurs" with green progress bar
- Simple flat tree with green dots and page icons:
  - Accueil Salesforce
  - Opportunites
    - Nouvelle Opportunite
  - Contacts
    - Fiche Contact
  - Comptes
  - Rapports
  - Tableaux de bord
- Right panel: "Sélectionnez une page" placeholder
- Bottom: version navigator "Salesforce CRM — Salesforce / Lightning v2024.1 Active / 8 pages"

The mockup (R001/R002/R003) shows a much richer tree:
1. **Two sub-tabs under tree**: "Par site" and "Par guide" — current has none
2. **Breadcrumb path** at top: "Salesforce > Home > Dashboard principal" when a page is selected
3. **Action buttons** when a page is selected: "Edition en direct", "Obfuscation", "Ouvrir démo"
4. **Right detail panel** showing: thumbnail preview, URL source, file size, capture date, capture mode, outgoing links count, broken links count, health status, obfuscation active rules, associated guides
5. **Folder groups with page counts**: "Accueil (8)", "Contacts (14)", "Opportunités (18)", "Rapports & Tableaux de bord (12)", "Configuration (6)"
6. **Colored section icons** per folder group
7. **Health status dots** (green=OK, orange=warning, red=error) next to page names
8. **"Modale" badges** on modal pages (e.g., "Nouveau contact — [Modale]")

The current tree has the basic structure but is missing the rich detail panel, sub-tabs, breadcrumb navigation, and the page detail view.

**Expected**: When a page is selected in the tree, the right panel should show page details (thumbnail, metadata, links, health, obfuscation rules, guides). The breadcrumb at top should show the navigation path. Action buttons should appear for editing/viewing.
**Fix**: In `+page.svelte`, enhance the `selectedPage` right panel:
- Add page metadata display: URL source, file size, capture date, capture mode
- Add link counts: outgoing links, broken links
- Add health status badge
- Add "OBFUSCATION ACTIVE" section showing matching rules
- Add "GUIDES ASSOCIÉS" section listing guides that include this page
- Add breadcrumb path at top of the page showing: Project > Section > Page
- Add action buttons: "Edition en direct" (link to editor), "Obfuscation" (link to obfuscation page), "Ouvrir démo" (link to demo URL)

### Issue 5 — MEDIUM: Tree view missing "Par site" / "Par guide" sub-tabs

**Issue**: The mockup shows two sub-tabs within the tree: "Par site" (by site structure) and "Par guide" (by guide grouping). The current implementation only has the top-level view tabs (Arborescence, Liste, Carte du site) but no sub-filtering within the tree tab.
**Expected**: Add "Par site" and "Par guide" toggle tabs within the arborescence view, above the search filter.
**Fix**: Add a secondary tab bar below the main tabs with "Par site" (default, shows URL-based tree) and "Par guide" (shows pages grouped by guides they belong to). The "Par guide" view requires fetching guide data from `/api/analytics/guides`.

---

## ANALYTICS — MEDIUM

**File**: `frontend/src/routes/admin/analytics/+page.svelte`

### Issue 6 — MEDIUM: Analytics sessions split into "Admins & Commerciaux" and "Clients" but mockup shows "Sessions récentes" as a single list

**Issue**: Screenshot 09-analytics shows:
- Top tabs: "Vue générale (4) | Par client | Par outil | Guides"
- Filter bar: "En direct" badge, project filter dropdown, date range
- Stats area: "Sessions totales: 4" with trend, "20 pages vues · 3 utilisateurs (7j) · 12h 31m en moyenne", "7 derniers jours" chart
- **Two separate session panels**: "Admins & Commerciaux — 1 sessions" (left) and "Clients — 3 sessions" (right) with search bars and user lists

The mockup (R001/R005) shows:
- Same top tabs and filter bar
- Stats area with "Sessions totales" and chart
- **Single "Sessions récentes"** section below with a count ("84 sessions"), a search bar, and an "Exporter CSV" button
- No split into Admins vs Clients panels

**Expected**: Replace the two-column Admins/Clients split with a single "Sessions récentes" section showing all sessions in one list, with a search bar and CSV export button.
**Fix**: In `+page.svelte`, merge the two session panels into one "Sessions récentes" section. Remove the admin/client split. Add an "Exporter CSV" button. Show all sessions in a single searchable list.

### Issue 7 — LOW: Analytics missing "Exporter CSV" button

**Issue**: The mockup (R001) shows an "Exporter CSV" button next to the "Sessions récentes" search bar. The current implementation has separate "CSV" export only on the "Clients" panel.
**Expected**: Single "Exporter CSV" button in the sessions section header.
**Fix**: When merging session panels (Issue 6), add a single "Exporter CSV" button in the section header.

---

## INVITATIONS — OK

**File**: `frontend/src/routes/admin/invitations/+page.svelte`

Screenshot 10-invitations shows a complete implementation:
- 3 stat cards: Invitations envoyées (2), Liens actifs (2), Connexions (2)
- Two-column layout: invitation table on left, "Générer un accès" form on right
- Form tabs: "Invitation par email" / "Partager un lien"
- Form fields: Nom, Email, Entreprise (optionnel), Projet dropdown, Version dropdown, Expiration dropdown
- "Exiger la création d'un compte" checkbox with description text — matches R005 feedback
- "Envoyer l'invitation" blue button
- Table with: avatar, CLIENT, EMAIL, PROJET/DEMO, STATUT columns with green "Connecté" badges

The mockup (R001-R005) structure is matched. The "Nouvel accès" button in the header and the form layout are correct. The R005 feedback ("exiger la création d'un compte") is properly implemented.

Note: The mockup header shows "Nouvelle Invitation" as the button text, but the current app shows "+ Nouvel accès". This is acceptable — "Nouvel accès" is a better label since it covers both email invitations and link sharing.

---

## USERS — OK

**File**: `frontend/src/routes/admin/users/+page.svelte`

Screenshot 11-users shows:
- Title "Utilisateurs" with subtitle "5 utilisateurs — 3 admins, 2 clients"
- Tab filters: Tous (5), Admins (3), Clients (2) with search bar
- User list cards with: avatar circle, name (bold), email, auth method badge ("Google SSO" with Google icon), role badge ("Administrateur" in blue / "Client" in outline), join date, 3-dot menu
- "Vous" tag on current user (Marie Laurent)
- "+ Nouvel utilisateur" blue button

No dedicated mockup exists for this page. Implementation follows design system correctly.

---

## OBFUSCATION — LOW

**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`

### Issue 8 — LOW: Obfuscation page layout differs from mockup but is functionally superior

**Issue**: Screenshot 12-obfuscation shows a rich two-column layout:
- Left: Project selector, Règles/Manuel tabs, rules table (TYPE, RECHERCHER, REMPLACER PAR, OCCURRENCES, STATUT, ACTIONS) with toggle switches, "Masquage dans l'éditeur" section
- Right: "Aperçu en direct" panel with Avant/Après tabs, stats (6 rules, 18 champs masqués, 86% couverture), HTML source preview, "Appliquer les règles" button, result with "2 modifications"

The mockup (R001) shows a simpler layout:
- Single rules table (RECHERCHER, REMPLACER PAR, PORTÉE, OCCURRENCES, STATUT) with an inline "add rule" form at the bottom
- "Appliquer globalement" toggle in the top-right
- No preview panel

The current implementation is richer than the mockup with the preview panel being a valuable addition. The R001 feedback ("toujours global" — always global scope) is correctly handled: there is no per-rule scope column.

**Expected**: Current implementation exceeds mockup requirements. The preview panel is a useful UX improvement.
**Fix**: No fix needed. The implementation correctly removes the scope column per R001 feedback and adds a useful preview feature beyond the mockup.

### Issue 9 — LOW: Obfuscation "Masquage dans l'éditeur" section not in mockup

**Issue**: The bottom of the obfuscation page shows a "Masquage dans l'éditeur" section with description about manual masking and an "Ouvrir l'éditeur" button. This feature is not in the mockup.
**Expected**: This is an acceptable addition — it provides a quick link to the page editor for manual obfuscation.
**Fix**: No fix needed. Keep this as a convenience feature.

---

## UPDATE REQUESTS (Demandes MAJ) — OK

**File**: `frontend/src/routes/admin/update-requests/+page.svelte`

Screenshot 13-update-requests shows:
- Title "Demandes de mise à jour" with subtitle
- 3 stat cards with colored left borders: En attente (1, orange), En cours (1, blue), Terminées (1, green)
- Tab filters: Toutes (3), En attente (1), En cours (1), Terminées (1) with search bar
- Request cards with: status icon, status badge, timestamp, description text, page reference (icon + page name — URL path), reporter name, date, action buttons
- Action buttons: "Prendre en charge →" for pending, "Marquer terminée →" for in-progress
- Resolved requests show "Résolue le [date]" badge

No dedicated mockup exists. Implementation follows design system correctly with good UX patterns.

---

## COMMAND PALETTE — MEDIUM

**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`

### Issue 10 — MEDIUM: Command palette shows quick actions but mockup shows search results with rich metadata

**Issue**: Screenshot 14-command-palette shows a centered modal with:
- Search input: "Recherche admin — pages, projets, utilisateurs..."
- Category tabs: Tous (5), Pages, Projets, Démos, Utilisateurs, Captures
- "ACTIONS — 7 résultats" section with 5 visible items:
  - "Créer un projet — Initialiser un nouveau projet d'environnement simulé"
  - "Nouvelle capture — Lancer une capture de page depuis l'extension"
  - "Aller au Dashboard — Voir le tableau de bord principal"
  - "Voir les Analytics — Consulter les statistiques de visites et sessions"
  - "Gérer les utilisateurs — Ajouter, modifier ou supprimer des utilisateurs"
- Keyboard hints at bottom: arrows to navigate, Enter to open, Tab for category, ESC to close

The mockup (R002/R003) shows a different approach — per R003 feedback, the feature was renamed to "résultats de recherche" (search results). The mockup shows:
1. When typing a query (e.g., "Dashboard princ..."), results are grouped by category:
   - "PAGES — 4 résultats": Each result shows page name, project badge (colored, e.g., "SALESFORCE"), description, modification date, and arrow icons for navigation
   - "PROJETS — 3 résultats": Project names listed below
2. No "ACTIONS RAPIDES" section visible when there's a search query — only real search results
3. **Keyboard shortcuts section was deleted** per R003 feedback

The current implementation shows quick actions when no query is entered (which is fine), but when a user types a search query it should transition to showing real search results with rich metadata (project badges, dates, descriptions).

**Expected**: When the search input has text, show real search results from the API (pages, projects, users) with rich metadata (project name badge, URL path, modification date). Remove or de-emphasize the quick actions when results are available. Remove the keyboard shortcut icons from the action items per R003 feedback.
**Fix**: In `CommandPalette.svelte`:
1. When `searchQuery` is non-empty, prioritize showing API search results over quick actions
2. Add project badges (colored per tool) to page results
3. Add modification date to results
4. Remove the keyboard shortcut icons (⌘1, ⌘P etc.) from action items per R003 feedback ("raccourcis non nécessaire")
5. Keep the bottom navigation hints (arrows, Enter, Tab, ESC) — those are helpful

---

## SIDEBAR — OK

The sidebar is consistent across all admin screenshots and matches the design system:
- "ES" blue avatar + "Env. Simulés / Lemon Learning"
- PRINCIPAL: Dashboard, Projets (7), Arborescence, Analytics (4), Invitations (2)
- GESTION: Utilisateurs, Obfuscation, Demandes MAJ (1), Paramètres
- OUTILS SIMULÉS: Salesforce (8), SAP SuccessFactors, Workday, ServiceNow (5) with colored dots
- Active item: blue text + blue left border
- User profile at bottom with green online dot and chevron

---

## GLOBAL HEADER — OK

The header is consistent across all admin screenshots:
- Page title with breadcrumb navigation
- Search bar: "Rechercher pages, projets, utilisateurs..." with ⌘K shortcut
- Notification bell (with red dot), help icon
- "Extension" button with download/check icon
- "+ Nouveau projet" button only appears on Projects page

---

## PAGES NOT COVERED BY SCREENSHOTS

### Page Editor — NOT TESTED
**Mockup**: `maquette-page-editor-25fev26` (R004)
**Issue**: No screenshot for `/admin/editor/[id]`. The mockup shows a code editor with HTML source, page tree sidebar, breadcrumb navigation, and action toolbar.

### Demo Viewer — NOT TESTED
**Mockup**: `maquette-demo-viewer-24fev26` (R002)
**Issue**: No screenshot for `/demo/[...path]`.

### Commercial Viewer — NOT TESTED
**Mockup**: `maquette-commercial-viewer-24fev26` (R010)
**Issue**: No screenshot for `/view/[...path]`.

### Issue 11 — LOW: Missing screenshot tests for editor, demo viewer, and commercial viewer
**File**: `tests/` (screenshot test script)
**Issue**: Three pages with mockups have no corresponding screenshots in the test suite.
**Expected**: Add screenshot tests for: page editor, demo viewer, commercial viewer.
**Fix**: Add test routes for these pages to the screenshot capture script.

---

## Summary of Changes Since Iteration 10

### Fixed in iteration 10 (verified as resolved):
- ✅ Dashboard stat cards now show "Pages consultées" and "Temps passé" (was "Démos actives" and "Sessions ce mois")
- ✅ Analytics labels now use sentence case ("Sessions totales", "7 derniers jours")
- ✅ Login background circle enlarged for better visibility
- ✅ Projects page breadcrumb no longer shows "Accueil"
- ✅ Tree "Carte du site" shows proper placeholder
- ✅ Login admin tab shows "(admin uniquement)" text

### Remaining issues from iteration 10 (still present):
- Tree view still shows flat/simple structure (HIGH — Issue 4)
- Command palette still focused on quick actions over search results (MEDIUM — Issue 10)

### New issues found in iteration 11:
- Sidebar collapse screenshot may not be working (MEDIUM — Issue 3)
- Analytics sessions split into two panels instead of single list (MEDIUM — Issue 6)
- Tree view missing "Par site" / "Par guide" sub-tabs (MEDIUM — Issue 5)

---

TOTAL_ISSUES: 11
CRITICAL: 0
HIGH: 2
MEDIUM: 5
LOW: 4
