# Iteration 5 — UI/UX Quality Audit

**Date**: 2026-02-26
**Auditor**: Claude Opus 4.6 (automated visual comparison)
**Method**: Screenshot comparison against mockup-forge reference mockups + design system spec + source code audit
**Previous**: Iteration 4 had 26 issues (1 CRITICAL, 8 HIGH, 10 MEDIUM, 7 LOW). All 26 were addressed in iteration 4 fixes.

---

## Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0     | Blocks usage or fundamentally broken |
| HIGH     | 3     | Clearly wrong, visible to all users |
| MEDIUM   | 6     | Noticeable differences from mockups |
| LOW      | 5     | Polish / minor refinements |

---

## LOGIN PAGE

### [LOGIN_CLIENT] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The small-viewport screenshots (01-login.png, 02-login-filled.png, 03-login-error.png) show the login form at a small size as if captured from a narrow window, whereas the large-viewport screenshots (02-login-client.png, 03-login-admin.png) show a more realistic full-screen rendering matching the mockup. The small-viewport screenshots may indicate the Playwright test captures at a smaller viewport than expected. Not an app bug, but the test viewport should match the reference.
**Expected**: Consistent viewport size across all test screenshots (1280x720 or similar).
**Fix**: Update the Playwright test configuration to use a consistent viewport size for all screenshots.

### [LOGIN_CLIENT] — OK (verified)
- Tab switcher uses pill/segmented style matching mockup ✓
- Field label is "Email" (not "Adresse e-mail") ✓
- Single background shape in top-right ✓
- Error message displays in French ("Identifiants invalides") ✓
- Button text "Se connecter" ✓

### [LOGIN_ADMIN] — OK (verified)
- "Continuer avec Google" button text matches mockup ✓
- "(admin uniquement)" hint text present below Google button ✓
- Description text present ✓
- Clean layout with single background shape ✓

---

## DASHBOARD

### [DASHBOARD] — HIGH
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The mockup (R009, resolved) requested adding "pages consultées" and "temps passé" columns to the activity log table. The current implementation (04-dashboard.png) shows these columns: CLIENT, OUTIL, DÉMO, ACTION, PAGES CONSULTÉES, TEMPS PASSÉ, DATE — which matches the request. However, comparing with the mockup layout, the dashboard mockup shows a horizontal bar chart mini-visualization below the stat cards (blue bars representing project activity per day/period), which is not present in the current implementation. The mockup (R001.png, R007.png) clearly shows a compact bar chart row between the stat cards and the activity log section.
**Expected**: A compact horizontal bar chart visualization (showing daily activity or project activity) between the stat cards row and the "Journal d'activité des clients" section, per mockup v5.
**Fix**: Add a compact bar chart section between the stats grid and the activity journal card. This could be a simple inline bar chart showing daily capture/session activity over the past 2 weeks, similar to GitHub contribution graphs. Height should be ~40-60px to keep it subtle per mockup feedback R005 ("rendre moins volumineux").

### [DASHBOARD] — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The mockup sidebar shows a "Composants" nav item in the GESTION section (between "Obfuscation" and "Paramètres"). The current sidebar does not have this item. While this may be a planned but not yet implemented feature, the mockup consistently shows it.
**Expected**: Either add "Composants" nav item to match the mockup, or document that it was intentionally deferred.
**Fix**: If this is a planned feature, add the nav item to the sidebar in `Sidebar.svelte` with the appropriate icon (Component/Puzzle icon). Link to a placeholder page if needed.

### [DASHBOARD] — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The mockup (R007.png) shows a "Projets" section below the activity log with filter tabs "Tous 7 | Actifs 4 | Test 2 | Archivés 1" and project cards. However, the mockup feedback R007 (gesture: "frame", text: "supprimer") marks this section for deletion. The mockup feedback R008 also says "Supprimer cet element" for a similar area. Since these are marked "resolved: true", the deletion was intentional. The current dashboard correctly omits this section.
**Expected**: No projects section on dashboard — this was intentionally removed per feedback. Current implementation is correct.
**Fix**: N/A — correctly implemented.

### [DASHBOARD] — LOW
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The mockup shows the "Invitations" nav item with a badge count of "2", while the current implementation shows no badge on Invitations. The current badges show: Projets (7), Analytics (4), Demandes MAJ (1). The mockup shows: Projets (7), Analytics (24), Invitations (2), Demandes MAJ (5).
**Expected**: Badge counts should reflect real data. The Invitations nav item should show a badge with the active invitation count if > 0.
**Fix**: Add a badge count to the "Invitations" sidebar item showing the number of active invitations fetched from the API.

---

