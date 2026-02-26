# Iteration 10 — Visual & Functional QA Report

**Date**: 2026-02-26
**Compared**: Current app screenshots (post-iteration-9 fixes) vs reference mockups (latest retours/)

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 3 |
| MEDIUM   | 7 |
| LOW      | 5 |
| **TOTAL** | **15** |

---

## LOGIN (Client tab) — MEDIUM

**File**: `frontend/src/routes/login/+page.svelte`

### Issue 1 — MEDIUM: Login card renders at narrow viewport, missing decorative background
**Issue**: Screenshots 01-login and 02-login-filled show the login card at a very narrow viewport (~640px wide), appearing cramped with no visible background decoration. The larger screenshots (02-login-client at 1280px) correctly show the centered card with the decorative blue/purple gradient circle in the top-right corner and proper spacing. The narrow-viewport screenshots suggest the test runner captures at too small a resolution for the first screenshots.
**Expected**: Card centered on a full-viewport background with the purple/blue gradient circle visible in the top-right corner, as seen in screenshot 02-login-client and 03-login-admin.
**Fix**: This is a screenshot test configuration issue, not a code bug. Ensure all login screenshots are captured at 1280x720 minimum. The actual full-viewport rendering (02-login-client, 03-login-admin) matches the mockup well.

### Issue 2 — LOW: Login background gradient circle is light purple, mockup may expect a slightly larger circle
**Issue**: The decorative circle in screenshot 02-login-client is visible in the top-right corner. The mockup (R006/R007) also shows this circle. The size and position are a close match but the mockup circle appears slightly larger and more visible.
**Expected**: Subtle difference — acceptable as-is.
**Fix**: Optional: increase the circle size from current value by ~20% in the CSS `.bg-shape.shape-1` class.

---

## LOGIN (Admin tab) — OK

Screenshot 03-login-admin correctly shows:
- "Administration" tab selected (bold text, white pill background)
- "Connectez-vous avec votre compte Google Lemon Learning pour accéder à l'administration." text
- "Continuer avec Google" button with Google icon
- "(admin uniquement)" hint in gray text below the button
- Decorative background circle in top-right corner

This matches the mockup feedback requirement (R007) perfectly. The "(admin uniquement)" text was the specific request and is correctly implemented.

---

## LOGIN (Error state) — OK

Screenshot 03-login-error correctly shows the red error banner with "Identifiants invalides" message in a pink/red container. Styling matches expectations.

---

## DASHBOARD — HIGH

**File**: `frontend/src/routes/admin/+page.svelte`

### Issue 3 — HIGH: Dashboard stat cards show "Démos actives: 2" with "2 assignations actives" but mockup shows 4 stat cards without "Démos actives"
**Issue**: The current dashboard (screenshot 04) shows 4 stat cards: "Projets actifs" (7), "Pages capturées" (17), "Démos actives" (2), "Sessions ce mois" (4). The mockup (R008/R009) shows only 2 clearly visible stat cards: "Projets actifs" and "Pages capturées" with the remaining 2 cards cut off. The mockup R009 feedback requested adding "pages consultées - temps passé" which suggests the stat cards should include page views and time spent metrics, not just "Démos actives".
**Expected**: Review whether "Démos actives" and "Sessions ce mois" are the right 3rd and 4th cards. Per mockup feedback R009, the additional stats should be "pages consultées" and "temps passé" (pages viewed and time spent).
**Fix**: Consider renaming or replacing the 3rd and 4th stat cards:
- Card 3: "Pages consultées" (total page views from analytics)
- Card 4: "Temps passé" (average time spent from analytics)
This aligns with the R009 feedback. In `+page.svelte`, fetch these values from `/api/analytics/overview`.

### Issue 4 — MEDIUM: Dashboard "Répartition par projet" bar chart has low numbers due to seed data
**Issue**: The bar chart shows Salesforce: 8, SAP SuccessFactors: 0, Workday: 0, ServiceNow: 5, HubSpot: 4, Zendesk: 0. These are real page counts from seed data but look sparse compared to the mockup's higher numbers (128, 74, 52, etc.).
**Expected**: This is a seed data volume issue, not a UI bug. The chart renders correctly.
**Fix**: Enrich seed data with more pages per project for a more realistic demo. No code change needed.

