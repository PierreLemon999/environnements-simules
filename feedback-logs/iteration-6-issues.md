# Iteration 6 — UI/UX Quality Audit

**Date**: 2026-02-26
**Compared**: Current app screenshots vs. reference mockups (latest retours versions)

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 7     |
| HIGH     | 22    |
| MEDIUM   | 30    |
| LOW      | 26    |
| **TOTAL** | **85** |

---

# LOGIN PAGE

## Login — CRITICAL
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: App uses tab-based dual mode (Client/Admin tabs) while mockup uses a single unified layout with all elements visible at once
**Expected**: Single card with NO tabs: brand/logo at top, "IDENTIFIANTS" section label, email/password form, "ou se connecter avec" divider, Google SSO button — all visible simultaneously
**Fix**: Remove the tab system entirely. Replace with single-view layout showing: (1) email/password form, (2) "ou se connecter avec" divider, (3) Google SSO button — all in one continuous flow within a single card

## Login — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Brand section is outside the card in the app but inside the card in the mockup
**Expected**: Brand section (logo + title + subtitle) is INSIDE the `.login-card`, as the first element with 44px top padding
**Fix**: Move the brand section inside the card, before the form content

## Login — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Brand title text is wrong — "Environnements Simulés" instead of "Environnements de Démonstration"
**Expected**: "Environnements de Démonstration" (per R004 feedback, resolved)
**Fix**: Change the `<h1>` text and `<svelte:head>` title. Also change logo from "ES" to "ED"

## Login — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Missing "Se souvenir de moi" checkbox and "Mot de passe oublié ?" link
**Expected**: Row between password field and submit button with checkbox on left, forgot password link on right
**Fix**: Add a flex row with checkbox label and blue link

## Login — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Missing "ou se connecter avec" divider between form and Google SSO
**Expected**: Horizontal divider with centered text "ou se connecter avec" between two lines
**Fix**: Add divider element after removing tabs (part of unified layout restructure)

## Login — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Missing "(admin uniquement)" hint below Google SSO button in unified layout
**Expected**: R007 feedback (unresolved): gray "(admin uniquement)" text below the Google SSO button
**Fix**: Ensure "(admin uniquement)" text appears below Google SSO in the unified layout, styled in muted gray (12px)

## Login — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Missing "IDENTIFIANTS" section label with lock icon above email field
**Expected**: 11px uppercase label with lock icon, font-weight 600, letter-spacing 0.5px, muted color
**Fix**: Add section label element above the email input

## Login — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Subtitle text differs — "Plateforme de démonstrations Lemon Learning" vs just "Lemon Learning"
**Expected**: Just "Lemon Learning" as subtitle
**Fix**: Simplify subtitle text

## Login — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Email label says "Email" instead of "Adresse e-mail"
**Expected**: "Adresse e-mail"
**Fix**: Change label text

## Login — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Google button text says "Continuer avec Google" instead of "Se connecter avec Google"
**Expected**: "Se connecter avec Google"
**Fix**: Change button text

## Login — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Missing hint text below submit button — "Accès pour les équipes et les clients avec leurs identifiants"
**Expected**: Small info hint with info-circle icon, 12px, centered, muted color
**Fix**: Add hint paragraph after submit button

## Login — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Card padding structure differs (0 + per-section vs unified 44px 40px 40px)
**Expected**: `padding: 44px 40px 40px` on the card
**Fix**: Apply unified padding after restructuring

## Login — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Brand title font weight 600/20px instead of 700/21px
**Expected**: font-weight 700, font-size 21px
**Fix**: Adjust CSS

---

# DASHBOARD

## Dashboard — CRITICAL
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Stats grid has 3 columns instead of 4 — missing "Sessions ce mois" card
**Expected**: 4 stat cards: "Projets actifs", "Pages capturées", "Démos actives", "Sessions ce mois"
**Fix**: Change grid to `grid-cols-4`. Add 4th stat card with session count, inline metrics (pages consulted, average time)

## Dashboard — HIGH
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: Header shows search bar that mockup doesn't have (removed in R004 feedback)
**Expected**: No search bar — only notification bell, help icon, "Extension" button
**Fix**: Remove the search bar from Header. Command palette still triggered by Cmd+K without visible bar

## Dashboard — HIGH
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: "Nouveau projet" button on dashboard — removed per R003 feedback
**Expected**: No "Nouveau projet" button on the dashboard (only on /admin/projects page)
**Fix**: Remove the button from the dashboard page

