# Implementation Phases — Lemon Lab

> Each phase is designed to be executed by a single `claude -p` session with a fresh context.
> Each phase reads CLAUDE.md for full project context.
> Check boxes track completion across sessions.

---

## Phase 1 — Foundation: Auth + Layout + Login + Dashboard

**Goal**: Working admin shell with auth, sidebar navigation, and dashboard.

### Prerequisites
- [x] Fix auth store bug (use `/auth/verify` instead of `/auth/me`, fix User type id: string)
- [x] Install shadcn-svelte: `npx shadcn-svelte@latest init` (follow prompts, choose default style)
- [x] Install shadcn-svelte components: Button, Input, Card, Dialog, Sheet, Tooltip, Badge, Avatar, Separator, Dropdown Menu, Command, Tabs

### Tasks
- [x] Create login page (`/login`) matching mockup:
  - Centered white card on light gradient background with soft blue decorative circle
  - Two modes: "Accès client" (email + password) and "Administration" (Google SSO button only)
  - "(admin uniquement)" gray label near Google SSO
  - Call `POST /api/auth/login` for clients, `POST /api/auth/google` for admins
  - Redirect to `/admin` on success
- [x] Create admin layout (`/admin/+layout.svelte`) with Linear-style sidebar:
  - 220px sidebar, collapsible to 48px icon-only mode
  - "LL" blue avatar + "Lemon Lab" branding
  - PRINCIPAL section: Dashboard, Projets, Arborescence, Analytics, Invitations (with badge counts)
  - GESTION section: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres
  - OUTILS SIMULÉS section: dynamic list from API with colored dots and page counts
  - Active item: blue text + left blue border
  - Bottom: user avatar + name + role + logout
  - Top header bar: breadcrumb, search input (Cmd+K trigger), notification bell, Extension download button, "+ Nouveau projet" button
- [x] Create dashboard page (`/admin/+page.svelte`) matching mockup:
  - Stats cards row: "Projets actifs", "Pages capturées" (with green deltas)
  - "Projets" section with tab filters: Tous, Actifs, Test, Archivés
  - Project cards/list (fetched from `GET /api/projects`)
  - "Journal d'activité des clients" section with tabs: Toutes, Sessions, Guides terminés
- [x] Create auth guard: redirect unauthenticated users to `/login`, redirect clients to demo viewer
- [x] Create root page redirect: `/` → `/login` if not auth, `/admin` if admin, `/view` if client
- [x] Seed the database if not already seeded (check if data exists)

### Acceptance Criteria
- [x] Can login as admin (use seed data: any admin email with Google mock, or test with verify)
- [x] Can login as client (use seed data: sophie.martin@acme.com)
- [x] Sidebar renders with all sections and navigates between routes
- [x] Dashboard shows real data from API (project count, page count)
- [x] Sidebar collapses/expands
- [x] Responsive behavior (sidebar auto-collapses on small screens)

### Test Command
```bash
cd backend && npx tsx src/db/seed.ts && npm run dev &
cd frontend && npm run dev
# Visit http://localhost:5173
```

---

## Phase 2 — Projects, Versions & Tree View

**Goal**: Full project/version management + page tree view with detail panel.

### Tasks
- [x] Create projects list page (`/admin/projects/+page.svelte`):
  - Tab filters by status: Tous, Actifs, Test, Archivés
  - Project cards with: tool icon, name, version count, page count, last update, status badge
  - "+ Nouveau projet" button → creation dialog
  - Search/filter functionality
- [x] Create project detail page (`/admin/projects/[id]/+page.svelte`):
  - Project header with tool name, subdomain, description
  - Versions list with: name, status badge (active/test/deprecated), author avatar+name, language, page count, date
  - Version actions: edit, duplicate, delete
  - "+ Nouvelle version" button
- [x] Create new project dialog:
  - Form: name, tool name (dropdown), subdomain (auto-generated, editable), description
  - Call `POST /api/projects`
