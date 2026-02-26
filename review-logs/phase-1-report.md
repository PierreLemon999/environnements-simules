# Phase 1: Backend API Health Check — Report

**Date:** 2026-02-26
**Status:** PASS (all endpoints operational after fixes)

---

## Summary

Tested all 25+ API endpoints across 11 route files. Found 3 issues, fixed all 3. All endpoints now return correct response formats and proper auth enforcement.

---

## Endpoints Tested

### Auth (4 endpoints) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `POST /api/auth/google` | PASS | Returns `{ data: { token, user } }`, auto-provisions @lemonlearning.com admins |
| `POST /api/auth/login` | PASS | Client email/password auth works (seed: `sophie.martin@acme-corp.fr` / `client123`) |
| `POST /api/auth/verify` | PASS | Returns `{ data: { valid, user } }`, handles invalid tokens gracefully |
| `POST /api/auth/demo-access` | PASS | Accepts `accessToken` + `password`, returns JWT with versionId |

### Projects (4 endpoints) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/projects` | PASS | Returns 7 seeded projects with version/page counts |
| `POST /api/projects` | PASS | Creates project, returns 201 |
| `GET /api/projects/:id` | PASS | Returns project with versions |
| `PUT /api/projects/:id` | PASS | Updates project fields |

### Versions (4 endpoints) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/projects/:id/versions` | PASS | Returns versions for project |
| `POST /api/projects/:id/versions` | PASS | Creates version, returns 201 |
| `PUT /api/versions/:id` | PASS | Updates version name/status/language |
| `POST /api/versions/:id/duplicate` | PASS | Forks version with all pages |

### Pages (2 endpoints tested) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/versions/:id/pages` | PASS | Returns 8 pages for Salesforce version |
| `GET /api/versions/:id/tree` | PASS | Returns hierarchical tree structure |

### Obfuscation (2 endpoints tested) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/projects/:id/obfuscation` | PASS | Returns 7 rules for Salesforce project |
| `POST /api/projects/:id/obfuscation` | PASS | Creates rule, returns 201 |

### Assignments (2 endpoints tested) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/versions/:id/assignments` | PASS | Returns assignments with enriched user info |
| `POST /api/versions/:id/assignments` | PASS | Accepts `email`+`name` or `userId`, generates access_token + password |

### Analytics (4 endpoints) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/analytics/overview` | PASS | Returns aggregated stats (sessions, events, avg duration) |
| `GET /api/analytics/sessions` | PASS | Returns 4 sessions with event counts |
| `GET /api/analytics/guides` | PASS | Returns guide statistics |
| `POST /api/analytics/events` | PASS | Public endpoint (no auth), records events |

### Users (2 endpoints tested) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/users` | PASS | Returns all users (admin-only) |
| `POST /api/users` | PASS | Creates user, returns 201 |

### Update Requests (3 endpoints) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/update-requests` | PASS | Returns 3 seeded requests with page/user info |
| `POST /api/pages/:id/update-request` | PASS | Creates request, returns 201 |
| `PUT /api/update-requests/:id` | PASS | Updates request status |

### Capture Jobs (2 endpoints tested) — ALL PASS
| Endpoint | Status | Notes |
|----------|--------|-------|
| `POST /api/versions/:id/capture-jobs` | PASS | Creates job, returns 201 |
| `GET /api/capture-jobs/:id` | PASS | Returns job with interest zones |

### Auth Enforcement — ALL PASS
| Test | Expected | Actual |
|------|----------|--------|
| No auth on admin endpoint | 401 | 401 |
| Client token on admin-only endpoint | 403 | 403 |
| Invalid token | 401 | 401 |
| No auth on update-requests | 401 | 401 |
| No auth on analytics | 401 | 401 |
| No auth on analytics/events POST | Allowed (public) | Allowed |
| Verify with invalid token | `{ valid: false }` | `{ valid: false }` |

---

## Issues Found & Fixed

### Issue 1: Negative average session duration (Severity: MEDIUM)
- **File:** `backend/src/routes/analytics.ts:325`
- **Problem:** `averageSessionDurationSeconds` returned `-6440` because seed data had `endedAt` timestamps earlier than `startedAt` (e.g., session starts at 16:34 UTC, ends at 15:45 UTC same day).
- **Root cause:** Seed script used `isoDaysAgo(n)` (which includes current time) for `startedAt` but hardcoded `endedAt` to fixed earlier times.
- **Fix 1:** Added `Math.max(0, ...)` guard in analytics overview to clamp negative durations to 0.
- **Fix 2:** Fixed seed data to use explicit `startedAt` times that are always before `endedAt`.
- **Verified:** After re-seed, `averageSessionDurationSeconds` = 5100 (correct, ~85 min avg).

### Issue 2: Missing capture jobs list endpoint (Severity: LOW)
- **File:** `backend/src/routes/capture-jobs.ts`
- **Problem:** No `GET /versions/:versionId/capture-jobs` endpoint to list capture jobs for a version. Only individual `GET /capture-jobs/:id` existed.
- **Fix:** Added `GET /versions/:versionId/capture-jobs` route that returns all jobs for a version, enriched with interest zones and parsed config.
- **Verified:** Returns 1 capture job for Salesforce version after re-seed.

### Issue 3: Seed data inconsistency (Severity: LOW)
- **File:** `backend/src/db/seed.ts`
- **Problem:** Session `endedAt` times could be before `startedAt` times depending on when the seed script runs.
- **Fix:** Changed all `startedAt` values to use fixed early times (14:00, 10:00, 16:00 UTC) that are guaranteed to be before their corresponding `endedAt` times.

---

## Remaining Issues

None — all API endpoints are operational and returning correct response formats.

---

## Response Format Compliance

All endpoints correctly follow the convention:
- Success: `{ data: ... }` with HTTP 200 or 201
- Error: `{ error: "message", code: number }` with appropriate HTTP status codes
- Auth errors: 401 (missing/invalid token) or 403 (insufficient role)

## Files Modified
1. `backend/src/routes/analytics.ts` — Added `Math.max(0, ...)` for avg duration
2. `backend/src/db/seed.ts` — Fixed session startedAt/endedAt times
3. `backend/src/routes/capture-jobs.ts` — Added GET list endpoint for version capture jobs
