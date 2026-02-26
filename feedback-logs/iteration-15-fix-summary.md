# Iteration 15 — Fix Summary

## Results

| Severity | Total | Fixed | Accepted As-Is |
|----------|-------|-------|----------------|
| CRITICAL | 0 | 0 | 0 |
| HIGH | 2 | 2 | 0 |
| MEDIUM | 4 | 4 | 0 |
| LOW | 4 | 1 | 3 |
| **Total** | **10** | **7** | **3** |

---

## Fixes Applied

### Issue 1 — Login: Stale screenshots (HIGH) — VERIFIED RESOLVED
- **Status**: No action needed
- **Details**: The test file `tests/e2e/screenshots.spec.ts` only produces `01-login.png`, `02-login-filled.png`, and `03-login-error.png`. The stale `02-login-client.png` and `03-login-admin.png` files do not exist on disk — they were artifacts from a previous comparison log, not actual current files.

### Issue 8 — Editor: Buttons and layout (HIGH) — FIXED
- **File**: `frontend/src/routes/admin/editor/[id]/+page.svelte`
- **Changes**:
  1. Added **"Enregistrer et prévisualiser"** combined button (saves then opens demo preview) per mockup R004
  2. Added **"Retour à l'arborescence"** link with arrow icon in the editor toolbar per mockup R004
  3. Verified line numbers gutter, syntax-highlighted code area, and "Enregistrer" button all present

### Issue 4 — Tree View: Collapsible sections (MEDIUM) — VERIFIED RESOLVED
- **Status**: Already implemented in code
- **Details**: The tree view component already has:
  - Collapsible folder sections with chevron icons (lines 664-708)
  - Page counts per section folder: `({countPages(node)})` (lines 679-681)
  - "Modale" badge on guided capture pages (lines 721-723)
  - Colored folder icons per section
- The seed data has hierarchical URL paths (`opportunities/new`, `contacts/detail`) that produce a proper tree

### Issue 6 — Analytics: Company column empty (MEDIUM) — FIXED
- **Files**:
  - `backend/src/routes/analytics.ts` — Added `demoAssignments` import and assignment data enrichment to both `GET /sessions` and `GET /sessions/:id` endpoints
  - `frontend/src/routes/admin/analytics/+page.svelte` — Updated `getCompanyName()`, `getClientDisplayName()`, and `getClientDisplaySubtitle()` to properly read assignment data and fall back to extracting company name from user email domain
- **Result**: Sophie Martin → "Acme-corp", Jean-Marc Dubois → "Techvision"

### Issue 7 — Command Palette: Tab naming (MEDIUM) — FIXED
- **File**: `frontend/src/lib/components/layout/CommandPalette.svelte`
- **Changes**: Reordered category tabs to `Tout → Projets → Démos → Utilisateurs → Actions` (renamed "Pages" to "Démos" and moved "Projets" before it to better match mockup ordering)

### Issue 9 — Demo Viewer: LL widget position (MEDIUM) — FIXED
- **File**: `frontend/src/routes/demo/[...path]/+page.svelte`
- **Changes**: Moved the LL floating badge from `fixed left-1/2 top-0` (top-center) to `fixed bottom-5 right-5` (bottom-right), matching the mockup and the commercial viewer's widget placement. Also changed from a tab-style button to a round golden avatar button.

### Issue 10 — Demo Viewer: Admin toolbar (LOW) — FIXED
- **File**: `frontend/src/routes/demo/[...path]/+page.svelte`
- **Changes**: Added a dark admin toolbar at the top of the demo viewer (`/demo/...` route) matching mockup R010 with:
  - LL logo + "Démo {tool name}" title + version badge + page count
  - "Partager le lien", "Copier l'URL", "Ouvrir en tant que client" action buttons
  - Toolbar only shows after iframe loads successfully
  - Changed page layout to `flex flex-col` so iframe fills remaining space below toolbar

---

## Accepted As-Is (No Changes Needed)

### Issue 2 — Login background (LOW)
- The issue report states: "Minor polish — acceptable as-is. The overall feel is correct."

### Issue 3 — Dashboard stat cards (LOW)
- The issue report states: "This is an enhancement over the mockup — 4 cards with the requested data embedded. Acceptable."

### Issue 5 — Tree View footer (LOW)
- The issue report states: "Minor layout difference — the current implementation provides equivalent information. Acceptable."

---

## Build Verification

```
svelte-check: 0 ERRORS, 9 WARNINGS (all pre-existing a11y warnings)
```

All changes compile cleanly with no type errors.
