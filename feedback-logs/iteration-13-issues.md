# Iteration 13 — UI/UX Quality Audit

**Date**: 2026-02-26
**Compared**: Current app screenshots vs mockup-forge reference mockups (latest versions)

---

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3     |
| HIGH     | 12    |
| MEDIUM   | 14    |
| LOW      | 8     |
| **TOTAL** | **37** |

---

## LOGIN PAGE — HIGH

**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Login page uses a tab-based UI with "Accès client" / "Administration" tabs in a card, but the mockup (v4) uses a unified single form with email+password fields and a Google SSO button below a divider ("ou se connecter avec"). No tabs exist in the mockup.
**Expected**: Single unified login form. Email + password fields at top, a "Se souvenir de moi" checkbox + "Mot de passe oublié ?" link, blue "Se connecter" button, then a divider "ou se connecter avec", then Google SSO button with "(admin uniquement)" gray text below it.
**Fix**: Remove the tab toggle (Accès client / Administration). Show email+password form + Google SSO button on the same view. Add "Se souvenir de moi" checkbox and "Mot de passe oublié ?" link between password field and submit button. Add gray "(admin uniquement)" text below Google SSO button.

---

## LOGIN PAGE — HIGH

**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The branding title says "Environnements Simulés" but the mockup says "Environnements de Démonstration" with subtitle "Lemon Learning".
**Expected**: Title: "Environnements de Démonstration", subtitle: "Lemon Learning". Logo shows "ED" not "ES".
**Fix**: Update the title text to "Environnements de Démonstration" and subtitle to "Lemon Learning". Change the logo badge to show "ED" instead of "ES".

---

## LOGIN PAGE — MEDIUM

**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The mockup uses a single-card layout without visible card border (the card blends with decorative background shapes), while the current app shows a prominent white card with visible border.
**Expected**: Subtle card with softer shadow, animated decorative background shapes (blurred circles), dot pattern overlay for texture.
**Fix**: Adjust card styling to be more subtle. Add animated background decorative elements (floating blurred circles) as seen in mockup.

---

## LOGIN PAGE — MEDIUM

**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Missing footer below the login card. Mockup shows "Propulsé par Lemon Learning" and "© 2026 Environnements de Démonstration · Confidentialité · Conditions".
**Expected**: Footer text below card.
**Fix**: Add a footer section below the login card with the branding and legal links.

---

## LOGIN PAGE — LOW

**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The login form section label "Identifiants" with a lock icon is missing. Mockup shows it above the email field as a section header.
**Expected**: Section label "Identifiants" with lock icon above the email/password fields, plus hint text "Accès pour les équipes et les clients avec leurs identifiants" with info icon.
**Fix**: Add the section label and hint text to the login form.

---

## DASHBOARD — HIGH

**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The dashboard shows 4 stat cards (Projets actifs, Pages capturées, Pages consultées, Temps passé) but the mockup shows 4 different cards: Projets actifs, Pages capturées, **Démos actives**, **Sessions ce mois**. The "Pages consultées" and "Temps passé" cards are wrong.
**Expected**: Card 3 = "Démos actives" (value: 19, subtitle "11 clients · 5 internes · 3 tests", purple icon). Card 4 = "Sessions ce mois" (value: 156, change "+31% vs mois dernier", amber icon, inline metrics: pages consultées + temps moyen).
**Fix**: Replace the 3rd and 4th stat cards with "Démos actives" and "Sessions ce mois" as per mockup. Move "pages consultées" and "temps moyen" as inline sub-metrics inside the Sessions card.

---

## DASHBOARD — MEDIUM

**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Missing breadcrumb navigation. Mockup shows "Accueil > Vue d'ensemble" breadcrumb in the header bar.
**Expected**: Breadcrumb trail "Accueil > Vue d'ensemble" next to "Dashboard" title in the topbar.
**Fix**: Add breadcrumb component to the dashboard header area.

---

## DASHBOARD — MEDIUM

**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: The activity table shows "Voir tout ↗" link next to the title, but the mockup doesn't have this external link. Also, the mockup table has 10 rows of real-looking data with diverse companies (Acme Corp, BNP Paribas, Société Générale, etc.) and richer action types (Session démarrée, Guide terminé, Page consultée, Guide démarré, Lien partagé, Session interrompue). Current app shows only 4 rows all from "Salesforce CRM".
**Expected**: Activity table with more diverse sample data (different projects and tools), more action types, and no "Voir tout ↗" external link (just inline pagination).
**Fix**: Remove "Voir tout ↗" link. Enrich seed data to include more diverse activity entries across multiple projects/tools.

---

