# Environnements Simulés — Project Brief

## What This Is

A platform for Lemon Learning to create simulated demo environments of enterprise SaaS tools (Salesforce, SAP, Workday, etc.). Chrome extension captures pages → backend stores/serves them with obfuscation → admins manage everything → prospects view demos.

## Current State

- **Backend**: 95% complete — all 35 API endpoints, 15 DB tables, auth, demo serving, obfuscation, analytics. Production-ready.
- **Frontend**: 5% — SvelteKit scaffolding + API client + auth store (has bugs). No UI components built.
- **Extension**: 0% — not started.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit (Svelte 5) + shadcn-svelte + Tailwind CSS + Lucide Icons |
| Backend | Express.js 5 + TypeScript + Drizzle ORM + better-sqlite3 |
| Extension | Chrome Manifest V3 + Vite + CRXJS + Svelte (popup) |
| Auth | JWT (backend) + Google SSO (admins) + email/password (clients) |

## Architecture

```
/
├── frontend/          # SvelteKit — admin + demo viewer
├── backend/           # Express.js — API REST (port 3001)
├── extension/         # Chrome Manifest V3 — capture
├── shared/            # Types partagés
└── PHASES.md          # Implementation plan
```

Backend serves API on `localhost:3001`. Frontend proxies `/api` to backend via Vite config.

## Database Schema (15 tables in SQLite)

**Core**: users, projects, versions, pages, pageLinks, guides, guidePages
**Features**: obfuscationRules, demoAssignments, sessions, sessionEvents, updateRequests, captureJobs, interestZones, tagManagerConfig

All IDs are UUID v4 strings. Dates are ISO 8601 strings. Booleans are integers (0/1).

## API Endpoints Summary

- `POST /api/auth/login` — client login (email+password)
- `POST /api/auth/google` — admin Google SSO
- `POST /api/auth/demo-access` — prospect demo access (token+password)
- `POST /api/auth/verify` — verify JWT
- `GET/POST /api/projects` — list/create projects
- `GET/PUT/DELETE /api/projects/:id` — project CRUD
- `GET/POST /api/projects/:id/versions` — versions
- `PUT/DELETE /api/versions/:id` — version CRUD
- `POST /api/versions/:id/duplicate` — fork version
- `POST /api/versions/:id/pages` — upload page (multipart)
- `GET /api/versions/:id/pages` — list pages
- `GET /api/versions/:id/tree` — page tree structure
- `GET/PUT/DELETE /api/pages/:id` — page CRUD
- `PATCH /api/pages/:id/content` — update HTML content
- `GET /api/demo/:subdomain/*` — serve demo page (public)
- `GET/POST/PUT/DELETE /api/projects/:id/obfuscation` — obfuscation rules
- `POST /api/projects/:id/obfuscation/preview` — preview obfuscation
- `GET/POST/DELETE /api/versions/:id/assignments` — demo assignments
- `GET /api/analytics/sessions` — sessions (filterable)
- `GET /api/analytics/sessions/:id` — session detail
- `GET /api/analytics/guides` — guide stats
- `GET /api/analytics/overview` — aggregated overview
- `POST /api/analytics/events` — record event (public)
- `POST /api/pages/:id/update-request` — create update request
- `GET/PUT /api/update-requests` — list/update requests
- `POST /api/versions/:id/capture-jobs` — create capture job
- `GET/PUT /api/capture-jobs/:id` — capture job status
- `GET/POST/PUT/DELETE /api/users` — user management

## Design System

**Style**: Linear/Notion-inspired, minimal, clean. shadcn-svelte components.

