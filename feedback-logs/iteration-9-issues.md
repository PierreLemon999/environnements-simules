# Iteration 9 — Visual & Functional QA Report

**Date**: 2026-02-26
**Compared**: Current app screenshots vs reference mockups (latest retours/)

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH     | 5 |
| MEDIUM   | 8 |
| LOW      | 5 |
| **TOTAL** | **19** |

---

## LOGIN — MEDIUM

**File**: `frontend/src/routes/login/+page.svelte`

### Issue 1 — MEDIUM: Login card missing background decorative shape
**Issue**: The current login page (screenshot 01-login) renders at a very small viewport size compared to the mockup (R007). The mockup shows the card centered on a large background with a blue/purple gradient circle in the top-right corner. The app's card appears much smaller and more cramped.
**Expected**: Card should be centered in a full-height viewport with the decorative purple/blue circle visible in the top-right corner as in the mockup. The card content should feel spacious.
**Fix**: The login page does have `bg-shape shape-1` but the screenshots suggest the viewport is narrow. Ensure the screenshot test captures at 1280x720 minimum. The decorative shape is present in the code but may not render visibly at smaller viewports.

### Issue 2 — LOW: "Accès client" tab indicator style
**Issue**: In the mockup (R007, client tab), the active tab has a white pill background with subtle shadow. The current app's tab styling looks similar but the tab appears slightly thinner with less visual weight.
**Expected**: Active tab should have clear white background with box-shadow matching mockup exactly.
**Fix**: In `.tab-active` style, verify `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)` is sufficient. Consider `0 1px 4px rgba(0, 0, 0, 0.1)` for more definition.

---

## LOGIN (Admin tab) — OK

The admin tab correctly shows:
- "Connectez-vous avec votre compte Google Lemon Learning pour accéder à l'administration." text
- "Continuer avec Google" button with Google icon
- "(admin uniquement)" hint in gray text below

This matches the mockup feedback requirement (R007) perfectly.

---

## LOGIN (Error state) — OK

Error state (screenshot 03-login-error) correctly shows the red error banner with "Identifiants invalides" message. Styling matches expectations.

---

## DASHBOARD — HIGH

**File**: `frontend/src/routes/admin/+page.svelte`

### Issue 3 — HIGH: Dashboard missing "pages consultées" and "temps passé" metrics in stat cards
**Issue**: The mockup (R009) shows 4 stat cards with the following: "Projets actifs", "Pages capturées", and two additional cards that were requested in feedback R009 ("pages consultées - temps passé"). The current dashboard has "Démos actives" (hardcoded to 19) and "Sessions ce mois" instead. The mockup's stat cards appear to show different stats from the actual implementation. Specifically, the mockup shows the stat cards with numbers, page counts from the sidebar (128, 74, 52, 38, 24, 16) which are much larger than the app's (8, 0, 0, 5, 4, 0).
**Expected**: The stat cards should reflect real data properly. The "Démos actives" card shows a hardcoded value of 19 which is not computed from actual data.
**Fix**: In `+page.svelte:243`, replace the hardcoded `19` with an actual computed value from demo assignments. Fetch assignment counts from the API.

### Issue 4 — MEDIUM: Dashboard "Répartition par projet" bar counts don't match sidebar
**Issue**: The sidebar shows project page counts (Salesforce: 8, SAP SuccessFactors: 0, Workday: 0) while the bar chart also shows these same low numbers. The mockup shows much higher counts (128, 74, 52, etc.) which suggests the seed data is minimal. This is not a code bug but a data discrepancy.
**Expected**: Numbers match between sidebar and chart (they do), but the visual difference from the mockup is due to seed data volume.
**Fix**: This is expected with limited seed data. No code fix needed — enrich seed data if desired.

