#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Environnements Simulés — Feature-by-Feature Review & Fix
# ══════════════════════════════════════════════════════════════
#
# Goes through every page/feature, tests it with headless browser,
# compares to mockups and specs, fixes issues, verifies fixes.
#
# Usage:
#   ./run-feature-review.sh          # Run all phases (1-14)
#   ./run-feature-review.sh 3        # Run from phase 3
#   ./run-feature-review.sh 3 5      # Run phases 3 to 5
#
# Fire and forget — runs unattended.
# ══════════════════════════════════════════════════════════════

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOCKUPS_DIR="$PROJECT_DIR/environnements-simules-maquettes-ia - Maquettes initiales "
LOG_DIR="$PROJECT_DIR/review-logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

START_PHASE=${1:-1}
END_PHASE=${2:-14}
BACKEND_PID=""
FRONTEND_PID=""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

mkdir -p "$LOG_DIR"

# ── Cleanup ──────────────────────────────────────────────────
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT

# ── Start servers ────────────────────────────────────────────
start_servers() {
    echo -e "${CYAN}Starting servers...${NC}"
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 1

    cd "$PROJECT_DIR/backend"
    npm install --silent 2>/dev/null
    npx tsx src/db/seed.ts > /dev/null 2>&1
    npx tsx src/index.ts > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!

    cd "$PROJECT_DIR/frontend"
    npm install --silent 2>/dev/null
    npx vite dev > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!

    echo -n "  Backend..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
            echo -e " ${GREEN}OK${NC}"; break
        fi
        sleep 1
        [ $i -eq 30 ] && echo -e " ${RED}TIMEOUT${NC}" && return 1
    done

    echo -n "  Frontend..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo -e " ${GREEN}OK${NC}"; break
        fi
        sleep 1
        [ $i -eq 30 ] && echo -e " ${RED}TIMEOUT${NC}" && return 1
    done
    cd "$PROJECT_DIR"
}

restart_servers() {
    echo -e "${CYAN}Restarting servers...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 2
    start_servers
}

# ── Run a review phase ───────────────────────────────────────
run_phase() {
    local PHASE_NUM=$1
    local PHASE_NAME=$2
    local PROMPT=$3
    local LOG_FILE="$LOG_DIR/phase-${PHASE_NUM}-${PHASE_NAME}-${TIMESTAMP}.log"
    local MAX_TURNS=120

    echo -e "${YELLOW}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  Phase $PHASE_NUM: $PHASE_NAME${NC}"
    echo -e "${YELLOW}║  $(date '+%H:%M:%S')${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════╝${NC}"
    echo -e "  Log: $LOG_FILE"

    if claude -p "$PROMPT" \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
        --max-turns $MAX_TURNS \
        --model opus \
        > "$LOG_FILE" 2>&1; then
        echo -e "  ${GREEN}✓ Phase $PHASE_NUM complete${NC}"
    else
        echo -e "  ${RED}✗ Phase $PHASE_NUM had errors (check log)${NC}"
    fi
    echo -e "  Finished: $(date '+%H:%M:%S')"
    echo ""
}

# ══════════════════════════════════════════════════════════════
# PHASE DEFINITIONS
# ══════════════════════════════════════════════════════════════

# Helper: common preamble for all phases
PREAMBLE="You are reviewing and fixing the Environnements Simulés project, one feature at a time.

PROJECT ROOT: $PROJECT_DIR
MOCKUPS DIR: $MOCKUPS_DIR

CRITICAL INSTRUCTIONS:
1. Read CLAUDE.md FIRST for project context, design system, and conventions.
2. Read the relevant .claude/rules/ files for domain context.
3. Read the LATEST VERSION of each referenced mockup (the folder with the highest version number).
4. Servers are already running: backend on :3001, frontend on :5173.
5. DO NOT start or stop servers.
6. For each feature, follow this process:
   a. Read the current implementation code
   b. Read the matching mockup HTML to understand expected behavior
   c. Test with headless Playwright or curl commands to verify functionality
   d. Compare behavior to mockups and specs
   e. Fix ALL issues found (code, layout, logic, missing features)
   f. Re-test to confirm fixes work