## Dashboard — HIGH
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: Missing bold page title in header — mockup shows "Dashboard" (18px/700) before breadcrumb
**Expected**: Bold page title inline with breadcrumb
**Fix**: Add page title to Header component

## Dashboard — HIGH
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: 3rd stat card content wrong — shows "Sessions actives" instead of "Démos actives"
**Expected**: "Démos actives" with eye icon (purple), value 19, sub-text "11 clients · 5 internes · 3 tests"
**Fix**: Change 3rd card content and icon

## Dashboard — HIGH
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Activity bar chart (14 days) present in app but absent from mockup
**Expected**: No activity bar chart between stats and activity journal
**Fix**: Remove the activity bar chart section entirely

## Dashboard — HIGH
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Activity table columns differ significantly from mockup
**Expected**: Columns: Checkbox | Client (company) | Projet/Demo (name + tool badge) | Action (styled badge) | Date (relative) | Row actions (eye + dots on hover)
**Fix**: Restructure table: add checkbox column, use company name for client, combine projet/demo, use relative dates, add hover row actions, remove "Pages consultées" and "Temps passé" columns

## Dashboard — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Activity tabs positioned below title instead of inline-right with title
**Expected**: Tabs in same row as "Journal d'activité des clients" title, right-aligned, active tab uses dark pill style
**Fix**: Move tabs inline with title, style active tab with dark background + white text

## Dashboard — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Missing table toolbar (search + filters + export)
**Expected**: Search input "Filtrer les activités...", "Filtres" button, "Tous les clients" filter, "Exporter" button
**Fix**: Add toolbar section between tabs and table headers

## Dashboard — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Missing table row checkboxes
**Expected**: Checkbox column on each row + select-all in header
**Fix**: Add checkbox column

## Dashboard — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: No pagination footer on activity table
**Expected**: "Affichage de 10 activités sur 24" + page buttons (prev, 1, 2, 3, next)
**Fix**: Add pagination controls, paginate to 10 per page

## Dashboard — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Stat card styling differs — padding 12px vs 14px, radius 8px vs 10px, label 12px vs 13px, value 20px vs 22px, change indicator is text not pill
**Expected**: padding 14px, border-radius 10px, label 13px/500, value 22px/700, change as pill badge
**Fix**: Adjust stat card CSS to match mockup dimensions

## Dashboard — MEDIUM
**File**: `frontend/src/routes/admin/+page.svelte`
**Issue**: Action badge styles differ — fewer types and different styling from mockup
**Expected**: Colored pill badges with dot prefix: "Session démarrée" (blue), "Guide terminé" (green), "Page consultée" (blue), "Guide démarré" (amber), "Lien partagé" (purple), "Session interrompue" (gray)
**Fix**: Implement full range of action badge styles with dot indicators

## Dashboard — MEDIUM
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Collapsed sidebar clips section label text ("PRINCIPA", "GESTION" partially visible)
**Expected**: Section labels completely hidden when collapsed
**Fix**: Ensure `overflow: hidden` works properly with collapsed width

## Dashboard — MEDIUM
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Collapsed sidebar clips/overlaps badge circles
**Expected**: Badges hidden or shown as small dot indicators when collapsed
**Fix**: Hide badges or position as dot overlays when collapsed

## Dashboard — LOW
**File**: `frontend/src/lib/components/layout/Header.svelte`
**Issue**: Missing red notification dot on bell icon
**Expected**: Small 6px red dot with pulse animation on bell icon
**Fix**: Add notification indicator dot

## Dashboard — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Sidebar collapse button is a full-width bottom bar instead of floating circular button
**Expected**: 24px white circle at right edge of sidebar, appears on hover only
**Fix**: Replace collapse bar with floating circular button

## Dashboard — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Section label font 10px vs mockup's 11px, letter-spacing differs
**Expected**: 11px, letter-spacing 0.6px
**Fix**: Adjust font size and spacing

## Dashboard — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Nav item font 14px/6px-8px vs mockup's 13px/7px-12px
**Expected**: font-size 13px, padding 7px 12px, gap 10px
**Fix**: Adjust sizing

## Dashboard — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Active state left border is full-height instead of 16px centered indicator
**Expected**: `::before` pseudo-element 3px x 16px, centered vertically, rounded right corners
**Fix**: Replace border-left with pseudo-element

## Dashboard — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: User section shows LogOut icon instead of dropdown chevron
**Expected**: Down-arrow chevron opening a dropdown menu
**Fix**: Replace LogOut button with chevron dropdown