### Issue 5 — MEDIUM: Dashboard header missing "Nouveau projet" button
**Issue**: The current dashboard (screenshot 04) shows the header with "Extension" button and "+ Nouveau projet" button. The mockup (R009) does NOT show a "+ Nouveau projet" button in the header — it only shows the search bar, notification bell, help icon, and "Extension" button. The "Nouveau projet" button is present in the current app but absent from the mockup.
**Expected**: The header should match the mockup. The "+ Nouveau projet" button should only appear on the Projects page, not globally in the header.
**Fix**: In `frontend/src/lib/components/layout/Header.svelte`, conditionally show the "+ Nouveau projet" button only when the current route is `/admin/projects`.

---

## DASHBOARD (Collapsed sidebar) — OK

Screenshot 05-dashboard-collapsed shows the sidebar correctly collapsed to icon-only width (48px), with navigation icons visible. This matches the expected collapsed behavior from the design spec.

---

## PROJECTS — MEDIUM

**File**: `frontend/src/routes/admin/projects/+page.svelte`

### Issue 6 — MEDIUM: Project cards layout is grid cards, mockup shows the same
**Issue**: The projects page (screenshot 06) shows project cards in a 3-column grid with colored avatar circles, tool name badges, version count, page count, and dates. This broadly matches expectations. However, the mockup for projects was not available as a PNG (only HTML prototypes in maquette-project-detail). The card layout appears reasonable.
**Expected**: Cards match the current implementation reasonably well.
**Fix**: No major fix needed. Minor polish: ensure the "Actif" badge is green and clearly visible (it appears to be using a teal/green badge which is correct).

---

## PROJECT DETAIL — HIGH