## PROJECTS LIST

### [PROJECTS] — OK (verified)
- Project cards display with colored initials avatars ✓
- Filter tabs "Tous | Actifs | Test | Archives" present ✓
- Search bar "Rechercher un projet..." present ✓
- "+ Nouveau projet" button in header ✓
- Card layout with tool name, description, version/page counts, date ✓
- Status badges ("Actif") on cards ✓

---

## PROJECT DETAIL

### [PROJECT_DETAIL] — MEDIUM
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: The current project detail page (07-project-detail.png) shows only a versions table. The mockup (maquette-project-detail v2) includes additional sections that would typically be organized as tabs: Versions, Assignations (demo assignments), and Configuration (project settings like subdomain, tool). The current implementation only shows the Versions section.
**Expected**: Tab navigation for "Versions | Assignations | Configuration" sections, or at minimum the version table should be followed by assignation and configuration sections.
**Fix**: Add tab navigation to the project detail page with at minimum the "Versions" tab (current), an "Assignations" tab (showing demo assignments from the `/api/versions/:id/assignments` endpoint), and a "Configuration" tab (showing project settings). This matches the mockup's richer project detail structure.

### [PROJECT_DETAIL] — LOW
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: The version table action buttons show external link and three-dots menu icons. The mockup shows similar actions but also includes a "Dupliquer" (duplicate/fork) action in the menu. Verify that the three-dots menu includes: Dupliquer, Modifier, Supprimer options.
**Expected**: Three-dots menu should offer: Dupliquer la version, Modifier, Supprimer.
**Fix**: Verify the dropdown menu includes all actions. If "Dupliquer" is missing, add it using the `POST /api/versions/:id/duplicate` endpoint.

---

## TREE VIEW

### [TREE_VIEW] — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The mockup (maquette-tree-view R001.png showing v6) shows a rich tree with: (1) collapsible sections with colored category icons and page counts in parentheses (e.g., "Contacts (14)", "Opportunités (18)"), (2) different icon colors per section (blue for Dashboard, teal/green for Contacts, orange for Opportunités, etc.), (3) "Modale" tag badges on modal pages in dashed border style, (4) page status dots (green = OK, orange = warning, red = error), (5) a bottom bar with version selector and breadcrumb path ("Accueil / Contacts / Fiche client"). The current implementation (08-tree.png) shows a simpler flat tree with: green dots on all pages (same color), file icons (same style), no category icons, basic "Modale" labels. The tree is functional but visually much simpler than the mockup.
**Expected**:
1. Colored category icons per section (different colors for Dashboard, Contacts, Opportunités, etc.)
2. Expandable sections with child count in parentheses
3. Status dots should vary by page health (green/orange/red), not all green
4. Breadcrumb path at bottom should show full path including the version selector
**Fix**:
1. Assign different colors to tree section icons based on section type or index
2. Ensure child counts show in parentheses next to section names (e.g., "Contacts (14)")
3. Map page health status to appropriate dot colors (green=ok, orange=warning, red=error)
4. The bottom version selector bar and breadcrumb path appear present but verify they show the correct full path

### [TREE_VIEW] — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The right-side detail panel in the mockup (R001.png) shows a rich page detail view when a page is selected, including: breadcrumb path ("Salesforce > Home > Dashboard principal"), action buttons ("Édition en direct", "Obfuscation", "Ouvrir démo" green button), and metadata cards ("Informations" with URL source/Taille/Capture date/Mode/Liens sortants/Santé, "Obfuscation active" with active rules, "Guides associés"). The current implementation (08-tree.png) shows only an empty state ("Sélectionnez une page"). Need to verify the detail panel actually renders correctly when a page is selected — the screenshot just shows no page selected.
**Expected**: When a page is selected, the detail panel should show the full metadata layout matching the mockup.
**Fix**: Verify by selecting a page in the tree. If the detail panel is not implemented or is incomplete, add the metadata cards: Informations (URL, size, capture date, mode, outgoing links count, health status), Obfuscation active (list of active rules), Guides associés (linked guides). The source code audit confirms these sections exist in the code, so this may just be a screenshot timing issue.

---

## ANALYTICS

