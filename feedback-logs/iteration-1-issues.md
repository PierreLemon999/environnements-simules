# Iteration 1 — UI/UX Quality Audit

**Date**: 2026-02-25
**Auditor**: Claude (automated)
**Scope**: All 14 screenshots vs reference mockups

---

## Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 2     | Blocks usage entirely |
| HIGH     | 8     | Clearly wrong / major deviation from mockup |
| MEDIUM   | 6     | Noticeable difference from mockup |
| LOW      | 3     | Polish / minor refinement |

---

## CRITICAL ISSUES

---

## [ALL ADMIN PAGES] — CRITICAL
**File**: `frontend/src/routes/admin/+layout.ts` (line 14) + `frontend/src/routes/+layout.svelte` (line 11)
**Issue**: Every admin page (dashboard, projects, project-detail, tree, analytics, invitations, users, obfuscation, update-requests, command-palette) redirects to the login page instead of rendering. Screenshots 04–14 ALL show the login page.
**Root Cause**: The admin layout guard (`+layout.ts`) runs `getStore(isAuthenticated)` synchronously BEFORE the root layout's `onMount` → `loadFromStorage()` async call has completed. The store is still `false` at that point, so it throws `redirect(302, '/login')` every time.
**Expected**: After `loginAsAdmin()` in the test, navigation to `/admin/*` routes should render the actual admin pages with sidebar, header, and page content.
**Fix**: Two changes needed:
1. In `frontend/src/routes/admin/+layout.ts`, import and await `loadFromStorage()` before checking auth:
```typescript
export const load: LayoutLoad = async () => {
  if (browser) {
    await loadFromStorage();
    const authed = getStore(isAuthenticated);
    if (!authed) throw redirect(302, '/login');
    const currentUser = getStore(user);
    if (currentUser?.role === 'client') throw redirect(302, '/view');
  }
};
```
2. Alternatively, the test's `loginAsAdmin()` function may fail because the backend `/auth/google` endpoint rejects the `mock-google-token`. Verify the backend accepts mock tokens, or update the test to use a seeded client login and adjust the guard.

---

## [SCREENSHOT TEST HARNESS] — CRITICAL
**File**: `tests/e2e/screenshots.spec.ts` (lines 7–27)
**Issue**: The `loginAsAdmin()` helper clicks the Google SSO button with mock data, but the backend likely rejects the mock token. The `waitForURL` on line 26 catches the error silently (`.catch(() => {})`), so the test continues unauthenticated and all subsequent screenshots capture the login page.
**Expected**: The test should actually authenticate and then screenshot each admin page.
**Fix**: Either:
1. Seed a test admin user with email/password login capability, or
2. Configure the backend to accept mock Google tokens in test mode, or
3. Use Playwright's `storageState` to inject a valid JWT token directly into localStorage before navigating to admin pages:
```typescript
async function loginAsAdmin(page) {
  // Call backend API directly to get a token
  const response = await page.request.post('http://localhost:3001/api/auth/google', {
    data: { googleToken: 'mock-google-token', email: 'marie.laurent@lemonlearning.com', name: 'Marie Laurent', googleId: 'google-marie-001' }
  });
  const { data } = await response.json();
  // Inject token into localStorage
  await page.goto('/login');
  await page.evaluate((token) => localStorage.setItem('auth_token', token), data.token);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
}
```

---

## HIGH ISSUES

---

## [LOGIN PAGE — Client Tab] — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The login page uses a tab-based UI (Accès client / Administration) which fundamentally differs from the mockup design. The mockup shows a single unified login card with email/password form at top, then a divider "ou se connecter avec", then a Google SSO button — all visible at once, no tabs.
**Expected (per mockup v4)**: Single card with:
1. Logo "ED" (gradient blue) with text "Environnements de Démonstration" / "Lemon Learning"
2. Section label "IDENTIFIANTS" (uppercase, small)
3. Email field (label: "Adresse e-mail")
4. Password field with show/hide toggle
5. "Se souvenir de moi" checkbox + "Mot de passe oublié ?" link
6. Blue "Se connecter" button
7. Divider "ou se connecter avec"
8. Google SSO button with full Google logo (multicolor)
9. Footer: "Propulsé par Lemon Learning" + copyright + links
**Fix**: Rewrite `login/+page.svelte` to match mockup layout — remove tabs, show everything in a single flow.

---

## [LOGIN PAGE — Branding] — HIGH
**File**: `frontend/src/routes/login/+page.svelte` (lines 83–88)
**Issue**: Logo text says "ES" and title says "Environnements Simulés". The mockup says "ED" and "Environnements de Démonstration".
**Expected**: Logo should show "ED" and title should be "Environnements de Démonstration" per the mockup. Subtitle should be just "Lemon Learning" (not "Plateforme de démonstrations Lemon Learning").
**Fix**: Update line 84 `ES` → `ED`, line 86 title text, and line 87 subtitle text.