## Dashboard — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Tool count numbers clipped in collapsed state
**Expected**: Only colored dot visible when collapsed, no text
**Fix**: Verify conditional rendering hides text properly

---

# SIDEBAR (Global)

## Sidebar — MEDIUM
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: Sidebar expanded width 220px vs mockup's 260px; collapsed 48px vs 56px
**Expected**: 260px expanded, 56px collapsed
**Fix**: Update CSS variables

## Sidebar — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: "Composants" nav item exists in sidebar but not in design spec or mockups
**Expected**: GESTION section: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres (no "Composants")
**Fix**: Remove "Composants" nav item or verify if intentionally added

## Sidebar — LOW
**File**: `frontend/src/lib/components/layout/Sidebar.svelte`
**Issue**: OUTILS SIMULÉS shows "0" badge count for inactive projects
**Expected**: Hide badge when count is 0
**Fix**: Conditionally hide count badge when value is 0

---

# PROJECTS LIST

## Projects — HIGH
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: Every project card shows hardcoded "Actif" badge regardless of actual status
**Expected**: Status derived from version data — "Actif" (green), "Test" (amber), "Vide" (gray)
**Fix**: Derive status from versions data instead of hardcoding

## Projects — MEDIUM
**File**: `frontend/src/routes/admin/projects/+page.svelte`
**Issue**: Filter tabs ("Tous", "Actifs", "Test", "Archivés") are non-functional (placeholder comment in code)
**Expected**: Tabs should filter the project list by status
**Fix**: Implement filtering logic or remove tabs until functional

---

# PROJECT DETAIL

## Project Detail — CRITICAL
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Versions displayed as flat table instead of rich version cards with colored borders, diff badges, action buttons, and changelog
**Expected**: Individual version cards with: colored left border (green/amber/gray by status), version name bold 15px, status pill badge, author avatar, date, page count monospace, language tag, diff badges (+4 pages, ~12 modif.), action buttons (Ouvrir démo, Arborescence, Dupliquer), kebab menu, collapsible changelog
**Fix**: Replace table-based version list with individual version card components

## Project Detail — HIGH
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Missing project logo/icon with branded gradient background
**Expected**: 48x48px logo with tool-colored gradient, displaying tool initials (e.g., "SF" for Salesforce)
**Fix**: Add project logo element using `getToolColor()` function

## Project Detail — HIGH
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Missing project health/progress ring visualization (72x72px circular SVG gauge)
**Expected**: "86% santé" progress ring in top-right of header card, with health indicators (green OK, amber warnings, red errors)
**Fix**: Implement progress ring component with health data

## Project Detail — HIGH
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Missing project statistics row
**Expected**: Stats row: "86 pages | 3 versions | 5 démos actives | 12 guides" with icons and bold values
**Fix**: Add stats row below description

## Project Detail — HIGH
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Tab style mismatch — shadcn underline tabs vs mockup's segmented control with dark active fill
**Expected**: White card container with border, active tab dark fill + white text, count badges as pills
**Fix**: Override shadcn Tabs styling to match segmented control design

## Project Detail — HIGH
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Assignments tab is minimal — missing rich columns (engagement bar, demo link, status pills, last access)
**Expected**: Rich columns: Client (avatar + contact), Version, Lien (copyable URL), Engagement (bar + %), Dernier accès, Expire le, Statut (colored pill)
**Fix**: Enhance assignments tab with full column set

## Project Detail — MEDIUM
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Missing tool badge next to project name
**Expected**: Colored pill badge (e.g., blue "Salesforce") next to project name
**Fix**: Add tool badge pill

## Project Detail — MEDIUM
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Missing project creator/last updated footer in header card
**Expected**: Creator avatar ("ML") + "Créé par Marie Laurent · 15 jan 2026 · Dernière MAJ il y a 2h"
**Fix**: Add footer section with creator info

## Project Detail — MEDIUM
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Project header is not wrapped in a Card component
**Expected**: White card with border, border-radius 12px, padding 24px, hover shadow
**Fix**: Wrap header in `<Card>` component

## Project Detail — MEDIUM
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Missing "Afficher les versions dépréciées" toggle
**Expected**: Checkbox below version cards to show/hide deprecated versions (reduced opacity 0.65)
**Fix**: Add toggle with filtering logic