### [ANALYTICS] — MEDIUM
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The current implementation (09-analytics.png) shows 4 stat cards: "Sessions totales (4)", "Pages vues (20)", "Utilisateurs uniques 7j (3)", "Durée moyenne (0s)". The mockup (R001.png) shows only 2 stat cards area with a single "Sessions totales" card visible and a subtle line/area chart below. The mockup is in collapsed sidebar mode, making the layout wider. The key difference: the mockup does NOT show 4 separate stat cards — it shows a more compact header area with the session count and a graph. The current 4-card layout is more information-dense than the mockup.
**Expected**: The mockup feedback R002 says "Supprimer cet element. On ne mesure pas le nombre de guides joués" — which was addressed. The remaining mockup layout shows fewer stat cards (Sessions totales primarily) with the chart area being more prominent. However, the current 4-card layout provides useful information and is a reasonable enhancement.
**Fix**: This is a design judgement call. The current 4-card layout is arguably better than the mockup's simpler approach. Keep as-is but ensure the cards are not overly wide on large screens.

### [ANALYTICS] — MEDIUM
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The mockup (R005, UNRESOLVED) notes: "dans certains cas on a pas la personne mais on a le nom de la société (partage de liens)". This means the client sessions list should handle anonymous sessions where only the company name is known (from link sharing). Currently, the "Clients" section shows "Visiteur anonyme — Lien partagé" which partially addresses this. But the feedback implies the company name should be shown when available, not just "Visiteur anonyme".
**Expected**: When a session comes from a shared link and the company name is known but not the person's name, display the company name (e.g., "Acme Corp — Lien partagé") instead of "Visiteur anonyme".
**Fix**: In the analytics client session list, check if the session has a `company` field or similar metadata from the shared link. If a company name is available, display it instead of or alongside "Visiteur anonyme". This may require backend changes to store company info from link-shared sessions.

### [ANALYTICS] — LOW
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The CSV export button is present on the "Admins & Commerciaux" card but the mockup (R001.png) shows "Exporter CSV" positioned next to the "Sessions récentes" search bar. In the current split-view, the CSV button is only on the admin column. Consider adding export functionality for both columns or moving it to a more global position.
**Expected**: CSV export should ideally be available for both admin and client session lists.
**Fix**: Add a CSV export button to the "Clients" session card as well, or add a single export button that exports all sessions.

---

## INVITATIONS

### [INVITATIONS] — OK (verified)
- Stat cards: "Invitations envoyées" and "Clients actifs" ✓
- Table with CLIENT, EMAIL, DÉMO ASSIGNÉE, EXPIRATION, STATUT, ACTIONS ✓
- "+ Nouvelle invitation" button ✓
- "Exiger la création d'un compte" checkbox in creation dialog ✓ (per source code audit)
- Status badges (Actif) ✓
- Copy link and delete action buttons ✓

---

## USERS

### [USERS] — OK (verified)
- No specific mockup exists for this page
- Current implementation follows design system conventions ✓
- User cards with avatar, name, email, auth method, role badge, date ✓
- Tabs: "Tous (5) | Admins (3) | Clients (2)" ✓
- Search bar ✓
- "+ Nouvel utilisateur" button ✓
- "Vous" badge on current user ✓

---

## OBFUSCATION

### [OBFUSCATION] — MEDIUM
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The mockup (maquette-obfuscation R001.png) shows the obfuscation page in collapsed sidebar mode with a compact layout. The tab selector shows "Règles auto 7" as a filled blue pill and "Manuel 3" as inactive. The current implementation (12-obfuscation.png) shows tabs as underline-style with count badges. The mockup's tab style is more visually prominent (filled pill for active tab).
**Expected**: Active obfuscation tab should use a filled blue pill style with white text and count badge, matching the mockup.
**Fix**: Override the tab trigger styling for this page to use filled pill style: active tab gets `background: #3B82F6; color: white; border-radius: 20px; padding: 6px 16px` with the count badge in a lighter shade. The inactive tab stays with default/secondary styling.

### [OBFUSCATION] — LOW
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The mockup shows "RECHERCHER" and "REMPLACER PAR" as table headers, while the current implementation shows them correctly. The mockup also shows a "PORTÉE" column which was removed per R001 feedback. However, the mockup shows a "PORTÉE" dropdown in the inline add form. Current implementation correctly removed PORTÉE from both the table and add form. The remaining difference: the mockup's inline add row at the bottom shows "Texte exact" type selector, "Texte à masquer..." placeholder, "Auto-généré si vide" placeholder for replacement, and a "Global" scope dropdown (to be removed), plus "Ajouter" and "Annuler" buttons. The current add form matches this structure minus the scope selector.
**Expected**: Current implementation correctly matches the mockup with PORTÉE removed.
**Fix**: N/A — correctly implemented per feedback.

---

## UPDATE REQUESTS (DEMANDES MAJ)

### [UPDATE_REQUESTS] — OK (verified)
- No specific mockup exists for this page
- Stat cards: "En attente (1)", "En cours (1)", "Terminées (1)" ✓
- Filter tabs with counts ✓
- Request cards with status badges, descriptions, metadata ✓
- Action buttons: "Prendre en charge", "Marquer terminée" ✓
- Resolution timestamps on completed requests ✓