### Colors
- Background: white (#FFFFFF) / light gray (#F9FAFB)
- Primary: blue (#3B82F6)
- Text: dark (#111827) / secondary (#6B7280) / muted (#9CA3AF)
- Success: green (#10B981)
- Error: red (#EF4444)
- Warning: orange (#F59E0B)

### Sidebar (Linear-style)
- 220px expanded / 48px collapsed (icon-only)
- Blue "ES" avatar + "Env. Simulés" title
- Sections: PRINCIPAL (Dashboard, Projets, Arborescence, Analytics, Invitations), GESTION (Utilisateurs, Obfuscation, Demandes MAJ, Paramètres), OUTILS SIMULÉS (dynamic list)
- Active item: blue text + 3px blue left border
- Badge counts on nav items

### Components
- Cards: white bg, 1px border (#E5E7EB), rounded-lg
- Buttons: blue filled (primary), outlined (secondary), ghost (tertiary)
- Tables: uppercase gray headers, clean rows
- Command Palette: Cmd+K, centered modal, category tabs
- Status dots: green/orange/red for health
- Progress bars: blue on gray track

## Roles

- **admin**: All Lemon Learning employees. Provisioned on first Google login. Full access to everything.
- **client**: Prospects/customers. Email+password only. Access demo viewer only.

## Key Business Logic

### Demo Serving Flow
1. Request comes to `/demo/:subdomain/*`
2. Find project by subdomain → find active version → find page by URL path
3. Read HTML file from disk
4. Apply obfuscation rules (search/replace)
5. Rewrite internal links to point to other captured pages
6. Inject Lemon Learning tag manager script
7. Serve result

### Obfuscation
- Rules are per-project, applied globally
- Support plain text and regex
- Applied to stored HTML (persistent)
- Preview endpoint available

## Code Conventions

- **Language**: English for all code (variables, functions, comments)
- **UI Content**: French (labels, messages, tooltips) — will be multilingual later
- **File naming**: kebab-case for files, PascalCase for Svelte components
- **API responses**: `{ data: ... }` for success, `{ error: string, code: number }` for errors
- **IDs**: UUID v4 strings everywhere
- **Auth header**: `Authorization: Bearer <jwt>`
- **Commits**: conventional commits (feat:, fix:, chore:)

## Frontend Patterns (to follow)

### SvelteKit Routes Structure
```
frontend/src/routes/
├── +layout.svelte              # Root layout
├── +page.svelte                # Redirect to /login or /admin
├── login/+page.svelte          # Login page
├── admin/
│   ├── +layout.svelte          # Admin layout with sidebar
│   ├── +page.svelte            # Dashboard
│   ├── projects/
│   │   ├── +page.svelte        # Project list
│   │   └── [id]/+page.svelte   # Project detail + versions
│   ├── tree/+page.svelte       # Tree view
│   ├── analytics/+page.svelte  # Analytics dashboard
│   ├── invitations/+page.svelte # Client invitations
│   ├── users/+page.svelte      # User management
│   ├── obfuscation/+page.svelte # Obfuscation rules
│   ├── update-requests/+page.svelte # Update requests
│   └── editor/[id]/+page.svelte # Page editor
├── demo/
│   └── [...path]/+page.svelte  # Demo viewer (commercial)
└── view/
    └── [...path]/+page.svelte  # Demo viewer (prospect)
```

### Component Organization
```
frontend/src/lib/components/
├── ui/                # shadcn-svelte base components
├── layout/            # Sidebar, Header, CommandPalette
├── dashboard/         # Dashboard-specific components
├── projects/          # Project cards, lists, forms
├── tree/              # Tree view components
├── analytics/         # Charts, tables, session detail
├── editor/            # Code editor, link map
└── demo/              # Demo viewer toolbar, banners
```

### Svelte 5 Patterns
- Use `$state()` for reactive state
- Use `$derived()` for computed values
- Use `$effect()` for side effects
- Use `{#snippet}` for template reuse
- Props via `let { prop1, prop2 } = $props()`

## Known Bugs to Fix

1. **Auth store** (`frontend/src/lib/stores/auth.ts`): References `/auth/me` endpoint that doesn't exist. Should use `/auth/verify`. User type has `id: number` but backend uses string UUIDs.
2. **Missing shadcn-svelte**: Needs to be installed and initialized.

## Mockup Unresolved Feedback

1. **Login page**: Remove element at coordinates (782,590)-(1151,588); Add "(admin uniquement)" in gray text near Google SSO
2. **Analytics**: Handle cases where only company name is known (link sharing without person data)
3. **Invitations**: Add option to require account creation

## Commands

```bash
# Backend
cd backend && npm run dev          # Start dev server (port 3001)
cd backend && npx tsx src/db/seed.ts  # Seed database

# Frontend
cd frontend && npm run dev         # Start dev server (port 5173)
cd frontend && npm run build       # Production build

# Both (from root)
npm run dev                        # Start both concurrently
```