## Project Detail — MEDIUM
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Missing "Demandes MAJ" tab (4th tab)
**Expected**: 4 tabs: Versions, Assignations, Configuration, Demandes MAJ (with count badge)
**Fix**: Add 4th tab

## Project Detail — MEDIUM
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Configuration tab shows read-only field list instead of 2x2 grid of editable config cards
**Expected**: 4 themed cards: "Domaine & Accès", "Obfuscation", "Capture", "Général" with toggles, inputs, selects
**Fix**: Redesign Configuration tab with interactive config cards

## Project Detail — LOW
**File**: `frontend/src/routes/admin/projects/[id]/+page.svelte`
**Issue**: Subdomain displayed as plain text instead of copyable monospace chip
**Expected**: Monospace chip with copy icon and clipboard functionality
**Fix**: Style subdomain as copyable chip

---

# TREE VIEW

## Tree — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Missing health status summary bar with colored indicators
**Expected**: "79 OK" (green), "4 Avert." (orange), "3 Erreur" (red) with colored dots and proportional progress bar
**Fix**: Replace plain text stats with colored health summary

## Tree — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Missing breadcrumb navigation spanning content area (currently inside detail panel only)
**Expected**: Breadcrumb like "Salesforce > Home > Dashboard principal" spanning top of content area
**Fix**: Reposition breadcrumb above detail panel

## Tree — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Extra "Éditeur HTML" button — should be editing sub-tabs per R003 feedback
**Expected**: Only "Édition en direct", "Obfuscation", "Ouvrir démo" as action buttons; editing modes as sub-tabs
**Fix**: Remove standalone button, add sub-tabs for editing modes

## Tree — HIGH
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Missing page preview/thumbnail panel at top of detail panel
**Expected**: Preview area showing "Aperçu — 1300x800" with thumbnail image or gray placeholder
**Fix**: Add thumbnail component using page's `thumbnailPath` field

## Tree — MEDIUM
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Tab labels don't match mockup — "Arborescence"/"Liste" vs "Par site"/"Par guide"
**Expected**: "Par site" and "Par guide" tabs
**Fix**: Rename tabs

## Tree — MEDIUM
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Missing "Modale" badge styling for modal pages
**Expected**: Orange/yellow badge with window-overlay icon for modal pages
**Fix**: Style modal badge with colored background and appropriate icon

## Tree — MEDIUM
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Version selector format differs — no navigation arrows, no status badge
**Expected**: Version display with left/right arrows, green "À jour" badge, page count
**Fix**: Replace `<select>` with styled version navigator

## Tree — MEDIUM
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Tree panel not resizable (per R002 feedback: "possibilité d'agrandir ce volet")
**Expected**: Drag handle on right border for resizing
**Fix**: Add resize handle with drag functionality

## Tree — MEDIUM
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Missing obfuscation indicators (blue bars) next to pages with active rules
**Expected**: Small colored bars/badges next to pages that have obfuscation rules applied
**Fix**: Add obfuscation indicator based on page data

## Tree — LOW
**File**: `frontend/src/routes/admin/tree/+page.svelte`
**Issue**: Missing "Liens cassés" metadata field in detail panel
**Expected**: "Liens cassés" row with count value
**Fix**: Add metadata row

---

# ANALYTICS

## Analytics — CRITICAL
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: Sessions split into two side-by-side cards (Admins/Clients) instead of single unified table
**Expected**: Single "Sessions récentes — 84 sessions" section with one search bar and one "Exporter CSV" button
**Fix**: Replace two-card split layout with single unified sessions table

## Analytics — HIGH
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: 4 separate stat cards instead of single prominent sessions card with embedded area chart
**Expected**: One "Sessions totales" card with trend indicator and wide area chart (blue gradient fill)
**Fix**: Consolidate to single prominent sessions card with area chart

## Analytics — HIGH
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: Bar chart instead of area chart for sessions visualization
**Expected**: Smooth filled area chart with blue gradient fill under line
**Fix**: Replace bar chart with SVG area chart (sparklinePath function exists but unused)

## Analytics — MEDIUM
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: Engagement score uses progress bar instead of circular gauge in session detail
**Expected**: Circular ring with score number inside (e.g., "92" in green ring)
**Fix**: Restyle as circular gauge

## Analytics — MEDIUM
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: Anonymous visitor handling — R005 unresolved: company name from link sharing not shown
**Expected**: When only company name known (link sharing), display company name instead of "Visiteur anonyme"
**Fix**: Check demo assignment metadata for company info before falling back to "Visiteur anonyme"

