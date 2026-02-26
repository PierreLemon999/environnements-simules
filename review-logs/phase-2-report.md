# Phase 2 — Extension Chrome Review Report

**Date**: 2026-02-26
**Reviewer**: Claude (automated)
**Scope**: Chrome Extension (MV3) — popup UI, service worker, content script, capture logic, auto-capture BFS, API client

---

## 1. Build Status

| Metric | Result |
|--------|--------|
| Build | **OK** (694ms) |
| Errors | 0 |
| Warnings | 3 (a11y label association in AutoCapturePanel — non-blocking) |
| Modules | 119 transformed |
| Output size | popup: 202 KB, service-worker: 24 KB, content-script: 3.8 KB |

---

## 2. Backend Endpoints Tested

All endpoints the extension depends on were tested with curl against the running backend (:3001):

| Endpoint | Method | Result |
|----------|--------|--------|
| `/api/auth/google` | POST | OK — returns JWT + user |
| `/api/projects` | GET | OK — returns 3+ projects |
| `/api/projects/:id/versions` | GET | OK — returns versions list |
| `/api/versions/:id/pages` | POST (multipart) | OK — returns `{ id, fileSize }` |
| `/api/versions/:id/pages` | GET | OK — returns pages list |
| `/api/versions/:id/capture-jobs` | POST | OK — creates capture job |
| `/api/capture-jobs/:id` | GET | OK — returns job state |
| `/api/capture-jobs/:id` | PUT | OK — updates job |

---

## 3. Issues Found & Fixed

### 3.1 Critical — API client missing retry logic

**File**: `extension/src/lib/api.ts`
**Problem**: The `request()` function had no retry mechanism. Network errors or 5xx responses would fail immediately. The capture spec requires resilient uploads.
**Fix**: Added retry loop (max 3 attempts) with exponential backoff. 4xx errors (client errors) fail immediately. Network errors and 5xx responses are retried.

### 3.2 Critical — Auto-capture doesn't create backend capture job

**File**: `extension/src/lib/auto-capture.ts`
**Problem**: `startAutoCrawl()` fetched the active version but never called `POST /versions/:id/capture-jobs` to create a capture job on the backend. This meant auto-crawl progress was invisible to the admin dashboard.
**Fix**:
- Added `api.post()` call in `startAutoCrawl()` to create the capture job with mode, targetPageCount, and startUrl
- Store `jobId` in capture state
- After each successful page capture in `crawlLoop()`, update the capture job progress via `api.put()`
- When crawl completes (target reached or stopped), finalize the job with status `done`
- `stopAutoCrawl()` now also finalizes the capture job before clearing state

### 3.3 Critical — Svelte 5 event pattern mismatch

**Files**: `App.svelte`, `LoginView.svelte`, `MainView.svelte`, `PageItem.svelte`, `AutoCapturePanel.svelte`
**Problem**: Components mixed Svelte 4 `createEventDispatcher` + `on:event` syntax with Svelte 5 `$props()` runes. While Svelte 5 has some backwards compatibility, this is fragile and inconsistent.
**Fix**: Migrated all components to the Svelte 5 callback prop pattern:
- `LoginView`: `dispatch('login')` → `onLogin()` callback prop
- `MainView`: `dispatch('logout')` → `onLogout()` callback prop
- `PageItem`: `dispatch('remove')`/`dispatch('recapture')` → `onRemove()`/`onRecapture()` callback props
- `App.svelte`: `on:login={handleLogin}` → `onLogin={handleLogin}`, `on:logout={handleLogout}` → `onLogout={handleLogout}`
- `AutoCapturePanel`: Removed unused `createEventDispatcher` import (already used `onStart` prop correctly)
- Removed `handleLogin(event: CustomEvent<...>)` → `handleLogin(data: { user: User })`

### 3.4 Medium — No iframe handling in DOM capture

**File**: `extension/src/lib/capture.ts`
**Problem**: `capturePageDOM()` cloned the DOM and inlined CSS/images but completely ignored iframes. Same-origin iframes (common in SaaS apps) would render empty in the captured HTML.
**Fix**: Added `inlineIframes()` function that:
- Finds all `<iframe>` elements in the cloned DOM
- For same-origin iframes: captures `contentDocument.documentElement.outerHTML` and sets it as `srcdoc`
- For cross-origin iframes: converts relative `src` to absolute URLs (best effort)

---

## 4. Remaining Issues (Not Fixed)

### 4.1 Low — No network idle detection

**File**: `auto-capture.ts:202`
**Description**: After navigation, the code waits a fixed 1500ms for "DOM stabilization" instead of detecting network idle. This may miss late-loading content on slow pages.
**Recommendation**: Consider using `chrome.webNavigation.onCompleted` or monitoring network requests via `chrome.webRequest` for a more robust idle detection.

### 4.2 Low — A11y warnings in AutoCapturePanel

**File**: `AutoCapturePanel.svelte:71,83,95`
**Description**: Three `<label>` elements are not programmatically associated with their `<input>` controls (missing `for`/`id` pairing).
**Recommendation**: Add `id` attributes to inputs and `for` attributes to labels.

### 4.3 Low — UI differences from latest mockups (v5)

The popup implementation covers core functionality but differs from the latest mockup (v5) in several areas:
- Missing "Nouveau" button next to project selector
- Missing logo/image replacement settings panel
- Missing replace/skip toggle for already-captured pages
- Missing page filter tabs (Toutes / Envoyées / Erreurs)
- Missing keyboard shortcut hints (e.g., Ctrl+Shift+C)
- Missing speed indicator badge
- Missing depth tags display

These are enhancement-level items, not blocking for core capture functionality.

### 4.4 Low — Cross-origin stylesheet inlining is lossy

**File**: `capture.ts:76-79`
**Description**: When a stylesheet is cross-origin and `cssRules` throws, only a comment is inserted. The actual CSS is lost.
**Recommendation**: Could fetch the cross-origin stylesheet URL via `fetch()` and inline the raw CSS text.

---

## 5. Architecture Assessment

### Strengths
- Clean message-passing architecture between popup, service worker, and content script
- Proper state management via `chrome.storage.local` with popup notifications
- Robust BFS crawl algorithm with interest zones, blacklist, and depth multipliers
- Good error handling in capture flow (per-page error isolation)
- Token refresh alarm every 30 minutes

### Areas for Improvement
- The `capturePageDOM()` function runs entirely synchronously in page context — very large DOMs may cause jank
- No deduplication of uploaded pages by URL (same URL can be captured multiple times)
- Auto-capture `simplifyHtml()` is a coarse regex that could break HTML attributes containing `src="data:image/` patterns

---

## 6. Summary

| Category | Count |
|----------|-------|
| Critical issues found & fixed | 3 |
| Medium issues found & fixed | 1 |
| Remaining low-priority issues | 4 |
| Build status | **PASS** |
| Backend endpoints | **8/8 OK** |