---

## [LOGIN PAGE — Logo Style] — HIGH
**File**: `frontend/src/routes/login/+page.svelte` (line 83)
**Issue**: Logo is a flat blue square with "ES". The mockup shows a gradient blue (linear-gradient 135deg from #2563eb to #1e40af) square with a shadow (`box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3)`) and "ED" text at 18px. The current logo uses `bg-primary` (flat #3B82F6).
**Expected**: Gradient background, drop shadow on the logo, 52x52px with 14px border-radius.
**Fix**: Replace `bg-primary` with `bg-gradient-to-br from-[#2563eb] to-[#1e40af] shadow-[0_4px_12px_rgba(37,99,235,0.3)]`.

---

## [LOGIN PAGE — Missing Elements] — HIGH
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Several mockup elements are completely missing:
1. No "Se souvenir de moi" checkbox
2. No "Mot de passe oublié ?" link
3. No password visibility toggle button
4. No "IDENTIFIANTS" section label
5. No divider between form and Google SSO
6. No footer ("Propulsé par Lemon Learning" + copyright)
7. No animated background shapes (4 blurred circles with `shapeFloat` animation)
8. No dot pattern overlay
**Expected**: All these elements should be present per the mockup.
**Fix**: Add all missing elements to `login/+page.svelte`.

---

## [LOGIN PAGE — Google SSO Button] — HIGH
**File**: `frontend/src/routes/login/+page.svelte` (lines 167–179)
**Issue**: Google button uses a generic `Chrome` lucide icon (globe-like). The mockup uses the official multicolor Google "G" logo (4 colors: blue, green, yellow, red SVG paths). Button text says "Continuer avec Google" but mockup says "Se connecter avec Google".
**Expected**: Full-color Google logo SVG + text "Se connecter avec Google".
**Fix**: Replace the `Chrome` icon with the proper Google SVG, update button text.

---

## [LOGIN PAGE — Admin Tab Content] — HIGH
**File**: `frontend/src/routes/login/+page.svelte` (lines 156–181)
**Issue**: The admin tab shows a completely separate panel with only the Google button and "(admin uniquement)" text. Per the mockup, there are no tabs — the Google SSO button is visible on the same page as the email/password form, below a divider.
**Expected**: No tabs. Single unified form. The "(admin uniquement)" text from R007 feedback should appear as a small gray hint below the Google button, which is already implemented in line 180. But the tab structure itself should be removed.
**Fix**: Remove the tab switching UI entirely. Show both login methods on one page.

---

## [LOGIN PAGE — Background] — HIGH
**File**: `frontend/src/routes/login/+page.svelte` (lines 76–78)
**Issue**: Current background has only two simple decorative circles (one at top-right, one at bottom-left) using `bg-primary/5` and `bg-primary/3`. The mockup has 4 animated blurred shapes with `shapeFloat` keyframe animation (20s cycle), plus a radial gradient background, plus a dot pattern overlay.
**Expected**: Rich animated background with gradient blobs and dot pattern per mockup CSS.
**Fix**: Replace the simple circles with the full mockup background system (4 `.bg-shape` elements + `.bg-gradient` + `.bg-dots`).

---

## [LOGIN PAGE — Field Labels] — HIGH
**File**: `frontend/src/routes/login/+page.svelte` (lines 114, 129)
**Issue**: Email label says "Email" but mockup says "Adresse e-mail". Password label "Mot de passe" matches.
**Expected**: "Adresse e-mail" for the email field label.
**Fix**: Change line 114 from `Email` to `Adresse e-mail`.

---

## MEDIUM ISSUES

---

## [LOGIN PAGE — Card Styling] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte` (line 90)
**Issue**: Card uses shadcn `<Card>` component with default styling. Mockup card has specific padding (44px 40px 40px), border-radius 16px, and a hover shadow effect (`box-shadow: 0 12px 40px rgba(0,0,0,0.06)` on hover).
**Expected**: Tighter match to mockup card styling with hover effect.
**Fix**: Add custom classes to the Card component: `class="p-10 rounded-2xl hover:shadow-lg transition-shadow"`.

---

## [LOGIN PAGE — Input Styling] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: Input fields use shadcn `<Input>` with rounded-full (pill) styling. Mockup inputs have `border-radius: 8px` (rounded-lg, not pill). Inputs also have focus ring using `box-shadow: 0 0 0 3px rgba(37,99,235,0.12)` which may differ from shadcn defaults.
**Expected**: `border-radius: 8px` inputs with blue focus ring.
**Fix**: Override Input border-radius to `rounded-lg` and verify focus ring matches mockup.

---

## [LOGIN PAGE — Color Mismatch] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The mockup uses `--accent: #2563eb` (blue-600) while the design system in CLAUDE.md specifies `#3B82F6` (blue-500). The primary button color differs slightly.
**Expected**: The mockup's blue (#2563eb) is darker than the design system blue (#3B82F6). Need to align on one.
**Fix**: Either update the app's primary color to match the mockup (#2563eb), or keep the design system color (#3B82F6). Recommend matching the mockup since it's the approved design.

---

## [LOGIN PAGE — Font] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte` / `frontend/src/app.css`
**Issue**: The mockup explicitly loads Inter font from Google Fonts. The app may be using the system font stack from Tailwind defaults instead of explicitly loading Inter.
**Expected**: Inter font family loaded and used consistently.
**Fix**: Verify Inter is loaded in `app.html` or `app.css`. If not, add `<link>` to Google Fonts in `app.html`.

---

## [LOGIN PAGE — Success State] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The mockup includes a success overlay panel with a green checkmark icon, "Connexion réussie" title, and "Redirection vers votre tableau de bord..." text. The app redirects immediately via `goto()` without showing this success state.
**Expected**: Brief success animation before redirect.
**Fix**: Add a success state that shows for ~1s before redirecting.

---

## [LOGIN PAGE — Error State Styling] — MEDIUM
**File**: `frontend/src/routes/login/+page.svelte` (line 144)
**Issue**: Error uses plain `<p class="text-sm text-destructive">`. The mockup shows a styled error box with red background (#fef2f2), red border (#fecaca), error icon (X in circle), and 13px text.
**Expected**: Styled error banner matching mockup design.
**Fix**: Replace the plain `<p>` with a styled alert box matching mockup.

---

## LOW ISSUES

---

## [LOGIN PAGE — Button Icon] — LOW
**File**: `frontend/src/routes/login/+page.svelte` (line 151)
**Issue**: The "Se connecter" button uses a `LogIn` lucide icon (arrow-right-to-bracket). The mockup uses a login/door icon (arrow pointing right through door). Both are similar but slightly different SVG paths.
**Expected**: Exact SVG match with mockup icon.
**Fix**: Minor — either icon works, but for pixel-perfect match, use the exact SVG from mockup.

---

## [LOGIN PAGE — Animation] — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: The mockup includes staggered fade-up animations (`fadeUp`, `fadeUpStagger`) with different delays for brand, section label, form area, Google button, and hint text. The app likely renders everything at once.
**Expected**: Smooth staggered entrance animation.
**Fix**: Add staggered CSS animations matching mockup timing.

---

## [LOGIN PAGE — Hint Text] — LOW
**File**: `frontend/src/routes/login/+page.svelte`
**Issue**: No hint text below the login button. Mockup shows: "Accès pour les équipes et les clients avec leurs identifiants" with an info icon.
**Expected**: Small gray hint text with info (i) icon below the submit button.
**Fix**: Add hint paragraph after the submit button.

---

## PAGES NOT AUDITABLE (due to auth redirect bug)

The following pages could NOT be compared to their mockups because they all redirect to login. Once the auth bug is fixed, a second audit pass is needed:

| Page | Mockup Folder | Status |
|------|--------------|--------|
| Dashboard | `maquette-admin-dashboard-24fev26` (v latest, R009 feedback) | NOT AUDITABLE |
| Dashboard (collapsed) | Same as above | NOT AUDITABLE |
| Projects list | No dedicated mockup — part of project-detail flow | NOT AUDITABLE |
| Project detail | `maquette-project-detail-24fev26` | NOT AUDITABLE |
| Tree view | `maquette-tree-view-24fev26` (R003 feedback) | NOT AUDITABLE |
| Analytics | `maquette-analytics-24fev26` (R005 feedback) | NOT AUDITABLE |
| Invitations | `maquette-invitation-clients-24fev26` (R005 feedback) | NOT AUDITABLE |
| Users | No dedicated mockup | NOT AUDITABLE |
| Obfuscation | `maquette-obfuscation-24fev26` (R001 feedback) | NOT AUDITABLE |
| Update requests | No dedicated mockup — inside project-detail | NOT AUDITABLE |
| Command palette | `maquette-command-palette-24fev26` (R003 feedback) | NOT AUDITABLE |
| Page editor | `maquette-page-editor-25fev26` (R004 feedback) | NOT AUDITABLE |
| Demo viewer | `maquette-demo-viewer-24fev26` (R002 feedback) | NOT AUDITABLE |
| Commercial viewer | `maquette-commercial-viewer-24fev26` (R010 feedback) | NOT AUDITABLE |

---

## Summary

TOTAL_ISSUES: 19
CRITICAL: 2
HIGH: 8
MEDIUM: 6
LOW: 3

**Priority action items:**
1. **Fix the auth guard race condition** (CRITICAL) — this unblocks ALL other page audits
2. **Fix the test harness** (CRITICAL) — so screenshots actually capture admin pages
3. **Rewrite login page** (HIGH x8) — the login page structure fundamentally differs from the mockup (tabs vs unified form, missing elements, wrong branding)
4. **Re-run screenshots** after fixes, then audit all admin pages against their mockups