## Analytics — LOW
**File**: `frontend/src/routes/admin/analytics/+page.svelte`
**Issue**: Date range picker and project filter order differ from mockup
**Expected**: Order: "En direct", then "Tous les projets" (with funnel icon), then date range
**Fix**: Reorder filter elements

---

# INVITATIONS

## Invitations — CRITICAL
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: Single-column layout with modal dialog instead of two-column layout with persistent form card
**Expected**: Two-column `grid-template-columns: 1.5fr 1fr`: left = table with toolbar, right = persistent "Générer un accès" form
**Fix**: Replace Dialog-based creation with persistent right-column form card in two-column grid

## Invitations — CRITICAL
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: Missing "Partager un lien" tab for link sharing
**Expected**: Tabbed form with two modes: "Invitation par email" and "Partager un lien" (company, project, expiration, optional password, link generation)
**Fix**: Add tabbed interface in right column form card with link sharing functionality

## Invitations — HIGH
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: Missing 3rd stat card ("Connexions") and wrong labels on existing cards
**Expected**: Three cards: "Invitations envoyées" (+X cette semaine), "Liens actifs" (link icon, X expirés), "Connexions" (bar chart icon, +X cette semaine)
**Fix**: Add 3rd card, rename "Clients actifs" to "Liens actifs", fix sub-labels

## Invitations — HIGH
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: Table missing search toolbar, filters, sorting, and pagination
**Expected**: Search "Rechercher un client...", Statut filter, Projets filter, Exporter button, sortable headers, pagination footer
**Fix**: Add complete table toolbar and pagination

## Invitations — HIGH
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: Table columns differ — missing company, wrong column names, actions always visible
**Expected**: Client (avatar + name + company), Email, Projet/Demo, Statut (dot badges: Connecté/En attente/Lien ouvert/Expiré), Envoyé le, hover actions (Renvoyer, Copier, Révoquer)
**Fix**: Restructure table columns to match mockup

## Invitations — MEDIUM
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: Status badge styles differ — solid badges vs dot-prefix pill badges
**Expected**: Rounded pill badges with colored dot, colored background and border
**Fix**: Replace Badge usage with custom dot-prefix pill badges

## Invitations — MEDIUM
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: Credentials display format — dialog vs inline block with email template
**Expected**: Inline block in form card with "Bloc à insérer dans votre mail" dashed-border template + copy button
**Fix**: Replace dialog with inline credentials block

## Invitations — LOW
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: CTA button says "Nouvelle invitation" instead of "Nouvel accès"
**Expected**: "+ Nouvel accès"
**Fix**: Change button text

## Invitations — LOW
**File**: `frontend/src/routes/admin/invitations/+page.svelte`
**Issue**: Missing row hover effects (blue left border, avatar scale, action visibility transition)
**Expected**: Left blue border on hover, avatar scale-up, actions appear on hover with opacity transition
**Fix**: Add hover pseudo-elements and transitions

---

# OBFUSCATION

## Obfuscation — CRITICAL
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: Single-column layout with dialog preview instead of two-column layout with persistent live preview panel
**Expected**: Two-column `grid: 1fr 440px`: left = rules table, right = sticky preview card with before/after toggle, mini Salesforce preview, stats (rules applied, fields masked, coverage %)
**Fix**: Implement two-column layout with always-visible right preview panel

## Obfuscation — HIGH
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: "Appliquer globalement" toggle still present — explicitly removed per R001 feedback
**Expected**: No global toggle — obfuscation is always applied globally
**Fix**: Remove `applyGlobally` state and toggle button

## Obfuscation — HIGH
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: Project selector and tab pills in content area instead of topbar
**Expected**: Project pill selector + filter tabs in topbar/header area next to "Obfuscation" title
**Fix**: Move project selector and tab pills to header area

## Obfuscation — MEDIUM
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: Rules table missing drag handles and colored left borders
**Expected**: Drag handle (6-dot grip) on hover, green/gray left border by status, type icons (blue text, purple regex)
**Fix**: Add drag handles, colored borders, and type icons

## Obfuscation — MEDIUM
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: Toggle uses Lucide icons + text labels instead of mini CSS toggle switch
**Expected**: 32x18px sliding toggle switch (green when on, gray when off)
**Fix**: Replace with custom toggle switch component

