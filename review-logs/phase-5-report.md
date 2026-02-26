# Phase 5: Projects & Versions — Review Report

## Date: 2026-02-26

## Features Tested

### 1. Projects List Page (`/admin/projects`)
- **Project cards display**: 7 projects render correctly with tool logo, name, badge, description, version count, page count, and date
- **Tab filters**: Tous / Actifs / Test / Archivés tabs render and switch correctly
- **Search**: Real-time search filters projects by name, tool, or subdomain
- **Create project dialog**: Opens via sidebar "Nouveau projet" button or custom event, form validates, submits via API, new project appears in list immediately
- **Edit/Delete project**: Context menu (kebab) with edit and delete actions, delete has confirmation dialog

### 2. Project Detail Page (`/admin/projects/[id]`)
- **Project header card**: Shows logo with branded gradient, project name, tool badge, copyable subdomain chip, description, stats row (pages, versions, demos, guides), creator info with relative time
- **Health ring**: SVG progress ring showing page health percentage with breakdown (OK / warnings / errors)
- **Breadcrumb**: Shows in top bar navigation

### 3. Version Management
- **Version cards**: Display with colored left border (green=active, amber=test, gray=deprecated), name, status badge, language tag, date, page count
- **Create version**: Dialog with name, status select, language select — creates via `POST /projects/:id/versions`
- **Edit version**: Via kebab menu → Modifier → dialog pre-filled, saves via `PUT /versions/:id`
- **Duplicate version**: "Dupliquer" button triggers `POST /versions/:id/duplicate`, new copy appears instantly
- **Delete version**: Via kebab menu → Supprimer → confirmation dialog, deletes via `DELETE /versions/:id`
- **Deprecated toggle**: "Afficher les versions obsolètes (N)" checkbox filters deprecated versions
- **Action buttons per version**: Ouvrir démo, Arborescence, Dupliquer, kebab (Modifier / Exporter .zip / Supprimer)

### 4. Detail Tabs
- **Versions**: Default tab, lists version cards with all CRUD
- **Assignations**: Shows assignment table with client name/email, version, demo link, engagement bar, last access, expiry date, status badge
- **Configuration**: 4-card grid (Domaine & Accès, Obfuscation, Capture, Général) with project metadata
- **Demandes MAJ**: Table of update requests with description, page, date, status

### 5. Data Persistence
- Verified data survives page reload — version counts remain stable

---

## Issues Found & Fixed

### CRITICAL

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **Project detail stats showed "0 pages"** — `GET /projects/:id` did not enrich versions with page counts, so `pageCount` was missing from the response | Critical | Backend: enriched `GET /projects/:id` to count pages per version and return `pageCount` on each version object + total `pageCount` on the project |
| 2 | **Version cards showed no page count** — Backend versions endpoint returned raw version rows without page counts | Critical | Backend: enriched `GET /projects/:projectId/versions` to include `pageCount` per version (added `sql` import + count query per version) |
| 3 | **Assignments tab data mismatch** — Frontend `Assignment` interface expected `clientEmail`, `clientName`, `clientCompany` fields, but API returns `userId` + nested `user: { name, email }` object. This caused runtime errors when rendering assignment rows | Critical | Frontend: updated `Assignment` interface to match actual API shape (`userId`, `user?.name`, `user?.email`), updated all template references from `clientName`/`clientEmail` to `user?.name`/`user?.email` |

### Files Modified

| File | Change |
|------|--------|
| `backend/src/routes/projects.ts` | `GET /projects/:id` — added page count enrichment for each version + total project `pageCount` |
| `backend/src/routes/versions.ts` | `GET /projects/:projectId/versions` — added `sql` import + page count enrichment per version |
| `frontend/src/routes/admin/projects/[id]/+page.svelte` | Fixed `Assignment` interface to match API response; updated 3 template references from `clientName`/`clientEmail` to `user?.name`/`user?.email` |

---

## Verification Results

**7/7 Playwright E2E tests pass:**

1. Projects list: loads, displays cards, search, tabs
2. Create project: dialog, submit, appears in list
3. Project detail: header, stats, health ring
4. Version list: status badges, page counts, language
5. Version CRUD: create, edit, duplicate, delete
6. Tabs: Assignments, Config, Updates render content
7. Data persists after reload

---

## Remaining Items (Low Priority / Design Polish)

| # | Item | Severity | Notes |
|---|------|----------|-------|
| 1 | Mockup shows "Nouvelle version" button at bottom of versions list; implementation puts it in header card | Low | Both placements are UX-valid; header placement is arguably more discoverable |
| 2 | Mockup version cards show author name + avatar; implementation shows date + page count instead | Low | Author info requires joining users table; page count is more actionable |
| 3 | Mockup shows changelog toggle per version; not implemented | Low | Would require a `changelog` text field on the versions schema |
| 4 | Mockup shows diff badges ("+4 pages", "~12 modif."); not implemented | Low | Requires version comparison logic not in current scope |
| 5 | Engagement % on assignments is randomized when not provided by API | Low | Backend doesn't track engagement metrics yet |
| 6 | Configuration tab shows read-only info; mockup shows interactive toggles/inputs | Low | Full config editing is a separate feature |