**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`

### Issue 7 — HIGH: Project detail health ring shows "86% santé" but data is fake
**Issue**: The project detail (screenshot 07) shows a circular "santé" (health) gauge at 86% in the top right. This value appears to be hardcoded or computed from incomplete logic. The mockup for project-detail was only available as HTML, not PNG, so we compare against design system expectations.
**Expected**: The health percentage should be computed from real page health data (pages with errors, warnings vs total pages).
**Fix**: Ensure the health score is computed from actual page data: `healthScore = (okPages / totalPages) * 100`. Review the computation logic in the project detail component.

### Issue 8 — MEDIUM: Missing accents in project detail text
**Issue**: The text shows "Cree par Admin" (missing accent: "Créé") and "Derniere MAJ" (missing accent: "Dernière").
**Expected**: Proper French: "Créé par Admin" and "Dernière MAJ il y a 5j".
**Fix**: Fix the French text strings in the project detail template. Search for "Cree par" and "Derniere" and add proper accents.

---

## TREE VIEW — HIGH

**File**: `frontend/src/routes/admin/tree/+page.svelte`

### Issue 9 — HIGH: Tree view structure differs significantly from mockup
**Issue**: The current tree view (screenshot 08) shows a simple flat tree with bullet-point status dots (green/orange/red), page icons, and a right panel showing "Sélectionnez une page" placeholder. The mockup (R003) shows a much richer tree with:
1. Collapsible sections with page counts in parentheses: "Accueil (8)", "Contacts (14)", etc.
2. Color-coded folder icons (blue, green, yellow, purple, etc.) per section
3. "Modale" badges on certain pages
4. A "... et 8 autres pages" overflow link
5. Version navigator at the bottom showing "Salesforce — Démo Q1"
6. Sub-tabs: "Arborescence", "Liste", "Carte du site"
7. Status counts: "86 pages · 12 modales · 3 erreurs"
**Expected**: Tree should match the mockup's richer structure with collapsible folder groups, page counts per folder, modale badges, colored folder icons, and the bottom version navigator.
**Fix**: Major refactor of the tree view component needed:
- Add collapsible folder groups with page counts
- Add color-coded folder icons
- Add "Modale" badge tags
- Add overflow "... et N autres pages" for large folders
- Change sub-tabs from "Par site | Par guide | Carte du site" to "Arborescence | Liste | Carte du site"
- Add status summary showing total pages, modals, and errors
- Add version navigator at bottom with project name and version switcher

### Issue 10 — MEDIUM: Tree view sub-tab naming mismatch
**Issue**: Current tabs show "Par site | Par guide | Carte du site". Mockup shows "Arborescence | Liste | Carte du site".
**Expected**: Tab labels should be "Arborescence", "Liste", "Carte du site".
**Fix**: Update the tab labels in the tree view component.

---

## ANALYTICS — MEDIUM

**File**: `frontend/src/routes/admin/analytics/+page.svelte`

### Issue 11 — MEDIUM: Analytics session totals card has sparkline area chart smaller than mockup
**Issue**: The current analytics page (screenshot 09) shows the sessions card with a line chart that matches the mockup's general structure. However, the mockup (R005) shows the chart area extending wider and the "Admins & Commerciaux" / "Clients" split panels are more prominent. The current implementation closely matches the mockup overall.
**Expected**: The analytics page structure is close to the mockup. Minor difference: the mockup shows a slightly larger chart area.
**Fix**: Minor styling adjustment — increase the sparkline chart height from `h-16` to `h-20` for better visibility.

### Issue 12 — LOW: Analytics "Par client" tab label
**Issue**: Current tab says "Par client". Mockup shows "Par client" as well. This is correct.
**Expected**: Correct as-is.
**Fix**: None needed.

---

## INVITATIONS — LOW

**File**: `frontend/src/routes/admin/invitations/+page.svelte`

### Issue 13 — LOW: Invitations form "Exiger la création d'un compte" checkbox present
**Issue**: The mockup feedback (R005) requested adding "exiger la création d'un compte" (require account creation) option. The current app (screenshot 10) shows this checkbox correctly with label "Exiger la création d'un compte" and subtitle "Le client devra créer un compte". This is correctly implemented.
**Expected**: Feature is present and matches requirements.
**Fix**: None needed — correctly implemented.

### Issue 14 — LOW: Invitations page has "Envoyé le" column in table, mockup doesn't show dates
**Issue**: The mockup (R005) shows a minimal invitation list with "CLIENT | EMAIL | PROJET/DEMO | STATUT" columns. The current app adds an "Envoyé le" date column which is not in the mockup but is a useful addition.
**Expected**: The extra column is acceptable UX improvement.
**Fix**: No fix needed — keep the date column.

---

## USERS — OK

**File**: `frontend/src/routes/admin/users/+page.svelte`

The users page (screenshot 11) shows a clean list with:
- User avatars with initials
- Name, email, auth method (Google SSO)
- Role badges (Administrateur/Client)
- Join dates
- Filter tabs: Tous (5), Admins (3), Clients (2)

No mockup was available for users page, but the implementation follows the design system correctly with proper colors, typography, and component usage.

---

## OBFUSCATION — HIGH

**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`

### Issue 15 — HIGH: Obfuscation page only shows 1 rule, mockup shows many rules
**Issue**: The current obfuscation page (screenshot 12) shows only 1 rule (Acme Corporation → Entreprise Demo) with the full preview panel. The mockup (R001) shows multiple rules in the table with column headers RECHERCHER, REMPLACER PAR, PORTÉE, OCCURRENCES, STATUT plus a compact "add rule" form at the bottom. The current implementation appears functionally correct but the seed data only has 1 rule.
**Expected**: The obfuscation table should display multiple rules. The mockup shows 7+ rules in the table. This is a seed data issue, not a UI bug.
**Fix**: Add more obfuscation rules to the seed data in `backend/src/db/seed.ts` to better demonstrate the feature.

### Issue 16 — HIGH: Obfuscation occurrence count is random
**Issue**: The `getRuleOccurrences` function at line 106 returns `Math.floor(Math.random() * 50) + 1`, producing a different random number on each render. This causes the occurrence count to flicker/change unpredictably.
**Expected**: Occurrence counts should be stable and ideally computed from actual page content.
**Fix**: Replace the random mock with a stable value. Either: (a) compute occurrences from actual page content via API, or (b) use a deterministic hash of the rule ID for consistent display: `return rule.searchTerm.length * 3;` as a temporary placeholder.