7. Write a REPORT to $LOG_DIR/phase-PHASE_NUM-report.md with:
   - Features tested
   - Issues found (with severity)
   - Fixes applied
   - Remaining issues (if any)
8. Do NOT ask any questions. Make judgment calls when needed.
9. Prioritize: broken functionality > missing features > visual mismatch > polish.
10. All code in English, all UI in French.
11. Keep the interface simple and minimal (Linear/Notion inspired).
12. For Playwright tests, write a temporary test file, run it, then delete it.

TESTING PATTERN — Use this for browser testing:
Create a temp file like /tmp/test-phase.spec.ts with Playwright code, then run:
  cd $PROJECT_DIR && npx playwright test /tmp/test-phase.spec.ts --config=tests/playwright.config.ts --project=functional
Delete the temp file after.

For quick API tests, use curl:
  curl -s http://localhost:3001/api/endpoint | head -c 500

To get an admin JWT token for API calls:
  curl -s -X POST http://localhost:3001/api/auth/google -H 'Content-Type: application/json' -d '{\"email\":\"admin@lemonlearning.com\",\"name\":\"Admin Test\",\"googleId\":\"google-admin-1\"}'

To get a client JWT token:
  curl -s -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"sophie.martin@acme.com\",\"password\":\"demo1234\"}'
"

# ── Phase 1: Backend API Health ──────────────────────────────
PHASE_1_PROMPT="$PREAMBLE

PHASE 1: BACKEND API HEALTH CHECK

Test EVERY API endpoint to verify it works and returns expected data format.
Read .claude/rules/database.md for schema reference.
Read .claude/rules/auth.md for auth flows.

ENDPOINTS TO TEST (use curl with appropriate auth):
1. POST /api/auth/google — admin login (mock), verify JWT returned
2. POST /api/auth/login — client login, verify JWT returned
3. POST /api/auth/verify — token validation
4. POST /api/auth/demo-access — prospect access token login
5. GET /api/projects — list projects (needs admin JWT)
6. POST /api/projects — create project
7. GET /api/projects/:id — single project
8. PUT /api/projects/:id — update project
9. GET /api/projects/:id/versions — list versions
10. POST /api/projects/:id/versions — create version
11. PUT /api/versions/:id — update version
12. POST /api/versions/:id/duplicate — duplicate version
13. GET /api/versions/:id/pages — list pages
14. GET /api/versions/:id/tree — tree structure
15. GET /api/projects/:id/obfuscation — obfuscation rules
16. POST /api/projects/:id/obfuscation — add rule
17. GET /api/versions/:id/assignments — list assignments
18. POST /api/versions/:id/assignments — create assignment
19. GET /api/analytics/overview — analytics overview
20. GET /api/analytics/sessions — sessions list
21. GET /api/users — user list
22. POST /api/users — create user
23. GET /api/update-requests — list update requests
24. POST /api/versions/:id/capture-jobs — create capture job
25. GET /api/capture-jobs/:id — capture job status

For each endpoint:
- Verify it returns 200 (or appropriate status code)
- Verify response format matches { data: ... } for success
- Verify { error: string, code: number } for errors
- Check auth is enforced (401 without token, 403 for wrong role)
- Note any crashes, 500 errors, or malformed responses

Fix any backend issues found (routes, middleware, database queries).
Then re-test the fixed endpoints.

Write report to $LOG_DIR/phase-1-report.md"

# ── Phase 2: Extension Chrome ────────────────────────────────
PHASE_2_PROMPT="$PREAMBLE

PHASE 2: EXTENSION CHROME — BUILD & CODE REVIEW

The Chrome extension cannot be tested in Playwright, but we can:
1. Build it to verify compilation
2. Review code against mockups and specs
3. Test backend endpoints the extension depends on