- [x] Create version management:
  - Create/edit dialog with: name, status, language
  - Duplicate action (call `POST /api/versions/:id/duplicate`)
  - Delete with confirmation
- [x] Create tree view page (`/admin/tree/+page.svelte`) matching mockup:
  - Three-panel layout: collapsed sidebar + tree panel (280px) + detail panel
  - Tree panel header: project selector dropdown, tabs "Par site" / "Par guide"
  - Search: "Filtrer les pages" input
  - Status bar: "X OK — Y Avert. — Z Erreur" with colored dots + progress bar
  - Tree structure: expandable folders with page counts, page items with health status dots
  - Footer: version selector, page count
  - Data from `GET /api/versions/:id/tree`
- [x] Create page detail panel (right side of tree view):
  - Breadcrumb: Project > Section > Page
  - Action buttons: "Édition en direct", "Obfuscation", "Ouvrir démo" (green)
  - Preview thumbnail (if available)
  - Metadata: URL source, file size, capture date, capture mode, link counts, health status
  - Active obfuscation rules as chips
  - Associated guides list
  - Data from `GET /api/pages/:id`
- [x] Create site map view (optional, simpler version):
  - Visual node graph showing page relationships
  - Legend: Page, Modale, Erreur

### Acceptance Criteria
- [x] Can create, edit, delete projects
- [x] Can create, edit, duplicate, delete versions
- [x] Tree view displays hierarchical page structure from API
- [x] Clicking a page shows detail panel with all metadata
- [x] Tree is searchable/filterable
- [x] Status indicators (green/orange/red dots) render correctly

---

## Phase 3 — Command Palette, Obfuscation, Invitations & User Management

**Goal**: Global search, obfuscation rule editor, client invitation system, user management.

### Tasks
- [x] Create Command Palette (Cmd+K) matching mockup:
  - Global keyboard shortcut Cmd+K / Ctrl+K
  - Centered modal with dimmed backdrop
  - Search input with category tabs: Tous, Pages, Projets, Utilisateurs, Actions
  - Results grouped by category with icons and metadata
  - Keyboard navigation (arrows, enter, esc)
  - Quick actions: "Nouvelle capture" (Cmd+N), "Créer un projet" (Cmd+P)
  - Search across: pages (title, URL), projects (name, tool), users (name, email)
  - Data from multiple API endpoints
- [x] Create obfuscation page (`/admin/obfuscation/+page.svelte`) matching mockup:
  - Project selector dropdown
  - Tabs: "Règles auto" (with count), "Manuel"
  - Rules table: columns RECHERCHER, REMPLACER PAR, PORTÉE, OCCURRENCES, STATUT, actions
  - Inline add form at bottom: type dropdown, search input, replace input, scope dropdown, Ajouter/Annuler buttons
  - "Appliquer globalement" toggle
  - CRUD via `/api/projects/:id/obfuscation` endpoints
  - Preview functionality
- [x] Create invitations page (`/admin/invitations/+page.svelte`) matching mockup:
  - Stats cards: "Invitations envoyées" (with trend), "Clients actifs"
  - Client list table: name, company, email, assigned demo, connection count, expiry, status
  - "+ Nouvelle invitation" button → dialog
  - Invitation dialog: email, name, company, version selector, password (auto-generated, shown once), expiry (default 3 months, up to 2 years)
  - Link sharing option with company selection
  - Account creation requirement option
  - CRUD via `/api/versions/:id/assignments`
- [x] Create users page (`/admin/users/+page.svelte`):
  - User list with avatars, names, roles, email, last login
  - Admin vs Client tabs
  - CRUD via `/api/users`
- [x] Create update requests page (`/admin/update-requests/+page.svelte`):
  - List of all update requests
  - Status workflow: pending → in_progress → done
  - Filter by status
  - Show page name, requester, comment, date
  - CRUD via `/api/update-requests`