## DASHBOARD — LOW

**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Mockup shows a toast notification at bottom-right ("Capture terminée — 18 pages synchronisées avec succès") with auto-dismiss. Not present in current app, but this is a toast that only appears contextually, so it's non-blocking.
**Expected**: Toast notification system ready for contextual messages.
**Fix**: Ensure toast notification component works when triggered by actions. Low priority as this is event-driven.

---

## DASHBOARD (COLLAPSED) — OK

The collapsed sidebar view (screenshot 05) looks correct — icons only, 48px width, content area expands properly. The collapsed state matches the mockup design.

---

## PROJECTS LIST — MEDIUM

**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: The project cards show "Actif" badge in green, but the mockup design system uses a more subtle badge. Also, the page subtitle reads "Gérez vos environnements simulés" but should read something consistent with "Environnements de Démonstration" branding.
**Expected**: Consistent branding across the app.
**Fix**: Update subtitle to match new branding if login page title changes. Minor — keep current wording if branding stays as-is.

---

## PROJECT DETAIL — MEDIUM

**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: The project detail page has no matching mockup (maquette-project-detail has no retours/ folder and likely has no final approved version). The current implementation looks reasonable with health ring, version list, tabs for Versions/Assignations/Demandes MAJ/Configuration, and action buttons (Ouvrir démo, Arborescence, Dupliquer).
**Expected**: No specific mockup to compare against. Current implementation appears functional.
**Fix**: None required — no approved mockup exists. Page looks reasonable.

---

## TREE VIEW — HIGH

**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The tree view is missing the right detail panel. The mockup shows a two-panel layout: left panel with tree structure, right panel with page preview (browser mockup showing rendered page, sub-tabs for Aperçu/Éditeur HTML/Liens & Navigation/JavaScript, action buttons Comparer/Recapturer). Current app shows the tree on the left with a placeholder "Sélectionnez une page" on the right but no actual detail/preview panel.
**Expected**: When a page is selected in the tree, the right panel should show a browser frame preview of the page with sub-tabs and action buttons.
**Fix**: Implement the right detail panel with page preview, sub-tabs, and action buttons as per mockup. Include breadcrumb at bottom of tree panel showing navigation path.

---

## TREE VIEW — HIGH

**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The tree structure doesn't show page counts per section, expand/collapse state indicators (chevrons), or modal badges. Mockup shows grouped sections (Accueil (8), Contacts (14), Opportunités (18), etc.) with colored section icons, status dots (green/amber/red) per page, and "Modale" badges for modal pages.
**Expected**: Sections with page counts, colored group icons, individual page status dots, modal badges, and "...et X autres pages" for truncated sections.
**Fix**: Enhance the tree structure to show grouped sections with counts, colored icons, status dots, and modal indicators as per mockup.

---

## TREE VIEW — MEDIUM

**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The resizable panel divider between tree and detail area is not visible. Mockup includes a `.resize-handle` for drag-to-resize functionality.
**Expected**: Draggable resize handle between the tree panel and the detail panel.
**Fix**: Add a resize handle between the two panels that allows users to drag and resize.

---

## TREE VIEW — LOW

**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: The bottom bar shows "Salesforce CRM — Salesforce" and "Lightning v2024.1 Active 8 pages" which is correct, but the mockup shows a breadcrumb trail (Accueil / Contacts / Fiche client) based on the selected page. Current bar shows version navigation arrows but not the selected page breadcrumb.
**Expected**: Bottom bar should show breadcrumb trail of the currently selected page within the tree hierarchy.
**Fix**: Update the bottom bar to display the selected page's breadcrumb path.

---

## ANALYTICS — HIGH

**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The stats cards show "Sessions totales: 4", "Utilisateurs uniques: 3", "Temps moyen/session: 11h 50m". The mockup shows much larger numbers (84 sessions, 31 users, 8m 42s) indicating the current seed data is unrealistically sparse. More importantly, the "Utilisateurs uniques" card is missing the "18 clients · 13 admins & commerciaux" breakdown shown in the mockup.
**Expected**: Stats cards with breakdown subtitles. "Utilisateurs uniques" should show the split between clients and admins/commerciaux. All cards should show sparkline mini-charts.
**Fix**: Add breakdown text to the "Utilisateurs uniques" card. Add sparkline charts to all stat cards. Enrich seed data with more sessions/events.

---

## ANALYTICS — HIGH