STEPS:
1. Read extension/CLAUDE.md for patterns.
2. Read .claude/rules/capture.md for capture domain specs.
3. Read ALL extension source files in extension/src/.
4. Read the mockup files:
   - $MOCKUPS_DIR/maquette-extension-popup-24fev26/v5/index.html (latest popup mockup)
   - $MOCKUPS_DIR/extension-capture-libre/v1/index.html
   - $MOCKUPS_DIR/extension-capture-guidee/v1/index.html
   - $MOCKUPS_DIR/extension-capture-auto/v2/index.html (latest auto capture mockup)
5. Build the extension: cd $PROJECT_DIR/extension && npm run build
6. Fix any build errors.
7. Compare the popup UI (App.svelte, MainView.svelte, AutoCapturePanel.svelte, LoginView.svelte) to the mockups.
8. Verify the capture logic in extension/src/lib/capture.ts:
   - Does it inline CSS?
   - Does it base64 images?
   - Does it handle iframes?
   - Does it scroll for lazy loading?
   - Does it wait for network idle?
9. Verify the auto-capture BFS algorithm in extension/src/lib/auto-capture.ts:
   - Interest zones with depth multipliers
   - Blacklist (dangerous buttons)
   - Loop avoidance (URL tracking)
   - Target page count stop condition
   - Resume/pause functionality
10. Verify the API client (extension/src/lib/api.ts):
   - JWT injection
   - Retry logic
   - Error handling
11. Verify the service worker (extension/src/background/service-worker.ts):
   - All 23 message types handled
   - Correct backend API calls
   - State management
12. Fix any issues found: missing features, logic bugs, UI mismatches.

Test backend capture endpoints:
  - POST /api/versions/:versionId/pages (with multipart upload — create a small test HTML)
  - GET /api/versions/:versionId/pages (verify uploaded page appears)
  - GET /api/capture-jobs/:id

Write report to $LOG_DIR/phase-2-report.md"

# ── Phase 3: Login & Auth ────────────────────────────────────
PHASE_3_PROMPT="$PREAMBLE

PHASE 3: LOGIN & AUTH FLOWS

MOCKUPS: Read $MOCKUPS_DIR/maquette-login-24fev26/v4/index.html (latest)
SOURCE: Read frontend/src/routes/login/+page.svelte
RULES: Read .claude/rules/auth.md

TEST WITH PLAYWRIGHT — create a test that:
1. Navigates to http://localhost:5173/login
2. Takes a screenshot → compare visually to mockup (centered card, gradient background, blue circle, two modes)
3. Tests CLIENT LOGIN:
   - Fill email: sophie.martin@acme.com
   - Fill password: demo1234
   - Click login button
   - Verify redirect to /view/ (client viewer)
   - Verify JWT is stored
4. Tests ADMIN LOGIN:
   - Navigate back to /login
   - Click on the 'Administration' tab or mode
   - Click Google SSO button
   - Verify redirect to /admin (admin dashboard)
5. Tests AUTH GUARD:
   - Without auth, navigate to /admin → should redirect to /login
   - With client auth, navigate to /admin → should redirect to /view
6. Tests ROOT REDIRECT:
   - Visit / → should redirect based on auth state
7. Tests INVALID LOGIN:
   - Wrong password → should show error message
   - Empty fields → should show validation

CHECK AGAINST MOCKUP:
- Centered white card on light gradient
- Soft blue decorative circle
- Two clear modes: 'Accès client' (email + password) and 'Administration' (Google SSO only)
- '(admin uniquement)' gray label near Google SSO
- Logo/branding at top
- French labels

Fix ALL issues. Re-test after fixes.
Write report to $LOG_DIR/phase-3-report.md"

# ── Phase 4: Admin Dashboard ─────────────────────────────────
PHASE_4_PROMPT="$PREAMBLE

PHASE 4: ADMIN DASHBOARD

MOCKUPS: Read $MOCKUPS_DIR/maquette-admin-dashboard-24fev26/v5/index.html (latest)
SOURCE: Read frontend/src/routes/admin/+page.svelte AND frontend/src/routes/admin/+layout.svelte
RULES: Read .claude/rules/administration.md

TEST WITH PLAYWRIGHT (as admin):
1. Login as admin
2. Navigate to /admin
3. Screenshot → compare to mockup

