---
paths:
  - "extension/**"
  - "backend/src/routes/pages.ts"
  - "backend/src/routes/versions.ts"
  - "backend/src/routes/capture-jobs.ts"
  - "frontend/src/routes/admin/editor/**"
  - "frontend/src/routes/admin/live-edit/**"
  - "frontend/src/routes/admin/projects/[id]/**"
---

# Domaine : Capture & Édition de pages

Tout ce qui concerne la capture de pages web par l'extension Chrome, leur upload vers le backend, leur organisation en versions, et leur édition dans le back-office.

## Périmètre fichiers

### Extension (source de la capture)
- `extension/src/lib/capture.ts` — Logique de capture DOM (inline CSS, base64 images)
- `extension/src/lib/auto-capture.ts` — Crawl BFS automatique
- `extension/src/lib/guided-capture.ts` — Crawl guidé utilisateur
- `extension/src/background/service-worker.ts` — Orchestration messages
- `extension/src/popup/MainView.svelte` + `AutoCapturePanel.svelte` — UI

### Backend (stockage & gestion)
- `backend/src/routes/pages.ts` (409 LOC) — CRUD pages + upload multipart HTML
- `backend/src/routes/versions.ts` (353 LOC) — Versions CRUD + duplicate + page tree
- `backend/src/routes/capture-jobs.ts` (195 LOC) — Jobs de capture auto

### Frontend (édition & organisation)
- `frontend/src/routes/admin/editor/[id]/` — Éditeur HTML
- `frontend/src/routes/admin/live-edit/[id]/` — Éditeur WYSIWYG
- `frontend/src/routes/admin/projects/[id]/` — Détail projet avec gestion versions

## Tables DB impliquées

- `pages` (id, versionId, title, urlPath, filePath, fileSize, status, capturedAt)
- `pageLinks` (id, sourcePageId, targetPageId, linkUrl, anchorText)
- `versions` (id, projectId, name, status, createdAt)
- `captureJobs` (id, versionId, status, startUrl, maxDepth, pagesFound, pagesCaptured)
- `interestZones` (id, captureJobId, urlPattern, depthMultiplier)

## Flux principal : Capture d'une page

```
Extension popup → CAPTURE_PAGE message → service worker
  → chrome.scripting.executeScript(capturePageDOM)
  → Clone DOM, inline CSS, images→base64, remove scripts
  → FormData { html: Blob, title, url, ... }
  → POST /api/versions/:id/pages (multer multipart)
  → Backend sauvegarde HTML dans /data/uploads/{pageId}/
  → INSERT pages + pageLinks
  → Réponse { id, title, fileSize, ... }
  → Extension met à jour chrome.storage.local
```

## Flux : Auto-crawl

```
Config { startUrl, maxDepth, blacklist, interestZones[] }
  → BFS queue depuis startUrl
  → Pour chaque page : capturer → extraire liens → filtrer → ajouter à la queue
  → interestZones augmentent le depth pour certains URL patterns
  → captureJob tracké côté backend (status: pending→running→done)
```

## Endpoints API

- `POST /api/versions/:id/pages` — Upload page (multipart, auth admin)
- `GET /api/versions/:id/pages` — Lister pages d'une version
- `GET /api/versions/:id/tree` — Arborescence des pages
- `GET/PUT/DELETE /api/pages/:id` — CRUD page individuelle
- `PATCH /api/pages/:id/content` — Modifier le HTML d'une page
- `POST /api/versions/:id/capture-jobs` — Créer un job de capture
- `GET/PUT /api/capture-jobs/:id` — Statut/update du job
- `GET/POST /api/projects/:id/versions` — Lister/créer versions
- `PUT/DELETE /api/versions/:id` — CRUD version
- `POST /api/versions/:id/duplicate` — Dupliquer une version

## Points d'attention

- Upload HTML limité à 50 MB (config multer)
- Les fichiers sont stockés sur disque dans `/data/uploads/{pageId}/`, pas en DB
- La duplication de version copie toutes les pages + pageLinks
- Le status d'une version peut être : draft, active, archived (un seul active par projet)