**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The two tables (Admins & Commerciaux / Clients) are missing critical columns. The mockup shows columns: Utilisateur, Rôle/Entreprise, Outil, Durée, Pages, **Visites uniques**, Date. Current app tables show only user name, email, duration, and date — missing the "Visites uniques" column (which replaced "score" per feedback R001), the "Outil" column with colored tool dots, and the "Pages" column.
**Expected**: Tables with full column set: Utilisateur, Rôle (admins) or Entreprise (clients), Outil (with colored dot), Durée, Pages, Visites uniques (with inline progress bar), Date.
**Fix**: Add missing columns to both analytics tables. The "Visites uniques" column should include an inline progress bar (high/mid/low fill). Add "Outil" column with colored tool indicators.

---

## ANALYTICS — MEDIUM

**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The "Sessions par jour" chart at the bottom is empty (no data bars visible in the chart area). The mockup shows a stacked bar chart with period selector (7j, 14j, 30j) and legend (Clients vs Admins & Commerciaux).
**Expected**: Stacked bar chart with visible data, period selector tabs, and dual-color legend.
**Fix**: Ensure the chart renders with seed data. Add period selector tabs (7j/14j/30j). Render stacked bars in two colors.

---

## ANALYTICS — LOW

**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: The "CSV" export button is per-table (shown next to each table title). Mockup confirms this design is correct, but the current buttons use a download icon + "CSV" text while mockup uses just icon + "CSV".
**Expected**: Minor styling match.
**Fix**: Verify CSV export button styling matches mockup exactly.

---

## INVITATIONS — HIGH

**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The invitation list table is missing several columns. Current app shows only CLIENT, EMAIL, PROJET/DÉMO, STATUT. The mockup shows CLIENT (name + company), Email, Projet/Démo, Statut, **Envoyé le** (sent date), and **Actions** (3 icon buttons: Renvoyer, Copier le lien, Révoquer).
**Expected**: Full table with sent date column and row action buttons.
**Fix**: Add "Envoyé le" column and per-row action buttons (Renvoyer, Copier le lien, Révoquer).

---

## INVITATIONS — MEDIUM

**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The right panel "Générer un accès" form is missing the "Entreprise" field dropdown with quick-create option. Mockup shows: Nom, **Entreprise** (with "Créer une entreprise" button), Email, Projet, Version, Expiration. Current form shows: Nom, Email, Entreprise (optionnel), Projet, Version, Expiration.
**Expected**: Entreprise field should be a proper dropdown selector with existing companies listed, plus a "Créer une entreprise" quick-create button. Not just a freeform text input.
**Fix**: Replace the freeform "Entreprise" text input with a dropdown selector that lists existing companies from the database, with a quick-create option.

---

## INVITATIONS — MEDIUM

**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The "Partager un lien" tab in the right panel is present and shows correct fields, but the generated link result section is missing. Mockup shows a blue info banner: "Ce lien est lié à [Company] — Toute personne utilisant ce lien sera automatiquement associée à cette entreprise. Expire le..."
**Expected**: After generating a link, show the shareable URL with copy button and an info banner about the link's association with the company.
**Fix**: Add the link result section with copy functionality and info banner.

---

## INVITATIONS — LOW

**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: The "Exiger la création d'un compte" checkbox is present in the current app (good — this addresses the unresolved feedback R005). However, the mockup v3 doesn't include it yet. Since the feedback explicitly requested it, this is actually a CORRECT addition that the app has ahead of the mockup. No issue.
**Expected**: Checkbox should be present (matches unresolved feedback).
**Fix**: None — this is correctly implemented.

---

## USERS — OK

**File**: `frontend/src/routes/admin/users/+page.svelte`
The users page looks well-implemented: correct tabs (Tous/Admins/Clients), user list with avatars, role badges (Administrateur/Client), auth method indicators (Google SSO), dates, action menus. No specific mockup exists for this page, but the implementation follows the design system correctly. No major issues.

---

## OBFUSCATION — HIGH

**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The obfuscation page still shows a "PORTÉE" (Scope) column in the rules table. Per feedback R001, scope should always be global and the scope column should be removed.
**Expected**: No "PORTÉE" column in the rules table. All rules are always global.
**Fix**: Remove the "PORTÉE" column from the obfuscation rules table. Remove scope selection from the add-rule form.

---

## OBFUSCATION — MEDIUM

**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The preview panel on the right shows "Aperçu en direct" with Avant/Après toggle and HTML source view. This matches the mockup. However, the mockup also shows a "Couverture d'obfuscation" percentage bar (87%) and animated stats (rules count, occurrences found, affected pages) below the preview. Current app has some of these elements but the coverage bar seems less prominent.
**Expected**: Clear coverage percentage bar + 3 animated stat counters below the preview panel.
**Fix**: Verify the coverage bar and stat counters match the mockup styling precisely.