CHECK DASHBOARD:
- Stats cards row: 'Projets actifs', 'Pages capturées' with green delta badges
- 'Projets' section with tab filters: Tous, Actifs, Test, Archivés
- Project cards show: tool icon, name, version count, page count, status
- 'Journal d'activité des clients' section with tabs
- Data is real (from API), not placeholder

CHECK SIDEBAR (in +layout.svelte):
- 220px width, collapsible to 48px
- 'ES' blue avatar + 'Env. Simulés' branding
- PRINCIPAL section: Dashboard, Projets, Arborescence, Analytics, Invitations
- GESTION section: Utilisateurs, Obfuscation, Demandes MAJ, Paramètres
- OUTILS SIMULÉS section with dynamic project list
- Active item has blue text + left blue border
- Bottom: user avatar + name + role + logout
- Collapse/expand works

CHECK HEADER BAR:
- Breadcrumb
- Search input (triggers Cmd+K palette)
- Notification bell
- Extension download button
- '+ Nouveau projet' button

TEST NAVIGATION:
- Click each sidebar item → correct route
- Click project card → goes to project detail
- Stats match actual API data

Fix ALL visual and functional issues. Re-test.
Write report to $LOG_DIR/phase-4-report.md"

# ── Phase 5: Projects & Versions ─────────────────────────────
PHASE_5_PROMPT="$PREAMBLE

PHASE 5: PROJECTS & VERSIONS

MOCKUPS:
- Read $MOCKUPS_DIR/maquette-project-detail-24fev26/v2/index.html (latest project detail)
SOURCE:
- Read frontend/src/routes/admin/projects/+page.svelte
- Read frontend/src/routes/admin/projects/[id]/+page.svelte

TEST WITH PLAYWRIGHT (as admin):
1. Navigate to /admin/projects
2. Screenshot → compare to mockup
3. Test project list:
   - Tab filters work (Tous, Actifs, Test, Archivés)
   - Project cards display correctly
   - Search/filter functionality
4. Test create project:
   - Click '+ Nouveau projet'
   - Fill form: name, tool name, subdomain, description
   - Submit → verify project appears in list
   - Verify API call succeeded
5. Navigate to project detail (/admin/projects/:id)
6. Screenshot → compare to mockup
7. Test project detail:
   - Project header with tool name, subdomain
   - Versions list with status badges, author, language
   - Edit project metadata works
8. Test version management:
   - Create new version
   - Edit version (change status, name)
   - Duplicate version → verify copy appears
   - Delete version (with confirmation)
9. Verify version status badges: active (green), test (blue), deprecated (gray)
10. Verify each version shows page count

Fix ALL issues. Verify data persists after page reload.
Write report to $LOG_DIR/phase-5-report.md"

# ── Phase 6: Tree View ───────────────────────────────────────
PHASE_6_PROMPT="$PREAMBLE

PHASE 6: TREE VIEW & PAGE DETAIL

MOCKUPS: Read $MOCKUPS_DIR/maquette-tree-view-24fev26/v7/index.html (latest)
SOURCE: Read frontend/src/routes/admin/tree/+page.svelte

TEST WITH PLAYWRIGHT (as admin):
1. Navigate to /admin/tree
2. Screenshot → compare to mockup

CHECK TREE VIEW:
- Three-panel layout: collapsed sidebar + tree panel (~280px) + detail panel
- Tree panel header: project selector dropdown, tabs 'Par site' / 'Par guide'
- Search: 'Filtrer les pages' input
- Status bar: 'X OK — Y Avert. — Z Erreur' with colored dots + progress bar
- Tree structure: expandable folders, page items with health status dots
- Footer: version selector, page count
- Data from API (not mock/placeholder)

CHECK DETAIL PANEL (when a page is selected):
- Breadcrumb: Project > Section > Page
- Action buttons: 'Édition en direct', 'Obfuscation', 'Ouvrir démo'
- Preview thumbnail
- Metadata: URL source, file size, capture date, capture mode, link counts, health
- Active obfuscation rules as chips
- Associated guides list

