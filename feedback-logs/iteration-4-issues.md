# Iteration 4 — UI/UX Quality Audit

**Date**: 2026-02-26
**Auditor**: Claude Opus 4.6 (automated visual comparison)
**Method**: Screenshot comparison against mockup-forge reference mockups + design system spec

---

## Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 1     | Blocks usage or fundamentally broken |
| HIGH     | 8     | Clearly wrong, visible to all users |
| MEDIUM   | 10    | Noticeable differences from mockups |
| LOW      | 7     | Polish / minor refinements |

---

## LOGIN PAGE

### [LOGIN] — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Error message displayed in English ("Invalid credentials") instead of French. The backend returns English error strings and the frontend displays them raw.
**Expected**: French error message, e.g. "Identifiants invalides" or "Adresse e-mail ou mot de passe incorrect."
**Fix**: Either translate backend error messages in `backend/src/routes/auth.ts` (change `'Invalid credentials'` to `'Identifiants invalides'`), or add frontend-side error mapping in `handleClientLogin()` to translate known error strings before setting the `error` state.

### [LOGIN] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The "Accès client" tab label text in the current app differs from the mockup. Current app shows "Accès client" as the active tab label, while the mockup (02-login-client.png) shows the same. However, the field label shows "Adresse e-mail" while the mockup shows just "Email". Minor label inconsistency.
**Expected**: Per mockup: label should be "Email" not "Adresse e-mail".
**Fix**: Change line 123 from `Adresse e-mail` to `Email` in the form-label, or keep as-is if the more descriptive label is preferred (design decision).

### [LOGIN] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The Google SSO button text says "Se connecter avec Google" but the mockup (03-login-admin.png) shows "Continuer avec Google".
**Expected**: Button text: "Continuer avec Google" per mockup.
**Fix**: Change line 210 from `Se connecter avec Google` to `Continuer avec Google`.

### [LOGIN] — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The login card in the current app (01-login.png) uses a tab-based switcher with underline active state. The mockup (02-login-client.png) shows a pill/rounded toggle selector with a subtle background fill on the active option. The current implementation uses border-bottom tabs, while the mockup uses rounded pill buttons inside a gray container.
**Expected**: Pill-style tab switcher with rounded background container (similar to segmented control), not underline tabs.
**Fix**: Restyle `.tabs` container to have a rounded gray background and `.tab-active` to use a white filled pill shape instead of border-bottom underline. Add `background: #f3f4f6; border-radius: 10px; padding: 4px;` to `.tabs` and `background: white; border-radius: 8px; border-bottom: none; box-shadow: 0 1px 2px rgba(0,0,0,0.05);` to `.tab-active`.

### [LOGIN] — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Background decorative shapes — the current app shows multiple blurred blue circles at various positions, while the mockup shows a single large blue-purple gradient circle in the top-right corner. The current implementation is busier.
**Expected**: Single large decorative shape in top-right, not multiple scattered shapes.
**Fix**: Remove `.shape-2`, `.shape-3`, `.shape-4` elements and adjust `.shape-1` to match the mockup's single top-right circle with a blue-purple gradient.

---

## DASHBOARD

### [DASHBOARD] — HIGH
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Dashboard is missing the change/trend indicators on stat cards. The mockup shows "+2 ce mois" under "Projets actifs" and "+47 cette semaine" under "Pages capturées" with green trend arrows. The current implementation shows only the raw numbers without trend data.
**Expected**: Each stat card should have a small green trend indicator below the main number showing the change over the recent period.
**Fix**: Add trend indicator elements to the stat cards. The backend `/api/analytics/overview` endpoint may already return trend data; if not, compute it client-side. Add a `<span class="trend">↗ +2 ce mois</span>` below the count in each stat card.

### [DASHBOARD] — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The dashboard only shows 2 stat cards (Projets actifs, Pages capturées), but the mockup has space for at least 3 cards. The mockup's layout shows the two cards taking up roughly 1/3 each of the width, suggesting a third card was planned but is empty/placeholder in the mockup.
**Expected**: Consider adding a third stat card (e.g., "Sessions actives" or "Utilisateurs") to fill the row evenly, or ensure the 2-card layout fills the width proportionally.
**Fix**: Either add a third stat card or adjust the grid to `grid-template-columns: repeat(2, 1fr)` to fill the width.