### Issue 5 — MEDIUM: Dashboard "Sessions ce mois" sub-text shows "767min moy." which is unrealistically high
**Issue**: The stat card "Sessions ce mois" shows "20 pages · 767min moy." — 767 minutes average (12.8 hours) per session is unrealistically high. This suggests the average session duration computation is wrong or the seed data has inflated timestamps.
**Expected**: Average session time should be realistic (e.g., 5-30 minutes).
**Fix**: Check the session duration computation in the dashboard. The seed data in `backend/src/db/seed.ts` likely has session start/end times that are too far apart. Fix the seed data to produce realistic durations, or fix the computation (ensure it's calculating in minutes correctly, not seconds-to-minutes conversion error).

---

## DASHBOARD (Collapsed sidebar) — OK

Screenshot 05-dashboard-collapsed shows the sidebar correctly collapsed to icon-only mode with all navigation icons visible and proper spacing. The main content area expands to fill the space. This matches the design spec of 48px collapsed width.

---

## PROJECTS — MEDIUM

**File**: `frontend/src/routes/admin/projects/+page.svelte`

### Issue 6 — MEDIUM: Projects page breadcrumb shows "Projets > Accueil" but mockup shows no breadcrumb
**Issue**: The projects page header (screenshot 06) shows "Projets > Accueil" breadcrumb. The mockup (dashboard mockup as reference) typically shows "Dashboard > Vue d'ensemble" style breadcrumbs but the projects page should show "Projets" as the main heading with subtitle "Gérez vos environnements simulés" which is correctly present.
**Expected**: The breadcrumb "Accueil" after "Projets" may not be needed. The mockup dashboard shows breadcrumb "Accueil > Vue d'ensemble" which makes sense for dashboard. For Projects, "Projets" alone is sufficient.
**Fix**: Minor: consider removing the breadcrumb on the projects list page, or change it to just "Projets" without sub-items. This is a polish issue.

### Issue 7 — LOW: Project cards show very low page counts (0 pages for many projects)
**Issue**: Several project cards show "0 pages" (SAP SuccessFactors, Workday, Zendesk). This is correct per seed data but gives a sparse impression.
**Expected**: Seed data issue — not a UI bug.
**Fix**: No code change. Optionally add more pages to seed data.

---

## PROJECT DETAIL — MEDIUM

**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`

### Issue 8 — MEDIUM: Project detail health ring shows "100% santé" — possibly always 100% when no errors exist
**Issue**: Screenshot 07 shows the health ring at "100% santé" in green. This could be correct (all 8 pages have no errors), but previously it was hardcoded at 86%. After the iteration-9 fix, it now computes from actual page data. With all pages being OK, 100% is the correct value.
**Expected**: 100% is correct when all pages have no errors. This is now properly computed.
**Fix**: Verify the computation handles edge cases (0 pages = N/A, not 100%). But for current data, 100% is correct. Mark as OK.

### Issue 9 — MEDIUM: Project detail version cards show version name "Lightning v2024.1" with green left border, but badges should differentiate active vs obsolete more clearly
**Issue**: Both visible versions ("Lightning v2024.1" and "Lightning EN") show "Actif" badges in green. The checkbox at bottom says "Afficher les versions obsolètes (1)" suggesting there's a hidden obsolete version. The card styling with green left border for active versions is good.
**Expected**: Active versions have green left border and "Actif" badge. Obsolete versions (when shown) should have a different visual treatment. This appears correct.
**Fix**: No fix needed — styling is correct.

---

## TREE VIEW — HIGH

**File**: `frontend/src/routes/admin/tree/+page.svelte`

### Issue 10 — HIGH: Tree view structure is still a simple flat list, missing rich mockup features
**Issue**: The current tree view (screenshot 08) shows:
- Project dropdown selector: "Salesforce CRM" (correct)
- Tabs: "Arborescence | Liste | Carte du site" (correct — fixed in iteration 9)
- Filter input: "Filtrer les pages..." (correct)
- Status summary: "8 pages · 0 modales · 0 erreurs" with health dots (correct — added in iteration 9)
- Simple flat tree with bullet status dots and page icons

However, the mockup (R003) shows a much richer tree:
1. **Collapsible folder groups** with page counts: "Accueil (8)", "Contacts (14)", "Opportunités (18)", etc. — grouped by section
2. **Color-coded folder icons** — each section has a unique color (blue, green, yellow, orange, red, purple)
3. **"Modale" badges** on certain pages (e.g., "Nouveau contact [Modale]", "Confirmer suppression [Modale]")
4. **"... et 8 autres pages"** overflow link for large sections
5. **Version navigator** at bottom showing "Salesforce — Démo Q1" with version name and prev/next arrows
6. **Much richer hierarchy** — the mockup tree has deeply nested pages under folder groups

The current tree is flat with only 8 pages listed without folder grouping. The mockup shows 86+ pages organized into 8+ folder groups.

**Expected**: Tree should show pages grouped by their URL segments (folder structure), with collapsible sections, page counts per group, colored folder icons, and modal badges.
**Fix**: Major enhancement needed in `+page.svelte`:
- Group pages by their top-level URL segment (e.g., `/contacts/*` → "Contacts" folder)
- Make folders collapsible with chevron toggle
- Show page count per folder: "Contacts (14)"
- Assign distinct colors per folder icon
- Show "Modale" badge for pages marked as modals
- Add "... et N autres pages" when a folder has many pages
- The version navigator at bottom already exists per iteration-9 fix

### Issue 11 — MEDIUM: Tree view "Carte du site" tab — mockup shows a node-graph visualization
**Issue**: The mockup (R002) shows a "Carte du site" (site map) view as a visual node graph with connected nodes representing pages and their relationships. This is a complex visualization feature. The current implementation likely shows a simple list or placeholder.
**Expected**: The "Carte du site" tab should render an interactive node graph showing page relationships.
**Fix**: This is a significant feature. For now, consider showing a placeholder message "Carte du site — Bientôt disponible" or implement a basic force-directed graph using D3.js or a similar library.

---

## ANALYTICS — LOW

**File**: `frontend/src/routes/admin/analytics/+page.svelte`

### Issue 12 — LOW: Analytics "SESSIONS TOTALES" label is uppercase but mockup shows "Sessions totales" in sentence case
**Issue**: The current analytics page (screenshot 09) shows "SESSIONS TOTALES" in all-caps. The mockup (R005) shows "Sessions totales" in regular sentence case with lighter weight.
**Expected**: "Sessions totales" in sentence case, not uppercase.
**Fix**: In the analytics page template, change the heading style from uppercase to sentence case. Remove `uppercase` class or `text-transform: uppercase` from the "SESSIONS TOTALES" heading.

### Issue 13 — LOW: Analytics "7 DERNIERS JOURS" label is uppercase
**Issue**: Similar to above — "7 DERNIERS JOURS" is in uppercase. Mockup suggests regular case.
**Expected**: Regular case text.
**Fix**: Remove uppercase styling from the chart label.

---

## INVITATIONS — OK

**File**: `frontend/src/routes/admin/invitations/+page.svelte`

Screenshot 10 shows a well-implemented invitations page with:
- 3 stat cards: Invitations envoyées (2), Liens actifs (2), Connexions (2)
- Two-column layout: invitation list on left, "Générer un accès" form on right
- Form has: Invitation par email / Partager un lien tabs, name/email/company fields, project/version/expiration dropdowns
- "Exiger la création d'un compte" checkbox (per mockup feedback R005)
- Table with CLIENT, EMAIL, PROJET/DEMO, STATUT columns

The implementation matches the mockup structure and incorporates the R005 feedback. The additional detail and fields are appropriate UX improvements.

---

## USERS — OK

**File**: `frontend/src/routes/admin/users/+page.svelte`

Screenshot 11 shows a clean user management page with proper:
- User count summary: "5 utilisateurs — 3 admins, 2 clients"
- Filter tabs: Tous (5), Admins (3), Clients (2)
- User rows with avatar, name, email, auth method, role badge, join date, action menu
- "Vous" tag on current user
- "+ Nouvel utilisateur" button

No mockup was available for comparison. Implementation follows design system correctly.

---

## OBFUSCATION — HIGH

**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`

### Issue 14 — HIGH: Obfuscation page has a complex two-column layout that differs from mockup structure
**Issue**: The current obfuscation page (screenshot 12) shows a two-column layout:
- Left column: Rules table with TYPE, RECHERCHER, REMPLACER PAR, OCCURRENCES, STATUT, ACTIONS columns, plus toggle switches, and a "Masquage dans l'éditeur" section at the bottom
- Right column: "Aperçu en direct" preview panel with HTML source view and coverage percentage

The mockup (R001) shows a simpler single-section layout:
- Rules table with: RECHERCHER, REMPLACER PAR, PORTÉE, OCCURRENCES, STATUT columns
- An "add rule" form inline at the bottom
- Toggle for "Appliquer globalement" in the top-right
- No separate preview panel visible in the main mockup view

The current implementation has MORE features than the mockup (preview panel, live HTML source view, coverage stats). While richer, the layout structure differs.

**Expected**: The current implementation is functionally superior to the mockup. The extra preview panel is a useful addition. However:
1. The mockup removes "PORTÉE" (scope) column per R001 feedback ("toujours global") — scope should always be "Global" and the column can be removed
2. The "Ajouter une règle" button placement differs

**Fix**:
- Remove the "PORTÉE" column from the rules table if scope is always global (per R001 feedback that says "toujours global")
- The preview panel is a good addition to keep
- Ensure the "Ajouter une règle" form matches the mockup's inline bottom placement

---

## UPDATE REQUESTS (Demandes MAJ) — OK

**File**: `frontend/src/routes/admin/update-requests/+page.svelte`

Screenshot 13 shows a well-structured page with:
- 3 stat cards with colored borders: En attente (1, orange), En cours (1, blue), Terminées (1, green)
- Filter tabs matching stat categories
- Request cards with: status badge, timestamp, description text, page reference, user name, date, action buttons
- "Prendre en charge" and "Marquer terminée" action buttons

No mockup available for comparison. Implementation follows design system correctly and provides good UX.

---

## COMMAND PALETTE — MEDIUM

**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`

### Issue 15 — MEDIUM: Command palette is a centered modal overlay, mockup shows a full search results page
**Issue**: The current command palette (screenshot 14) opens as a centered modal overlay on top of the dashboard. It shows:
- Search input: "Recherche admin — pages, projets, utilisateurs..."
- Category tabs: Tous, Pages, Projets, Démos, Utilisateurs, Captures (updated in iteration 9)
- Results section with "ACTIONS" group and 5 quick-action items
- Keyboard shortcuts hint at bottom

The mockup (R003) shows a completely different layout:
1. Full-page view (not a modal) with top navigation bar
2. Left sidebar with project filters (Tous les projets, Salesforce, SAP, etc.)
3. Search input at top with results below, grouped by "PAGES" and "PROJETS"
4. Each page result shows: page name, project badge (colored), description, modification date, and action icons
5. "4 résultats" count indicator

The structural difference is significant — the mockup envisions a full search results page while the current implementation is a quick-action modal.

**Expected**: Per R003 feedback, this should be a "résultats de recherche" (search results) feature, not just a command palette. The mockup shows actual page/project search results with rich metadata, not quick actions.
**Fix**: Two options:
1. **Minimal**: Keep the Cmd+K modal but enhance it to show actual search results (pages, projects) from the API when the user types, instead of just showing quick actions. Add project badges and metadata to results.
2. **Full**: Build a dedicated `/admin/search` route that matches the mockup's full-page layout, and have Cmd+K navigate to it. This is more work but matches the mockup.

Recommended: Option 1 (enhance the existing modal to show real search results) as it's more practical for Cmd+K UX.

---

## SIDEBAR — OK

**File**: `frontend/src/lib/components/layout/Sidebar.svelte`

The sidebar (visible in all admin screenshots) matches the design system:
- "ES" blue avatar with "Env. Simulés / Lemon Learning"
- PRINCIPAL section: Dashboard, Projets (7), Arborescence, Analytics (4), Invitations (2)
- GESTION section: Utilisateurs, Obfuscation, Demandes MAJ (1), Paramètres
- OUTILS SIMULÉS section: Salesforce (8), SAP SuccessFactors, Workday, ServiceNow (5) with colored dots
- User profile at bottom: "Marie Laurent / Administrateur" with green status dot
- Active item highlighted with blue text and blue left border
- Badge counts on relevant items

The "Composants" nav item was removed in iteration 9. The sidebar now matches the CLAUDE.md spec.

Note: The mockup dashboard sidebar shows "Composants" which was part of an earlier mockup version but was removed per spec. Current sidebar correctly omits it.

---

## GLOBAL HEADER — OK

**File**: `frontend/src/lib/components/layout/Header.svelte`

The header bar (visible in all admin screenshots) shows:
- Page title with breadcrumb (e.g., "Dashboard", "Projets > Accueil")
- Search bar: "Rechercher pages, projets, utilisateurs..." with Cmd+K shortcut
- Notification bell icon (with red dot)
- Help/info icon
- "Extension" button

The "+ Nouveau projet" button was removed from the global header in iteration 9 and now only appears on the Projects page. This matches the mockup expectations.

---

## PAGES NOT COVERED BY SCREENSHOTS

The following pages have mockups but no corresponding screenshots in the test suite:

### Page Editor — NOT TESTED
**Mockup**: `maquette-page-editor-25fev26` (R004)
**Issue**: No screenshot for the page editor (`/admin/editor/[id]`). The mockup shows a code editor with HTML source, a left sidebar with page tree, and top navigation with "Retour à l'arborescence > Accueil > Contacts > Fiche Contact > Éditeur" breadcrumb.
**Expected**: Page editor should be captured in the screenshot test suite.
**Fix**: Add a screenshot test for the page editor route.

### Demo Viewer — NOT TESTED
**Mockup**: `maquette-demo-viewer-24fev26` (R002)
**Issue**: No screenshot for the demo viewer (`/demo/[...path]`). The mockup shows a Salesforce-like page being served with a "LL" (Lemon Learning) floating button in the bottom-right corner.
**Expected**: Demo viewer should be captured in the screenshot test suite.
**Fix**: Add a screenshot test for the demo viewer route.

### Commercial Viewer — NOT TESTED
**Mockup**: `maquette-commercial-viewer-24fev26`
**Issue**: No screenshot for the commercial/prospect viewer (`/view/[...path]`).
**Expected**: Commercial viewer should be captured in the screenshot test suite.
**Fix**: Add a screenshot test for the viewer route.

---

## Summary

TOTAL_ISSUES: 15
CRITICAL: 0
HIGH: 3
MEDIUM: 7
LOW: 5