TEST INTERACTIONS:
- Expand/collapse tree nodes
- Click a page → detail panel updates
- Search filter narrows results
- Project selector changes the tree
- Version selector changes the tree
- Status dot colors match health status (green=ok, orange=warning, red=error)

Fix ALL layout, data, and interaction issues.
Write report to $LOG_DIR/phase-6-report.md"

# ── Phase 7: Command Palette ─────────────────────────────────
PHASE_7_PROMPT="$PREAMBLE

PHASE 7: COMMAND PALETTE (Cmd+K)

MOCKUPS: Read $MOCKUPS_DIR/maquette-command-palette-24fev26/v6/index.html (latest)
SOURCE: Find and read the command palette component in the frontend (likely in lib/components/).

TEST WITH PLAYWRIGHT (as admin):
1. Navigate to /admin
2. Press Cmd+K (or Ctrl+K)
3. Screenshot → compare to mockup

CHECK COMMAND PALETTE:
- Centered modal with dimmed backdrop
- Search input at top
- Category tabs: Tous, Pages, Projets, Utilisateurs, Actions
- Results grouped by category with icons and metadata
- Results are REAL data from API (search pages by title/URL, projects by name, users by name/email)
- Quick actions visible: 'Nouvelle capture' (Cmd+N), 'Créer un projet' (Cmd+P)

TEST INTERACTIONS:
- Type search query → results update in real-time
- Click category tab → filters results
- Click a result → navigates to correct page
- Arrow keys navigate results
- Enter selects highlighted result
- Escape closes palette
- Click backdrop closes palette

Fix ALL issues. Ensure search actually queries the API.
Write report to $LOG_DIR/phase-7-report.md"

# ── Phase 8: Obfuscation ─────────────────────────────────────
PHASE_8_PROMPT="$PREAMBLE

PHASE 8: OBFUSCATION RULES

MOCKUPS: Read $MOCKUPS_DIR/maquette-obfuscation-24fev26/v4/index.html (latest)
SOURCE: Read frontend/src/routes/admin/obfuscation/+page.svelte
RULES: Read .claude/rules/administration.md (obfuscation section)

TEST WITH PLAYWRIGHT (as admin):
1. Navigate to /admin/obfuscation
2. Screenshot → compare to mockup

CHECK OBFUSCATION PAGE:
- Project selector dropdown at top
- Tabs: 'Règles auto' (with count badge), 'Manuel'
- Rules table: columns RECHERCHER, REMPLACER PAR, PORTÉE, OCCURRENCES, STATUT, actions
- Inline add form at bottom: type dropdown, search input, replace input, scope dropdown, Ajouter/Annuler buttons
- 'Appliquer globalement' toggle
- Each rule can be toggled active/inactive
- Edit/delete actions per rule

TEST FUNCTIONALITY:
1. Select a project
2. Create a new obfuscation rule:
   - Search term: 'ACME Corp'
   - Replace with: 'DemoCompany'
   - Submit → verify appears in table
3. Toggle rule active/inactive
4. Edit rule → verify changes persist
5. Delete rule → verify removed

TEST OBFUSCATION PREVIEW:
- If preview functionality exists, test it shows before/after

TEST BACKEND:
- curl GET /api/projects/:id/obfuscation → verify rules returned
- curl POST to add a rule → verify 200
- curl DELETE to remove → verify 200

Fix ALL issues.
Write report to $LOG_DIR/phase-8-report.md"

# ── Phase 9: Invitations & Assignments ───────────────────────
PHASE_9_PROMPT="$PREAMBLE

PHASE 9: INVITATIONS & DEMO ASSIGNMENTS

MOCKUPS: Read $MOCKUPS_DIR/maquette-invitation-clients-24fev26/v3/index.html (latest)
SOURCE: Read frontend/src/routes/admin/invitations/+page.svelte
RULES: Read .claude/rules/administration.md (assignments section)

TEST WITH PLAYWRIGHT (as admin):
1. Navigate to /admin/invitations
2. Screenshot → compare to mockup