---

## OBFUSCATION — LOW

**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: The "Masquage dans l'éditeur" section at the bottom-left panel exists but may not match the mockup's purple-themed styling with "Ouvrir l'éditeur visuel" button.
**Expected**: Purple-themed section with eye icon, description, and outlined purple "Ouvrir l'éditeur visuel" button.
**Fix**: Verify styling matches mockup. Minor polish.

---

## UPDATE REQUESTS — OK

**File**: `frontend/src/routes/admin/update-requests/+page.svelte`
The update requests page looks well-implemented with 3 stat cards (En attente, En cours, Terminées), tabs for filtering, search, and request cards with status badges, descriptions, metadata, and action buttons (Prendre en charge, Marquer terminée). No specific mockup exists, but follows the design system. Looks good.

---

## COMMAND PALETTE — HIGH

**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The command palette shows category filter tabs (Tous, Pages, Projets, Démos, Utilisateurs, Captures) but the mockup (v5) does NOT have category filter tabs. The mockup shows results organized into grouped sections (PAGES, PROJETS, UTILISATEURS) with count badges, and no tab navigation. Also, the mockup shows an "ACTIONS" section at the top (Créer un projet, Nouvelle capture, etc.) which the current app has as well — but the current app puts them under "ACTIONS" while the mockup puts the "Créer un projet" item as the first highlighted result in the PAGES section.
**Expected**: No category filter tabs. Results should be organized in grouped sections (PAGES with count, PROJETS with count, UTILISATEURS with count). The search label was renamed to "Résultats de recherche" per feedback.
**Fix**: Remove the category filter tabs (Tous, Pages, Projets, etc.). Show results as grouped sections with count badges. Keep keyboard shortcuts at the bottom if desired, but the mockup v5 doesn't include them.

---

## COMMAND PALETTE — MEDIUM

**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: The search placeholder says "Recherche admin — pages, projets, utilisateurs..." while the mockup says "Rechercher une page, un projet, une action...". Minor text difference.
**Expected**: Placeholder: "Rechercher une page, un projet, une action..."
**Fix**: Update placeholder text.

---

## EDITOR — CRITICAL

**File**: `frontend/src/routes/admin/editor/[id]/+page.svelte`
**Issue**: The editor page screenshot (#15) shows the Dashboard page (identical to screenshot #04) instead of the actual page editor. It appears the editor route is not rendering the editor UI at all — it's falling through to the dashboard. This means the entire page editor feature is non-functional.
**Expected**: Three-panel layout: left sidebar with page list (280px), center code editor with dark theme and syntax highlighting, right mini-map panel. Top tabs for Éditeur HTML / Liens & Navigation / JavaScript. Bottom status bar with line/column info and save buttons.
**Fix**: Debug the editor route to ensure it renders the editor component instead of the dashboard. Implement the full editor UI with code editor, page list sidebar, tabs, and link mapping panel.

---

## DEMO VIEWER (COMMERCIAL) — CRITICAL

**File**: `frontend/src/routes/demo/[...path]/+page.svelte`
**Issue**: The commercial demo viewer shows "Page introuvable — La démo demandée n'existe pas ou n'est pas disponible." This means the demo serving is broken — no demo content renders at all. The toolbar is visible (Projet selector, Accueil selector, stats, Partager le lien, Copier l'URL, Ouvrir en tant que client, Paramètres) but the main content area is empty.
**Expected**: Full-screen Salesforce demo page with dark header toolbar at top. The commercial viewer should use a minimalist "LL" tongue tab that expands into a floating dark card with action grid (Partager, Copier l'URL, Vue client, Paramètres, online users count, Rechercher).
**Fix**: 1) Fix the demo content serving so actual captured HTML pages render in the iframe/content area. 2) Redesign the toolbar to match the mockup: replace the current horizontal toolbar with a collapsible dark floating card triggered by an "LL" tongue tab at the top center.

---

## DEMO VIEWER (COMMERCIAL) — HIGH

**File**: `frontend/src/routes/demo/[...path]/+page.svelte`
**Issue**: Even if the "Page introuvable" issue is fixed, the commercial viewer toolbar design doesn't match the mockup at all. The current app uses a two-row fixed toolbar (dark header + gray action bar) while the mockup uses a minimalist collapsible "LL" tab that drops down into a floating glass-morphism card.
**Expected**: No fixed toolbars. A small "LL" tongue tab at top-center that expands on click into a 600px dark card with search, action grid (6 tiles), and settings panel. The demo content should fill the entire viewport.
**Fix**: Complete redesign of the commercial viewer toolbar. Replace fixed toolbars with the floating LL card design from the mockup.

---

## DEMO VIEWER (PROSPECT/CLIENT) — CRITICAL

**File**: `frontend/src/routes/view/[...path]/+page.svelte`
**Issue**: The prospect demo viewer shows a raw "404 - Page non trouvée" error with unstyled text: "Project with subdomain 'test' not found". This is completely broken — no UI, no styling, just a raw error message. There's an "LL" orange badge at bottom-right which is correct per mockup.
**Expected**: Full-screen immersive Salesforce demo page (no sidebar, no admin controls). Minimal overlay toolbar at top-right (nearly invisible, fades in on hover) with Guides, Fullscreen, Info buttons. Gold "LL" badge at bottom-right.
**Fix**: 1) Fix the routing/demo-serving so actual demo content loads for prospect viewers. 2) Add the hover overlay toolbar at top-right. 3) Ensure the page renders captured HTML content full-screen without any platform chrome.