---

## UPDATE REQUESTS (Demandes MAJ) — OK

**File**: `frontend/src/routes/admin/update-requests/+page.svelte`

The update requests page (screenshot 13) shows:
- 3 stat cards: En attente (1), En cours (1), Terminées (1)
- Filter tabs: Toutes (3), En attente (1), En cours (1), Terminées (1)
- Request cards with status badges, timestamps, page info, and action buttons

No mockup was available for this page. The implementation follows design system conventions correctly.

---

## COMMAND PALETTE — MEDIUM

**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`

### Issue 17 — MEDIUM: Command palette layout differs from mockup
**Issue**: The current command palette (screenshot 14) shows a centered modal with category tabs (Tous, Pages, Projets, Utilisateurs, Actions) and search results grouped by "ACTIONS" with 5 items. The mockup (R003) shows a different UI:
1. A top navigation bar with "Projets | Demos | Utilisateurs | Captures" tabs
2. A left sidebar listing projects (Tous les projets, Salesforce, SAP SuccessFactors, etc.)
3. Search results showing "PAGES" (4 results) and "PROJETS" (3 results) sections
4. Each page result shows project badge (SALESFORCE, SAP, SERVICENOW) and modification date
**Expected**: The mockup shows a very different command palette structure — it's more of a full "admin search" page than a quick command palette modal. The R004 feedback says to rename this page to "recherche admin" (admin search).
**Fix**: The command palette should be renamed to "Recherche admin" per feedback. The structure difference is significant — the mockup shows a full page with sidebar project filtering, while the current implementation is a centered modal. Consider whether to keep the modal approach (which is more practical for Cmd+K) or build the full page as shown in the mockup.

### Issue 18 — MEDIUM: Command palette category tabs don't match mockup categories
**Issue**: Current categories: Tous, Pages, Projets, Utilisateurs, Actions. Mockup categories: Projets, Demos, Utilisateurs, Captures.
**Expected**: Categories should include "Demos" and "Captures" instead of "Actions".
**Fix**: Update the tab categories in `CommandPalette.svelte` to match: Tous, Pages, Projets, Demos, Utilisateurs, Captures.

---

## SIDEBAR — LOW

**File**: `frontend/src/lib/components/layout/Sidebar.svelte`

### Issue 19 — LOW: Sidebar "Composants" nav item not in design spec
**Issue**: The sidebar includes a "Composants" item with a `Component` icon in the GESTION section. This is not in the original CLAUDE.md sidebar specification, which lists: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres. "Composants" is an extra item.
**Expected**: Per CLAUDE.md spec, GESTION section should have: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres. No "Composants".
**Fix**: Remove the "Composants" nav item from the sidebar, or document it as an intentional addition. If it was added for the shadcn component showcase, consider moving it to a dev-only route.

---

## CRITICAL ISSUES

### Issue 20 — CRITICAL: "Nouveau projet" button in header appears on all admin pages
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: The "+ Nouveau projet" blue primary button is shown in the global header on every admin page (Dashboard, Projects, Tree, Analytics, etc.). This is NOT shown in any mockup — the mockups show only the search bar, notification bell, help icon, and "Extension" button in the header.
**Expected**: The "+ Nouveau projet" button should NOT appear in the global header. Project creation should only be accessible from the Projects page itself or through the command palette.
**Fix**: Remove the "+ Nouveau projet" button from `Header.svelte` or conditionally show it only on `/admin/projects` route. Move the "Create project" action to the Projects page header area.

---

## Summary

TOTAL_ISSUES: 19
CRITICAL: 1
HIGH: 5
MEDIUM: 8
LOW: 5
