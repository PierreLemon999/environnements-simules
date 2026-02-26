# Phase 3: Login & Auth Flows — Review Report

## Date: 2026-02-26

## Features Tested

| # | Feature | Result |
|---|---------|--------|
| 1 | Login page visual rendering | PASS (after fixes) |
| 2 | Client login (email/password) | PASS |
| 3 | Admin login (Google SSO mock) | PASS |
| 4 | Auth guard: unauthenticated → /admin redirects to /login | PASS |
| 5 | Auth guard: client → /admin redirects to /view | PASS |
| 6 | Root redirect (/ → /login when unauthenticated) | PASS |
| 7 | Invalid login error display | PASS |
| 8 | Empty fields validation | PASS |
| 9 | Password toggle (show/hide) | PASS |

**Total: 9/9 tests passing**

## Issues Found & Fixed

### Severity: Medium (Visual — Mockup mismatch)

| # | Issue | Fix Applied |
|---|-------|-------------|
| 1 | Email label said "Email" instead of "Adresse e-mail" (mockup v4) | Changed label text to "Adresse e-mail" |
| 2 | Google button said "Continuer avec Google" instead of "Se connecter avec Google" | Updated button text |
| 3 | Brand subtitle said "Plateforme de démonstrations Lemon Learning" instead of "Lemon Learning" | Shortened to match mockup |
| 4 | Section header had bold 13px style with Info hint line; mockup uses 11px uppercase muted label | Redesigned to uppercase `IDENTIFIANTS` label matching mockup style |
| 5 | Hint text was inside section header; mockup places it centered below submit button | Moved hint text below form, centered |

### Severity: Low (Visual polish)

| # | Issue | Fix Applied |
|---|-------|-------------|
| 6 | Container max-width 420px vs mockup 440px | Updated to 440px |
| 7 | Brand margin-bottom 28px vs mockup 36px | Updated to 36px |
| 8 | Brand title 20px vs mockup 21px, letter-spacing off | Updated to 21px, -0.4px |
| 9 | Brand subtitle 14px vs mockup 13px, color too light | Updated to 13px with muted color |
| 10 | Button font-weight 500 vs mockup 600 | Updated to 600 |
| 11 | Button/Google hover effects too subtle vs mockup translateY lift effect | Added translateY(-1px) and stronger box-shadow on hover |
| 12 | Google button used fixed height, mockup uses padding 13px 20px | Changed to padding-based sizing |
| 13 | Footer format didn't match mockup (separate p tags vs inline span) | Restructured to inline format matching mockup |

### No fix needed

| # | Observation | Reason |
|---|-------------|--------|
| A | Client redirects to `/view` which shows "Cette démo n'est pas disponible" | By design — `/view` route requires a specific demo path. Clients access demos via invitation links, not direct login. Auth redirect to `/view` is correct behavior. |
| B | Google SSO is mocked (always uses Marie Laurent credentials) | Expected in dev — noted in auth.md rules |
| C | No `/forgot-password` route exists | The link is a placeholder — the feature is not in scope for v1.0 |

## Files Modified

- `frontend/src/routes/login/+page.svelte` — visual and text alignment to mockup v4

## Auth Architecture Summary

The auth system is well-structured:
- **Backend**: JWT signing/verification with role-based guards (`authenticate()`, `requireRole()`)
- **Frontend**: Svelte stores (`user`, `token`, `isAuthenticated`, `userRole`) with localStorage persistence
- **Auth guard**: SvelteKit layout load in `admin/+layout.ts` checks auth + role before rendering
- **Root redirect**: `+page.svelte` at `/` uses `$effect` to redirect based on auth state
- **Token verification**: `loadFromStorage()` in root layout verifies JWT on app start via `/api/auth/verify`

## Remaining Issues

None critical. All auth flows work correctly and the login page now closely matches the mockup v4 design.