### Acceptance Criteria
- [x] Cmd+K opens command palette from anywhere in admin
- [x] Search returns relevant results across entities
- [x] Can create/edit/delete obfuscation rules with preview
- [x] Can create invitations, generate credentials, see client list
- [x] Can manage users (list, create, edit, delete)
- [x] Can view and process update requests

---

## Phase 4 — Analytics, Page Editor & Demo Viewers

**Goal**: Analytics dashboard, page HTML editor, commercial + prospect demo viewers.

### Tasks
- [x] Create analytics page (`/admin/analytics/+page.svelte`) matching mockup:
  - Collapsed sidebar mode
  - Tab navigation: "Vue générale", "Par client", "Par outil", "Guides"
  - Top-right: "En direct" green indicator, project filter dropdown, date range picker
  - "Sessions totales" card with line chart and % change
  - Two tables: "Admins & Commerciaux" and "Clients" with session counts
  - "Sessions récentes" table with search and CSV export
  - Session detail right panel on click: user info, engagement score, role badge, duration, activity timeline
  - Handle company-only cases (link sharing without person)
  - Data from `/api/analytics/*` endpoints
- [x] Create page editor (`/admin/editor/[id]/+page.svelte`) matching mockup:
  - Three-panel layout: page list sidebar + editor + link map
  - Page list: project selector, search, pages with modification dates and status dots
  - Tabs: "Éditeur HTML", "Liens & Navigation", "JavaScript"
  - HTML editor with syntax highlighting (use a lightweight code editor like CodeMirror or Monaco)
  - Links view: detected links, mapping status, link count summary
  - Link map: mini node graph of page connections
  - Save/preview actions
  - Data from `GET/PATCH /api/pages/:id/content`
- [x] Create commercial demo viewer (`/demo/[...path]/+page.svelte`) matching mockup:
  - Dark top header bar: "LL Demo" logo + demo title + page name
  - Action toolbar: project dropdown, page dropdown, version status badge
  - Stats row: pages captured, clients connected, last activity
  - Action buttons: "Partager le lien", "Copier l'URL", "Ouvrir en tant que client", "Paramètres"
  - Full-width iframe below showing the demo HTML page
  - Data from demo API + demo serving endpoint
- [x] Create prospect demo viewer (`/view/[...path]/+page.svelte`) matching mockup:
  - Nearly invisible UI — just the demo content
  - Small floating "LL" yellow avatar widget bottom-right
  - Minimal toolbar on hover/click (optional)
  - Served via demo access token authentication
- [x] Add live edit mode (admin only):
  - Toggle "Édition en direct" in tree view detail panel
  - Click text elements in demo to edit them inline
  - Save changes to HTML file via `PATCH /api/pages/:id/content`

### Acceptance Criteria
- [x] Analytics shows real session data with charts and tables
- [x] Can click a session to see full detail in side panel
- [x] Page editor loads HTML, allows editing, saves changes
- [x] Commercial viewer renders demo pages in iframe with full toolbar
- [x] Prospect viewer renders demo pages with minimal chrome
- [x] Live edit allows text modification directly in demo view

---

## Phase 5 — Extension Chrome (Capture Libre + Guided)

**Goal**: Working Chrome extension for free and guided page capture.

### Tasks
- [x] Set up extension project:
  - Create `extension/` directory with Vite + CRXJS + Svelte setup
  - `manifest.json` (Manifest V3): permissions for activeTab, storage, tabs
  - Background service worker
  - Content script (vanilla JS)
  - Popup (Svelte)
- [x] Create extension popup matching mockup:
  - Header: "LL" avatar + "Lemon Lab" + connection status (green "Connecté")
  - Project selector dropdown + "+ Nouveau" button
  - Mode toggle: "Libre" / "Guides" / "Auto" (3 icon buttons)
  - Progress section: "X / Y pages" + progress bar
  - Status indicators: "X envoyées", "Y en cours", "Z erreur" (colored dots)
  - Page list (scrollable): status icon + page name + URL + file size
  - Bottom actions: "Pause" button, "Capturer cette page" button
  - Footer links: "Paramètres — Zones d'intérêt — Liste noire"