### [DASHBOARD] — LOW
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The "Journal d'activité des clients" tab filter pills in current app show counts in blue filled badges (e.g., "Toutes 4"), while the mockup shows them as smaller inline text badges. The current styling is slightly more prominent than the mockup.
**Expected**: Subtler badge styling matching mockup — smaller, lighter colored count badges.
**Fix**: Minor CSS adjustment to reduce badge size and weight in the tab filters.

---

## PROJECTS LIST

### [PROJECTS] — MEDIUM
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: The project cards in current app (06-projects.png) show colored initials avatars (SA for Salesforce, WO for Workday, etc.) which is good. However, the mockup shows the sidebar in collapsed state for this page while the current screenshot shows it expanded. This may just be a test screenshot difference, but the card layout with expanded sidebar is tighter.
**Expected**: Layout should work well in both sidebar states. Currently functional.
**Fix**: No code fix needed — verify responsive behavior when sidebar collapses.

### [PROJECTS] — LOW
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: The filter tabs show "Tous | Actifs | Test | Archives" but there's no visible search bar aligned next to the tabs in the current screenshot. The mockup was not available as PNG but per the design system, a search input should be available on list pages.
**Expected**: Search input "Rechercher un projet..." aligned right of the tabs.
**Fix**: Verify the search input is visible and properly positioned. It may be cut off in the screenshot.

---

## PROJECT DETAIL

### [PROJECT_DETAIL] — MEDIUM
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: The project detail page (07-project-detail.png) shows a versions table with columns: NOM, STATUT, LANGUE, CRÉÉE LE, ACTIONS. The version rows show initials badges (LI). This is functional but the mockup (maquette-project-detail) was not available as a rendered PNG for direct comparison. Based on the HTML mockup, the design should include tabs for "Versions", "Assignations", and "Configuration".
**Expected**: Project detail should have tab navigation for Versions / Assignations / Configuration sections.
**Fix**: Verify tabs are present in the component. If only the versions table is shown without tabs, add tab navigation for the other sections.

### [PROJECT_DETAIL] — MEDIUM
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: The breadcrumb shows "Dashboard > Projets > Salesforce CRM" but the mockup convention shows "Dashboard > Projets > Nom du projet". The current implementation is correct — just noting the breadcrumb navigation works.
**Expected**: Breadcrumb is correct. No issue.
**Fix**: N/A — this is working correctly.

---

## TREE VIEW

### [TREE_VIEW] — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The current tree view (08-tree.png) shows a simple flat tree with bullet dots (green circles) and page icons. The mockup (maquette-tree-view R003) shows a much richer tree with: expandable/collapsible sections with counts (e.g., "Contacts (14)", "Opportunités (18)"), colored section icons (different colors for different sections), page type badges ("Modale" tag), status dots (green/orange/red), and a breadcrumb path at the bottom (e.g., "Accueil / Contacts / Fiche client"). The current implementation is significantly simplified.
**Expected**: Rich tree with collapsible sections showing child counts, colored section icons, "Modale" badges for modal pages, and a breadcrumb path at the bottom showing the current selection path.
**Fix**: Major enhancement needed:
1. Add collapsible tree sections with child counts in parentheses
2. Add colored icons per section (different colors for different page categories)
3. Add "Modale" badge for modal-type pages
4. Add breadcrumb path at bottom of tree panel
5. Support nested pages showing parent-child hierarchy

### [TREE_VIEW] — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The tree view tabs show "Par site | Par guide | Carte du site" but the mockup shows "Arborescence | Liste | Carte du site" as the tab labels. The current tabs use different terminology.
**Expected**: Tabs should read "Arborescence | Liste | Carte du site" per mockup, or alternatively keep "Par site | Par guide | Carte du site" if this was a deliberate design change.
**Fix**: Rename tab labels if needed to match the final design decision. Also, the mockup shows the first tab as a filled blue pill (active state), matching the current implementation.

### [TREE_VIEW] — MEDIUM
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The status summary bar shows "8 OK • 0 Avert. • 0 Erreur" with colored dots, which is good. But the mockup shows "86 pages • 12 modales • 3 erreurs" — different metrics being tracked. The current implementation counts page health status while the mockup counts page types.
**Expected**: Status bar should show page type counts (pages, modales, erreurs) rather than health status counts.
**Fix**: Change the status summary to show total pages, modal pages, and error pages counts instead of OK/Warning/Error health status.