## Obfuscation — MEDIUM
**File**: `frontend/src/routes/admin/obfuscation/+page.svelte`
**Issue**: Missing "Masquage dans l'éditeur" manual obfuscation section
**Expected**: Purple-themed section below rules table with "Ouvrir l'éditeur" button
**Fix**: Add manual obfuscation section card

---

# USERS

## Users — LOW
**File**: `frontend/src/routes/admin/users/+page.svelte`
**Issue**: Action menu invisible until hover (opacity-0) — inaccessible on touch/keyboard
**Expected**: Always discoverable action trigger
**Fix**: Change to `opacity-50 group-hover:opacity-100` instead of `opacity-0`

## Users — LOW
**File**: `frontend/src/routes/admin/users/+page.svelte`
**Issue**: Google SSO indicator lacks icon
**Expected**: Small Google icon before "Google SSO" text
**Fix**: Add icon

---

# UPDATE REQUESTS

## Update Requests — MEDIUM
**File**: `frontend/src/routes/admin/update-requests/+page.svelte`
**Issue**: Loader2 icon spins continuously on in-progress items — distracting, suggests loading
**Expected**: Static status icon, not perpetual spinning
**Fix**: Remove `animate-spin` from in-progress status icon in list items

## Update Requests — MEDIUM
**File**: `frontend/src/routes/admin/update-requests/+page.svelte`
**Issue**: Request cards missing project name context
**Expected**: Each request should show which project the page belongs to
**Fix**: Add project badge/name to request cards

## Update Requests — LOW
**File**: `frontend/src/routes/admin/update-requests/+page.svelte`
**Issue**: No search/filter capability for requests
**Expected**: Search input for filtering by description, page name, or requester
**Fix**: Add search input

---

# COMMAND PALETTE

## Command Palette — HIGH
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: Missing result grouping count badges — groups show label but no "X résultats" count
**Expected**: Right-aligned count next to each group header (e.g., "UTILISATEURS — 2 résultats")
**Fix**: Add count display in group headers using `items.length`

## Command Palette — HIGH
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: Quick actions missing subtitle descriptions (all `subtitle: ''`)
**Expected**: Each action has description: "Créer un projet" → "Initialiser un nouveau projet d'environnement simulé", etc.
**Fix**: Populate `subtitle` field for each quick action. Remove `type !== 'action'` exclusion from subtitle rendering

## Command Palette — MEDIUM
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: Category tab labels don't match mockup — "Demos" should be "Pages", "Captures" should be "Actions"
**Expected**: Tabs: Tous, Pages, Projets, Utilisateurs, Actions
**Fix**: Rename tabs and reorder so "Pages" comes before "Projets"

## Command Palette — MEDIUM
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: User search results use generic icon instead of colored avatar circles with initials
**Expected**: Colored circular avatars with user initials (e.g., "MC" purple, "TL" teal)
**Fix**: Add special rendering for `type === 'user'` with initials avatar

## Command Palette — MEDIUM
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: Page results missing rich subtitle with project context
**Expected**: "Dashboard principal" → subtitle: "Projet Salesforce Lightning — Page d'accueil - Modifiée il y a 2h"
**Fix**: Construct richer subtitle including project name and relative modification time

## Command Palette — MEDIUM
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: Missing footer keyboard navigation hints
**Expected**: Footer with: up/down "naviguer", Enter "ouvrir", Tab "catégorie", ESC "fermer" + "EnvSim" branding
**Fix**: Add keyboard hints to footer

## Command Palette — LOW
**File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
**Issue**: Active tab count badge may be too subtle (bg-white/20)
**Expected**: Clearly visible white pill on blue tab background
**Fix**: Consider `bg-white/30` for better contrast

---

# GENERAL / CROSS-PAGE

## General — LOW
**File**: `frontend/src/app.css` or global styles
**Issue**: Background color may differ — app uses #FFFFFF vs mockup's #f8f8f8
**Expected**: Very light warm gray (#f8f8f8) background
**Fix**: Set app background to #f8f8f8

## General — LOW
**File**: `frontend/src/app.css` or global styles
**Issue**: Missing font-smoothing antialiased setting
**Expected**: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale` on body
**Fix**: Add to global CSS

## General — LOW
**File**: Multiple pages
**Issue**: Missing CSS animations (fadeUp for cards, countUp for stats, staggered fadeIn for table rows)
**Expected**: Entrance animations and hover transforms matching mockup design
**Fix**: Add CSS animations — can be deferred as polish

---

TOTAL_ISSUES: 85
CRITICAL: 7
HIGH: 22
MEDIUM: 30
LOW: 26