---

## SIDEBAR — MEDIUM

**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The sidebar width is 220px expanded per CLAUDE.md, but the mockup uses 260px. Also, the mockup sidebar header shows "Lemon Learning" as subtitle below "Env. Simulés", and the user role at bottom shows "Administratrice" (feminine) while current app shows "Administrateur".
**Expected**: Sidebar width ~260px. Role text should be gender-aware or use "Administratrice" for Marie Laurent.
**Fix**: Consider adjusting sidebar width to 260px. Update role display to "Administratrice" for the current seed user.

---

## SIDEBAR — LOW

**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: The simulated tools section in the sidebar shows page counts (Salesforce 8, SAP SuccessFactors, Workday) but the mockup shows much larger numbers (128, 74, 52, 38, 24, 16) and 6 tools listed (Salesforce, SAP SuccessFactors, Workday, ServiceNow, HubSpot, Zendesk). Current app has only 3 tools visible.
**Expected**: All 6+ tools listed with page counts per tool.
**Fix**: Enrich seed data to include more tools with page counts. This is mostly a data issue, not a UI issue.

---

## HEADER — LOW

**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: The notification bell icon in the header shows a red dot indicator. The mockup also shows this, confirming it's correct. However, the mockup's help icon is a question mark in a circle, and the extension button uses "↓ Extension" with a download icon. These seem to match. Minor: the search bar placeholder text should be "Rechercher une page, un projet, une action..." per the search/command palette mockup, but currently shows "Rechercher pages, projets, utilisateurs...".
**Expected**: Search placeholder matches command palette.
**Fix**: Update search bar placeholder to match mockup wording.

---

## GENERAL — LOW

**File**: Multiple files
**Issue**: The mockup consistently uses breadcrumbs ("Accueil > Vue d'ensemble", "Accueil > Gestion des invitations") in the topbar next to page titles. The current app doesn't show breadcrumbs on any page except the tree view bottom bar.
**Expected**: Breadcrumb navigation on all admin pages.
**Fix**: Add a breadcrumb component to the admin layout that renders contextual breadcrumbs based on the current route.

---

## UNRESOLVED MOCKUP FEEDBACK (tracked)

These are 4 items from mockup feedback that remain unresolved:

### Login R006 — MEDIUM
**Issue**: An element at coordinates (782,590)-(1151,588) needs to be deleted from the login page. This appears to reference a UI element in the mockup that should not be in the final implementation. Since the current app's login is already different from the mockup, this will be addressed when the login page is redesigned.
**Fix**: Address during login page redesign.

### Login R007 — MEDIUM (partially addressed)
**Issue**: Add "(admin uniquement)" in gray text near Google SSO button.
**Current**: The admin tab in the current app shows "(admin uniquement)" below the Google button. However, since the login needs to be redesigned (no tabs), this needs to persist in the new unified layout.
**Fix**: Keep "(admin uniquement)" gray text below Google SSO button in the redesigned unified login form.

### Analytics R005 — MEDIUM
**Issue**: Handle cases where only company name is known (link sharing without person data). When a prospect accesses via shared link without creating an account, only the company is known.
**Current**: The analytics table shows "Visiteur anonyme / Lien partagé" which partially addresses this. Needs verification that company name is displayed when available.
**Fix**: Ensure the Clients table shows company name even when person name is unknown. Show "Visiteur anonyme" with company name below if available.

### Invitations R005 — ADDRESSED
**Issue**: Add option to require account creation.
**Current**: The "Exiger la création d'un compte" checkbox is already present in the current app. This is resolved.
**Fix**: None needed.

---

TOTAL_ISSUES: 37
CRITICAL: 3
HIGH: 12
MEDIUM: 14
LOW: 8