CHECK INVITATIONS PAGE:
- Stats cards: 'Invitations envoyées' (with trend), 'Clients actifs'
- Client list table: name, company, email, assigned demo, connection count, expiry, status
- '+ Nouvelle invitation' button
- Search/filter in table

TEST CREATE INVITATION:
1. Click '+ Nouvelle invitation'
2. Dialog opens with: email, name, company, version selector, auto-generated password, expiry
3. Fill form with test data
4. Submit → verify appears in table
5. Verify the generated access link works

TEST INVITATION WORKFLOW:
- Created invitation shows as active
- Verify password is shown once (and can be copied)
- Verify expiry date is correct
- Delete invitation → verify removed

TEST PROSPECT ACCESS:
- Use generated access token + password to login via /api/auth/demo-access
- Verify JWT returned with client role
- Navigate to /view/... → should render demo content

Fix ALL issues.
Write report to $LOG_DIR/phase-9-report.md"

# ── Phase 10: Users & Update Requests ────────────────────────
PHASE_10_PROMPT="$PREAMBLE

PHASE 10: USERS & UPDATE REQUESTS

SOURCE:
- Read frontend/src/routes/admin/users/+page.svelte
- Find and read the update requests page (likely /admin/update-requests/ or similar)

TEST USERS PAGE (as admin):
1. Navigate to /admin/users (or wherever the users page is)
2. Screenshot
3. Check:
   - User list with avatars, names, roles, email, last login
   - Admin vs Client tabs/filters
   - Can create new user
   - Can edit user (role, name)
   - Can delete user (with confirmation)
4. Test CRUD:
   - Create a test user → verify appears in list
   - Edit user → verify changes persist
   - Delete user → verify removed

TEST UPDATE REQUESTS:
1. Navigate to update requests page
2. Check:
   - List of all update requests
   - Status workflow: pending → in_progress → done
   - Filter by status
   - Each shows: page name, requester, comment, date
3. Test workflow:
   - Create an update request via API: POST /api/pages/:id/update-request
   - Verify it appears in the list
   - Change status from pending → in_progress → done
   - Verify status updates reflect in UI

Fix ALL issues.
Write report to $LOG_DIR/phase-10-report.md"

# ── Phase 11: Analytics ──────────────────────────────────────
PHASE_11_PROMPT="$PREAMBLE

PHASE 11: ANALYTICS DASHBOARD

MOCKUPS: Read $MOCKUPS_DIR/maquette-analytics-24fev26/v6/index.html (latest)
SOURCE: Read frontend/src/routes/admin/analytics/+page.svelte

TEST WITH PLAYWRIGHT (as admin):
1. Navigate to /admin/analytics
2. Screenshot → compare to mockup

CHECK ANALYTICS PAGE:
- Collapsed sidebar mode (should auto-collapse or use compact layout)
- Tab navigation: 'Vue générale', 'Par client', 'Par outil', 'Guides'
- Top-right: 'En direct' green indicator, project filter dropdown, date range picker
- 'Sessions totales' card with line chart and % change
- Two tables: 'Admins & Commerciaux' and 'Clients' with session counts
- 'Sessions récentes' table with search and CSV export button
- Session detail right panel on click

TEST FUNCTIONALITY:
1. Verify data loads from API (not placeholder)
2. Check if tabs switch content correctly
3. Test project filter dropdown
4. Test date range picker
5. Click a session row → verify detail panel opens
6. Detail panel shows: user info, engagement score, role badge, duration, activity timeline
7. Verify CSV export button works (or is at least wired)

TEST BACKEND ANALYTICS:
- curl GET /api/analytics/overview → verify response
- curl GET /api/analytics/sessions → verify sessions data
- curl GET /api/analytics/sessions/:id → verify session detail
- Create a session event via API if needed to have data

Fix ALL issues. Pay attention to charts/graphs rendering.
Write report to $LOG_DIR/phase-11-report.md"

# ── Phase 12: Page Editor & Live Edit ────────────────────────
PHASE_12_PROMPT="$PREAMBLE