- [x] Implement authentication in extension:
  - Login via Google SSO (same as admin)
  - Store JWT in chrome.storage
  - Auto-refresh token
- [x] Implement free capture mode:
  - User navigates manually
  - Click "Capturer cette page" to capture current page
  - Capture process:
    1. Scroll entire page to trigger lazy loading
    2. Wait for network idle
    3. Capture full DOM (document.documentElement.outerHTML)
    4. Inline all CSS (resolve `<link>` to `<style>`)
    5. Inline images as base64 (or download separately)
    6. Capture iframes recursively
    7. Adapt JS for static rendering (disable API calls, timers, navigation listeners)
    8. Condense into single HTML file
    9. Upload to backend via `POST /api/versions/:id/pages`
  - Show progress in popup (per page: capturing → uploading → done/error)
  - Retry on network failure
- [x] Implement guided capture mode:
  - Follow Lemon Learning guide steps
  - Capture page at each step
  - Maintain guide-page association
- [x] Add page management in popup:
  - View captured pages list with status
  - Delete/recapture individual pages
  - Eye icon to preview a captured page

### Acceptance Criteria
- [x] Extension installs in Chrome (developer mode)
- [x] Can login via Google SSO from extension
- [x] Can select a project and version
- [x] Free capture: can capture current page, see it upload, confirm in admin tree
- [x] Captured page renders correctly when served from backend
- [x] Progress tracking works (status per page, overall progress bar)
- [x] Retry works on simulated network failure

---

## Phase 6 — Extension Auto Capture + Polish + Testing

**Goal**: Auto capture with depth algorithm, final polish, tests.

### Tasks
- [x] Implement auto capture mode in extension:
  - Configuration panel matching mockup: pages cible, profondeur max, délai entre pages
  - Interest zones: URL patterns with depth multipliers
  - Blacklist: dangerous button labels to never click
  - BFS crawl algorithm from current page
  - Handle SPA routing, modals, dropdowns
  - Wait for DOM stabilization after each navigation
  - Avoid loops (URL tracking, normalization)
  - Stop at target page count
  - Resume interrupted captures
  - Alert if page > 10 Mo (auto-simplify if needed)
  - "Lancer le crawl" button
- [x] Add extension detection in admin:
  - Check if extension is installed via messaging
  - Show download link if not installed
  - Show update prompt if outdated
- [x] Polish all existing UI:
  - Responsive design check
  - Loading states (skeletons, spinners)
  - Error states (empty states, error messages)
  - Toast notifications for actions (create, delete, save)
  - Keyboard shortcuts throughout (Cmd+K, Cmd+N, Cmd+P, Escape to close modals)
  - Tooltips on all icon buttons
  - Smooth transitions and animations
- [x] Add export functionality:
  - "Exporter en .zip" button on version detail
  - Backend endpoint to create zip of all pages + metadata
- [x] Write tests:
  - Backend: Vitest + Supertest for critical endpoints (auth, demo serving, obfuscation, page upload)
  - Frontend: Vitest for critical stores and utility functions
  - Extension: Vitest for capture logic (DOM processing, link detection)
- [x] Final integration test:
  - Full workflow: login → create project → capture pages (mock) → view tree → serve demo → view as prospect

### Acceptance Criteria
- [x] Auto capture crawls pages following BFS with depth control
- [x] Interest zones increase depth in specified URL patterns
- [x] Blacklist prevents clicking dangerous buttons
- [x] All UI pages have loading and error states
- [x] Toast notifications appear for all CRUD actions
- [x] All keyboard shortcuts work
- [x] Tests pass for critical paths
- [x] Full workflow works end-to-end