---

## COMMAND PALETTE

### [COMMAND_PALETTE] — LOW
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The mockup (maquette-command-palette R003.png) shows a command palette with search results that include page entries with project context badges (e.g., "SALESFORCE" badge next to page names) and modification timestamps ("Modifiée il y a 2h"). The current implementation (14-command-palette.png) shows actions with simpler icons and labels. The mockup also shows a bottom bar with navigation hints that was crossed out (R001, R002 feedback) — the current implementation correctly replaced this with "Résultats de recherche" label.
**Expected**: Search results for pages/captures should show tool/project badges with modification time context. The tab categories "Tous | Projets | Démos | Utilisateurs | Captures" match the mockup ✓.
**Fix**: Enhance page/capture search results to include: (1) tool name badge (e.g., "SALESFORCE" in tool color), (2) modification time ("Modifiée il y a 2h"), (3) project context subtitle. This is a polish improvement.

### [COMMAND_PALETTE] — LOW
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The mockup's "Tous" tab shows the badge count as "12" in a filled blue pill, while the current shows "7". The counts naturally differ based on seed data, which is fine. But the mockup's "Pages 4" tab and "Actions 3" count style uses smaller gray text, while the current uses filled badge variants. Minor styling difference.
**Expected**: Tab count badges should be subtle gray text (not filled badges) for inactive tabs, and filled blue for the active "Tous" tab.
**Fix**: Minor CSS adjustment to tab count badge styling — ensure active tab uses filled primary badge and inactive tabs use plain text counts.

---

## SIDEBAR (across all pages)

### [SIDEBAR] — OK (verified)
- "ES" blue logo + "Env. Simulés" / "Lemon Learning" branding ✓
- PRINCIPAL section: Dashboard, Projets, Arborescence, Analytics, Invitations ✓
- GESTION section: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres ✓
- OUTILS SIMULÉS section with colored dots and page counts ✓
- Active item: blue text + blue left border ✓
- Badge counts on nav items ✓
- Collapsed mode works correctly (05-dashboard-collapsed.png) ✓
- User section at bottom with avatar, name, role, logout button ✓

---

## HEADER (across all pages)

### [HEADER] — OK (verified)
- Breadcrumb navigation with "Accueil" root ✓
- Search bar with "Rechercher pages, projets, utilisateurs..." placeholder ✓
- Keyboard shortcut hint "⌘K" ✓
- Bell and help icons ✓
- "Extension" button ✓
- "+ Nouveau projet" button on projects page ✓

---

## CROSS-PAGE ISSUES

### [GLOBAL] — OK (verified from iteration 4 fixes)
- All backend error messages in French ✓
- Breadcrumb root label is "Accueil" ✓
- All UI text in French ✓

---

## UNRESOLVED MOCKUP FEEDBACK (from mockup-forge)

These are unresolved feedback items from the mockup-forge retours that should be tracked:

1. **Login R006** (UNRESOLVED): "Supprimer cet element" at bottom of login card. This appears to reference an element that has already been removed in the current implementation — the login card is clean with no extra footer element. **Status: Appears resolved in implementation.**

2. **Login R007** (UNRESOLVED): "préciser (admin uniquement) en grisé". The "(admin uniquement)" text IS present in the current implementation at line 209 of login/+page.svelte. **Status: Resolved in implementation.**

3. **Analytics R005** (UNRESOLVED): "dans certains cas on a pas la personne mais on a le nom de la société (partage de liens)". Partially addressed — anonymous visitors show as "Visiteur anonyme / Lien partagé" but company name is not displayed when available. **Status: Tracked as MEDIUM issue above.**

4. **Invitations R005** (UNRESOLVED): "exiger la création d'un compte". This IS implemented — checkbox in invitation creation dialog. **Status: Resolved in implementation.**

---

## Summary

Most iteration 4 issues were successfully resolved. The remaining issues are primarily:
- **Dashboard**: Missing compact bar chart visualization between stats and activity log
- **Tree View**: Visual richness gap — simpler styling than mockup (uniform dot colors, no category-colored icons)
- **Tree View**: Detail panel needs verification with page selected
- **Analytics**: Company name display for anonymous link-shared sessions
- **Obfuscation**: Tab styling doesn't match filled-pill mockup style
- **Minor**: Badge count on Invitations, CSV export for both session lists, command palette result enrichment

TOTAL_ISSUES: 14
CRITICAL: 0
HIGH: 3
MEDIUM: 6
LOW: 5