PHASE 12: PAGE EDITOR & LIVE EDIT

MOCKUPS: Read $MOCKUPS_DIR/maquette-page-editor-25fev26/v3/index.html (latest)
SOURCE:
- Read frontend/src/routes/admin/editor/[id]/+page.svelte
- Read frontend/src/routes/admin/live-edit/[id]/+page.svelte (if exists)

TEST PAGE EDITOR (as admin):
1. Navigate to /admin/editor/:pageId (find a valid page ID from the API)
2. Screenshot → compare to mockup
3. Check:
   - Three-panel layout: page list sidebar + editor + link map
   - Page list: project selector, search, pages with dates and status dots
   - Tabs: 'Éditeur HTML', 'Liens & Navigation', 'JavaScript'
   - HTML editor with syntax highlighting
   - Links view: detected links, mapping status
   - Save button works
   - Preview button works

TEST EDITOR FUNCTIONALITY:
1. Open the HTML editor
2. Make a small change to the HTML content
3. Click Save
4. Reload page → verify change persisted
5. Check the Links tab → verify it shows page links
6. Check link counts match actual data

TEST LIVE EDIT:
1. Navigate to the live edit page (if it exists)
2. Verify it shows the captured page in an editable view
3. Click on text → verify it becomes editable
4. Make a change → save
5. Verify change persists

If pages have no content to edit (no captured pages), create test content:
- Upload a small HTML file via the API: POST /api/versions/:id/pages

Fix ALL issues.
Write report to $LOG_DIR/phase-12-report.md"

# ── Phase 13: Demo Viewers ───────────────────────────────────
PHASE_13_PROMPT="$PREAMBLE

PHASE 13: DEMO VIEWERS (COMMERCIAL + PROSPECT)

MOCKUPS:
- Read $MOCKUPS_DIR/maquette-commercial-viewer-24fev26/v5/index.html (latest commercial)
- Read $MOCKUPS_DIR/maquette-demo-viewer-24fev26/v4/index.html (latest client/demo)

SOURCE:
- Read frontend/src/routes/demo/[...path]/+page.svelte (commercial viewer)
- Read frontend/src/routes/view/[...path]/+page.svelte (prospect viewer)
- Read backend/src/routes/demo.ts (demo serving)
- Read backend/src/services/demo-serving.ts

TEST DEMO SERVING BACKEND:
1. curl GET /demo/:subdomain/:path → verify HTML is served
2. Verify obfuscation rules are applied in served content
3. Verify link rewriting works (internal links point to /demo/subdomain/newpath)
4. Verify tag manager script injection (if configured)

TEST COMMERCIAL VIEWER (as admin):
1. Navigate to /demo/... with admin auth
2. Screenshot → compare to mockup
3. Check:
   - Dark top header bar: 'LL Demo' logo + demo title + page name
   - Action toolbar: project dropdown, page dropdown, version status badge
   - Stats row: pages captured, clients connected, last activity
   - Action buttons: 'Partager le lien', 'Copier l'URL', 'Ouvrir en tant que client', 'Paramètres'
   - Full-width iframe showing the demo HTML page
4. Test actions:
   - Dropdown selectors work
   - Copy URL button works
   - Share link generates correct URL

TEST PROSPECT VIEWER (as client):
1. Login as client (sophie.martin@acme.com / demo1234)
2. Navigate to /view/...
3. Screenshot → compare to mockup
4. Check:
   - Nearly invisible UI — just the demo content fills the screen
   - Small floating 'LL' avatar widget bottom-right
   - Demo content renders correctly
   - Navigation between demo pages works

If no demo content exists to test, ensure there are captured pages:
- Check if backend/data/uploads/ has HTML files
- If empty, create test HTML content via API

Fix ALL issues. Demo serving is a critical feature.
Write report to $LOG_DIR/phase-13-report.md"

# ── Phase 14: Final Integration ──────────────────────────────
PHASE_14_PROMPT="$PREAMBLE

PHASE 14: FINAL INTEGRATION & END-TO-END REVIEW

