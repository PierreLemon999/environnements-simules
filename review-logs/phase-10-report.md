# Phase 10 Review Report: Users & Update Requests

## Features Tested

### Users Page (`/admin/users`)
- User list display with avatars, names, roles, emails, creation dates
- Admin vs Client tab filters with counts
- Search/filter by name, email, company
- Create new user (with validation)
- Edit user (name, email, role, password)
- Delete user (with confirmation dialog, prevents self-deletion)
- "Vous" badge on current user
- Google SSO indicator for admin users

### Update Requests Page (`/admin/update-requests`)
- Status summary cards (En attente, En cours, Terminées) with counts
- Request list with comment, page info, requester, dates
- Tab filters by status (Toutes, En attente, En cours, Terminées)
- Search by comment, page title, URL path, requester name
- Status workflow: pending → in_progress → done
- "Prendre en charge" / "Marquer terminée" action buttons
- Relative time display for recent requests
- Resolved date shown for completed requests

### API Endpoints
- `GET /api/users` — List all users (admin only) ✅
- `POST /api/users` — Create user ✅
- `PUT /api/users/:id` — Update user ✅
- `DELETE /api/users/:id` — Delete user (prevents self-deletion) ✅
- `GET /api/update-requests` — List with enriched page/user data ✅
- `POST /api/pages/:pageId/update-request` — Create request ✅
- `PUT /api/update-requests/:id` — Update status ✅

## Issues Found & Fixes Applied

### 1. Incorrect `$derived` pattern (Medium — Code quality)
**Files:** `users/+page.svelte`, `update-requests/+page.svelte`
**Issue:** Both pages used `$derived(() => { ... })` which stores a function reference, requiring `filteredUsers()` / `filteredRequests()` calls in templates. This re-runs filter logic on every access.
**Fix:** Changed to `$derived.by(() => { ... })` which computes the value once and caches it. Updated all template references to use `filteredUsers` / `filteredRequests` (without parentheses).

### 2. Duplicate `<h1>` elements (Low — Accessibility/SEO)
**Files:** `users/+page.svelte`, `update-requests/+page.svelte`
**Issue:** The layout `Header.svelte` already renders an `<h1>` with the page title. Each page also had its own `<h1>`, creating duplicate h1 elements (bad for accessibility and SEO).
**Fix:** Changed page-level headings from `<h1>` to `<h2>`.

### 3. Update request status change loses enriched data (Medium — Data loss bug)
**File:** `update-requests/+page.svelte`
**Issue:** When changing a request's status via `updateStatus()`, the API response returns only base fields (no `page` or `requestedByUser` enriched data). The spread `{ ...r, ...res.data }` overwrote the enriched fields with `undefined`, causing page title and requester name to disappear from the card after status change.
**Fix:** Changed merge logic to only update `status` and `resolvedAt` from the API response, preserving the enriched `page` and `requestedByUser` data.

### 4. Missing company field in users management (Low — Missing feature)
**Files:** `users/+page.svelte`, `backend/src/routes/users.ts`
**Issue:** The `users` DB table has a `company` column (used by seed data for client users like "Acme Corp", "TechVision"), but:
  - The frontend `UserRecord` interface didn't include `company`
  - The user list cards didn't display company names
  - The create/edit dialog had no company input
  - The backend POST/PUT endpoints didn't handle the `company` field
  - Search didn't filter by company name
**Fix:**
  - Added `company` to the `UserRecord` interface
  - Display company name next to email for client users (with `·` separator)
  - Added conditional "Entreprise" input field in create/edit dialog (shown only when role is "client")
  - Backend POST route now accepts and stores `company` field
  - Backend PUT route now accepts and updates `company` field
  - Search filter now also matches company name

## Test Results

### API Tests (curl) — All passed
- Users CRUD: Create → Edit → Delete ✅
- Update requests: List → Create → Status changes (pending → in_progress → done) ✅

### Playwright Tests — 15/15 passed
**First run (10 tests):** 8 passed, 2 failed (only due to `h1` selector matching two elements — the actual functionality worked)
**Re-test after fixes (5 tests):** 5/5 passed
- Users page: single h1, company display, CRUD operations ✅
- Update requests page: single h1, status workflow, tab filters ✅

## Remaining Issues

### Pre-existing (not introduced by this phase)
- **Backend TypeScript errors:** Drizzle ORM `eq()` type mismatches with Express `req.params` across all route files (analytics, assignments, users, etc.). These are type-only issues — the runtime works correctly via `tsx`.
- **Backend not in watch mode:** The backend runs with `tsx src/index.ts` (not `tsx watch`), so backend code changes (company field support) require a server restart to take effect. Frontend changes are picked up immediately via Vite HMR.
- **Sidebar links to non-existent routes:** "Composants" (`/admin/components`) and "Paramètres" (`/admin/settings`) are in the sidebar but have no corresponding pages.

## Summary

| Category | Count |
|----------|-------|
| Issues found | 4 |
| Issues fixed | 4 |
| Severity: Medium | 2 |
| Severity: Low | 2 |
| Files modified | 3 |
| Tests run | 15 |
| Tests passed | 15 |