---

## ANALYTICS

### [ANALYTICS] — HIGH
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The mockup shows a split-view at the bottom with two side-by-side sections: "Admins & Commerciaux (33 sessions)" on the left and "Clients (51 sessions)" on the right, each with their own search bar and session list. The current implementation (09-analytics.png) instead shows a single "Sessions récentes" table with all sessions mixed together, filtered by search. The two-audience split is missing.
**Expected**: Two-column layout at the bottom separating admin/commercial sessions from client sessions, each with independent search and count.
**Fix**: Split the "Sessions récentes" section into two columns: one for admin sessions (filtered by `!assignmentId`) and one for client sessions (filtered by `assignmentId`). Each column should have its own header with count and search bar.

### [ANALYTICS] — MEDIUM
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The chart section header shows "Sessions (7 derniers jours)" which matches the mockup. However, the bar chart in the current app (09-analytics.png) shows very large, tall blue bars filling most of the height, while the mockup shows a more subtle, smaller line/area chart. The current bars are visually heavy.
**Expected**: More subtle chart visualization — consider a line chart or smaller bars with more padding.
**Fix**: Reduce bar height/max-height and add more spacing, or switch to a line/area chart style.

---

## INVITATIONS

### [INVITATIONS] — HIGH
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The mockup feedback (R005, UNRESOLVED) requests adding an option to "exiger la création d'un compte" (require account creation) in the invitation flow. This feature is not implemented.
**Expected**: The new invitation dialog should have a checkbox or toggle to require the invited client to create an account.
**Fix**: Add a toggle/checkbox in the invitation creation dialog: "Exiger la création d'un compte" that flags the invitation to require account creation before accessing the demo.

### [INVITATIONS] — LOW
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The current page (10-invitations.png) shows "Invitations envoyées: 2" and "Clients actifs: 2" stat cards. The stat cards look clean and match the design system. The table shows CLIENT, EMAIL, DÉMO ASSIGNÉE, EXPIRATION, STATUT, ACTIONS columns which are appropriate.
**Expected**: Layout matches mockup reasonably well.
**Fix**: No immediate fix needed for layout.

---

## USERS

### [USERS] — LOW
**File**: `frontend/src/routes/admin/users/+page.svelte`
**Issue**: The users page (11-users.png) shows user cards in a list view with avatar, name, email, auth method badge ("Google SSO"), role badge ("Administrateur"/"Client"), and join date. There was no specific mockup for the users page in the mockup-forge project, so this appears to be an original implementation.
**Expected**: No mockup reference to compare against. Current implementation looks clean and follows design system conventions.
**Fix**: No fix needed — page follows design system.

---

## OBFUSCATION

### [OBFUSCATION] — HIGH
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The mockup (R001 feedback, resolved) says "toujours global" — delete the "Portée" scope selector, as obfuscation rules are always applied globally. The current implementation (12-obfuscation.png) still shows a "PORTÉE" column in the table with "Global" values and a Globe icon. While the value is always "Global", the column takes up space unnecessarily since it's always the same value.
**Expected**: Per mockup feedback (resolved), the "Portée" column should be removed from the table since rules are always global. The "Appliquer globalement" toggle at the top already communicates this.
**Fix**: Remove the "PORTÉE" column from the table. The global scope is already indicated by the "Appliquer globalement" toggle at the top of the page.

### [OBFUSCATION] — MEDIUM
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The mockup shows the "Règles auto" tab as a filled blue pill with white text (actively selected), while the current implementation (12-obfuscation.png) shows a more subtle tab style with just a count badge. The active tab styling differs.
**Expected**: Active tab should be a filled blue pill with white text per mockup.
**Fix**: Update the tab active state CSS to use a filled blue background with white text instead of the current more subtle style.

---

## UPDATE REQUESTS (DEMANDES MAJ)

### [UPDATE_REQUESTS] — LOW
**File**: `frontend/src/routes/admin/update-requests/+page.svelte`
**Issue**: The update requests page (13-update-requests.png) shows 3 stat cards (En attente: 1, En cours: 1, Terminées: 1) followed by filter tabs and request cards. This page has no specific mockup in mockup-forge to compare against, so it appears to be an original implementation.
**Expected**: No mockup reference available. Current implementation looks clean with proper status indicators and action buttons ("Prendre en charge", "Marquer terminée").
**Fix**: No fix needed — page follows design system conventions well.