This is the final phase. Run a complete end-to-end workflow and verify everything works together.

FULL WORKFLOW TEST (Playwright):
1. Visit / → should redirect to /login
2. Login as admin → redirect to /admin dashboard
3. Verify dashboard shows real stats
4. Navigate via sidebar to Projects
5. Create a new project named 'Test Review Project'
6. Create a version for it
7. Navigate to Tree View → select the new project → verify empty tree
8. Navigate to Obfuscation → add a rule for the new project
9. Navigate to Invitations → create an invitation for the new project's version
10. Navigate to Analytics → verify page loads
11. Navigate to Users → verify user list
12. Open Command Palette (Cmd+K) → search for the new project → verify it appears
13. Logout

CLIENT FLOW:
14. Login as client (sophie.martin@acme.com)
15. Verify redirect to client viewer
16. Verify demo content loads (if available)
17. Logout

CLEANUP & FINAL CHECKS:
18. Delete the test project via API
19. Take final screenshots of ALL pages
20. Write FINAL REPORT to $LOG_DIR/phase-14-report.md listing:
    - All pages verified: status (OK / ISSUES)
    - Overall quality assessment
    - Remaining known issues
    - Recommendations for next steps

Also write a SUMMARY to $LOG_DIR/review-summary.md combining findings from all phases."

# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Environnements Simulés — Feature Review${NC}"
echo -e "${BLUE}  Phases $START_PHASE → $END_PHASE${NC}"
echo -e "${BLUE}  Started: $(date)${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
echo ""

# Start servers
start_servers || { echo -e "${RED}Failed to start servers${NC}"; exit 1; }

# Run phases
declare -a PHASE_NAMES=(
    "" # 0-indexed placeholder
    "backend-api"
    "extension-chrome"
    "login-auth"
    "admin-dashboard"
    "projects-versions"
    "tree-view"
    "command-palette"
    "obfuscation"
    "invitations"
    "users-update-requests"
    "analytics"
    "page-editor"
    "demo-viewers"
    "final-integration"
)

declare -a PHASE_PROMPTS=(
    "" # placeholder
    "$PHASE_1_PROMPT"
    "$PHASE_2_PROMPT"
    "$PHASE_3_PROMPT"
    "$PHASE_4_PROMPT"
    "$PHASE_5_PROMPT"
    "$PHASE_6_PROMPT"
    "$PHASE_7_PROMPT"
    "$PHASE_8_PROMPT"
    "$PHASE_9_PROMPT"
    "$PHASE_10_PROMPT"
    "$PHASE_11_PROMPT"
    "$PHASE_12_PROMPT"
    "$PHASE_13_PROMPT"
    "$PHASE_14_PROMPT"
)

for phase in $(seq "$START_PHASE" "$END_PHASE"); do
    run_phase "$phase" "${PHASE_NAMES[$phase]}" "${PHASE_PROMPTS[$phase]}"

    # Restart servers between phases (code may have changed)
    if [ "$phase" -lt "$END_PHASE" ]; then
        restart_servers || { echo -e "${RED}Failed to restart servers${NC}"; exit 1; }
    fi

    # Commit every 3 phases
    if [ $((phase % 3)) -eq 0 ]; then
        echo -e "${CYAN}Intermediate commit...${NC}"
        cd "$PROJECT_DIR"
        git add -A
        git commit -m "$(cat <<EOF
fix: feature review phases $((phase-2))-$phase fixes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
        )" 2>/dev/null
    fi
done

# Final commit
echo -e "${CYAN}Final commit...${NC}"
cd "$PROJECT_DIR"
git add -A
git commit -m "$(cat <<'EOF'
fix: comprehensive feature review — all phases

Systematic review and fixes for every feature:
- Backend API endpoints verified
- Extension build and code reviewed
- All admin pages tested and fixed
- Demo viewers verified
- End-to-end workflow confirmed

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" 2>/dev/null

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Feature Review Complete!${NC}"
echo -e "${GREEN}  Logs: $LOG_DIR/${NC}"
echo -e "${GREEN}  Finished: $(date)${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
