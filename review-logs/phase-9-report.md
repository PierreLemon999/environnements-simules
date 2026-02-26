# Phase 9: Invitations & Demo Assignments — Review Report

## Features Tested

1. **Invitations page layout** — Stats cards, two-column layout, table + form card
2. **Stats cards** — "Invitations envoyées" (with trend), "Liens actifs", "Connexions"
3. **Client list table** — Name, company, email, assigned demo, status, date, actions
4. **Search and filters** — Search by client name/email/company, status filter, project filter
5. **Create invitation (email tab)** — Form with name, email, company, project, version, expiry
6. **Create invitation (link tab)** — Company selector, project, version, password, expiry
7. **Credentials display** — Password shown once, copy functionality, token display
8. **Delete/revoke invitation** — Confirmation dialog, removes from table
9. **Demo-access auth flow** — POST /api/auth/demo-access with accessToken + password
10. **Pagination and sorting** — Column sort toggles, paginated table

## Issues Found & Fixed

### Critical (3)

1. **Missing `company` field on `users` table** (severity: critical)
   - The `users` SQLite table had no `company` column, making it impossible to display client company names in the invitations table
   - **Fix**: Added `company TEXT` column to `backend/src/db/schema.ts`, the seed `CREATE TABLE`, and the actual DB via `ALTER TABLE`
   - Files: `backend/src/db/schema.ts`, `backend/src/db/seed.ts`, DB migration

2. **Backend GET assignments didn't return company** (severity: critical)
   - The enrichment query in `GET /versions/:versionId/assignments` only selected `{ id, name, email }` from users — no company
   - **Fix**: Added `company: users.company` to the select in `backend/src/routes/assignments.ts`
   - File: `backend/src/routes/assignments.ts:58`

3. **Backend POST assignment didn't accept/save company** (severity: critical)
   - Creating a new assignment with a new user didn't accept `company` from the request body
   - **Fix**: Added `company` to the destructured body, included it when inserting a new user, and update existing users if company was missing
   - File: `backend/src/routes/assignments.ts:101-130`

### Medium (2)

4. **Table columns cut off** (severity: medium)
   - The 6-column table (Client, Email, Projet/Démo, Statut, Envoyé le, Actions) overflowed the card width in the 1.5fr/1fr grid layout. The "Envoyé le" and "Actions" columns were not visible
   - **Fix**: Changed table to `table-fixed` layout with `<colgroup>` defining explicit percentage widths per column. Reduced cell text sizes and padding to fit all 6 columns
   - File: `frontend/src/routes/admin/invitations/+page.svelte`

5. **Frontend didn't pass company when creating invitation** (severity: medium)
   - Both the email invitation form and the link sharing form did not include `company` in the API request body
   - **Fix**: Added `company` to both `handleCreateEmail()` and `handleGenerateLink()` POST payloads
   - File: `frontend/src/routes/admin/invitations/+page.svelte`

### Low (1)

6. **Seed data missing company for client users** (severity: low)
   - Existing seed users (Sophie Martin, Jean-Marc Dubois) had no company set
   - **Fix**: Added `company` to seed data and updated existing DB records
   - File: `backend/src/db/seed.ts`

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/db/schema.ts` | Added `company` column to `users` table definition |
| `backend/src/db/seed.ts` | Added `company` column to CREATE TABLE SQL + seed data for client users |
| `backend/src/routes/assignments.ts` | GET: return company in user enrichment; POST: accept & save company |
| `frontend/src/routes/admin/invitations/+page.svelte` | Pass company in create requests; table-fixed layout with colgroup for all 6 columns |

## Test Results

**4/4 Playwright tests passing:**

1. ✅ Invitations page loads with all elements (stats, table, form, company display, 6 column headers)
2. ✅ Create invitation with company (fills form, submits, credentials shown)
3. ✅ Demo-access auth flow works (create assignment → auth with token+password → JWT returned with client role)
4. ✅ Delete dialog and revocation (hover actions, dialog opens, cancel preserves data)

## API Endpoints Verified

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/auth/google` | POST | ✅ Working (dev bypass) |
| `/api/auth/demo-access` | POST | ✅ Working (token + password) |
| `/api/versions/:id/assignments` | GET | ✅ Working (returns company) |
| `/api/versions/:id/assignments` | POST | ✅ Working (accepts company) |
| `/api/assignments/:id` | DELETE | ✅ Working |
| `/api/projects` | GET | ✅ Working |
| `/api/projects/:id` | GET | ✅ Working (returns versions) |

## Remaining Issues

- **Table text truncation**: With `table-fixed` layout, long names/emails truncate with ellipsis ("Jean-Ma...", "sophie.martin@..."). This is acceptable for the two-column layout but could be improved with a responsive breakpoint that hides certain columns on smaller screens.
- **No real email sending**: The "Envoyer l'invitation" button creates credentials but doesn't actually send an email. The admin must manually copy/paste credentials. This is by design (the mockup shows a "Bloc à insérer dans votre mail" pattern).
- **Connexions stat is approximate**: The "Connexions" card shows the total assignments count, not actual connection events. A proper implementation would count sessions from the analytics system.