---

## COMMAND PALETTE

### [COMMAND_PALETTE] — HIGH
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The mockup (maquette-command-palette R003) shows a command palette with a different structure: it has top-level category tabs ("Projets", "Demos", "Utilisateurs", "Captures") and shows search results with project context (e.g., "Dashboard principal — SALESFORCE — Page Salesforce Lightning — Page d'accueil · Modifiée il y a 2h"). The current implementation (14-command-palette.png) shows category tabs "Tous | Pages | Projets | Utilisateurs | Actions" and lists ACTION items. The mockup also has feedback (R003, resolved) saying "raccourcis non nécessaire" (shortcuts not needed) and to rename the feature to "résultats de recherche" (search results).
**Expected**:
1. The keyboard shortcut hints at the bottom of the palette should be removed per feedback (current shows "↑↓ Naviguer | ↵ Ouvrir | Tab Catégorie | Esc Fermer")
2. The category tabs should potentially be renamed to match the mockup: "Projets, Demos, Utilisateurs, Captures" instead of "Tous, Pages, Projets, Utilisateurs, Actions"
3. Search results should show richer context (project name, tool badge, modification time)
**Fix**:
1. Remove the keyboard shortcut hints bar at the bottom (or hide them)
2. Review tab categories to align with the mockup's structure
3. Enhance search result items to show project context, tool badges, and timestamps

---

## SIDEBAR (across all pages)

### [SIDEBAR] — MEDIUM
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The mockup sidebar (maquette-admin-dashboard) shows a "Composants" nav item in the GESTION section, which is not present in the current implementation. The CLAUDE.md spec also doesn't list "Composants". However, the mockup clearly shows it between "Obfuscation" and "Paramètres".
**Expected**: Either add "Composants" nav item per mockup, or confirm it was intentionally removed.
**Fix**: Design decision needed — if "Composants" is a planned feature, add the nav item. Otherwise, no fix needed.

### [SIDEBAR] — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The collapsed sidebar (05-dashboard-collapsed.png) shows colored dots on the left edge for the OUTILS SIMULÉS section, which is a nice touch. The collapsed state overall looks good and matches the 48px width spec.
**Expected**: Collapsed sidebar is functional and well-designed.
**Fix**: No fix needed.

---

## CROSS-PAGE ISSUES

### [GLOBAL] — CRITICAL
**File**: `backend/src/routes/auth.ts`
**Issue**: All backend error messages are in English ("Invalid credentials", "User not found", etc.) while the UI convention is French. This causes English error messages to appear in the French UI when API errors are displayed to the user (visible in screenshot 03-login-error.png showing "Invalid credentials").
**Expected**: All user-facing error messages should be in French per the project convention (UI Content: French).
**Fix**: Change error messages in `backend/src/routes/auth.ts`:
- Line 27: `'Invalid credentials'` → `'Identifiants invalides'`
- Line 38: `'Invalid credentials'` → `'Identifiants invalides'`
- Line 44: `'Invalid credentials'` → `'Identifiants invalides'`
Alternatively, add a frontend error translation layer in the API client.

### [GLOBAL] — MEDIUM
**File**: Multiple files
**Issue**: The mockup uses the "Accueil" breadcrumb prefix (e.g., "Accueil > Gestion des invitations") while the current implementation uses "Dashboard" as the breadcrumb prefix (e.g., "Dashboard > Invitations > Gestion des invitations").
**Expected**: First breadcrumb element should be "Accueil" per mockup convention, not "Dashboard".
**Fix**: Update breadcrumb component or header to use "Accueil" instead of "Dashboard" as the root breadcrumb label.

---

## PAGES NOT COMPARED (no mockup available)

The following pages have no corresponding mockup in mockup-forge and could not be compared:
- **Users page** (`/admin/users`) — Original implementation, looks clean
- **Update Requests page** (`/admin/update-requests`) — Original implementation, well-structured
- **Project Detail page** (`/admin/projects/[id]`) — HTML mockup exists but no rendered PNG for pixel comparison

---

## Summary

TOTAL_ISSUES: 26
CRITICAL: 1
HIGH: 8
MEDIUM: 10
LOW: 7
