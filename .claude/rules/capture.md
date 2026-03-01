---
paths:
  - "extension/**"
  - "backend/src/routes/pages.ts"
  - "backend/src/routes/versions.ts"
  - "backend/src/routes/capture-jobs.ts"
  - "backend/src/routes/transitions.ts"
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
- `extension/src/lib/guided-orchestrator.ts` — Orchestration capture guidée (auto/manual)
- `extension/src/lib/resource-fetcher.ts` — Téléchargement et inlining de ressources externes
- `extension/src/lib/modal-detector.ts` — Détection de modales/overlays
- `extension/src/lib/transition-tracker.ts` — Tracking des transitions SPA
- `extension/src/lib/dom-fingerprint.ts` — Empreinte DOM pour déduplication
- `extension/src/lib/context.ts` — Contexte de capture partagé
- `extension/src/background/service-worker.ts` — Orchestration messages
- `extension/src/content/capture-hooks.ts` — Hooks injectés dans le MAIN world
- `extension/src/popup/MainView.svelte` + `AutoCapturePanel.svelte` + `GuidedCapturePanel.svelte` — UI
- `extension/src/popup/CreateProjectModal.svelte` + `ProjectDropdown.svelte` + `VersionDropdown.svelte` — Composants support

### Backend (stockage & gestion)
- `backend/src/routes/pages.ts` (609 LOC) — CRUD pages + upload multipart HTML
- `backend/src/routes/versions.ts` (371 LOC) — Versions CRUD + duplicate + page tree
- `backend/src/routes/capture-jobs.ts` (248 LOC) — Jobs de capture auto
- `backend/src/routes/transitions.ts` (183 LOC) — Transitions entre pages (SPA)

### Frontend (édition & organisation)
- `frontend/src/routes/admin/editor/[id]/` — Éditeur HTML
- `frontend/src/routes/admin/live-edit/[id]/` — Éditeur WYSIWYG
- `frontend/src/routes/admin/projects/[id]/` — Détail projet avec gestion versions

## Tables DB impliquées

- `pages` (id, versionId, urlSource, urlPath, title, filePath, fileSize, captureMode, thumbnailPath, healthStatus, pageType, parentPageId, domFingerprint, syntheticUrl, captureTimingMs, stateIndex, createdAt)
- `pageLinks` (id, sourcePageId, targetPageId, originalHref, rewrittenHref)
- `pageTransitions` (id, versionId, sourcePageId, targetPageId, triggerType, triggerSelector, triggerText, loadingTimeMs, hadLoadingIndicator, captureMode, createdAt)
- `versions` (id, projectId, name, status, language, authorId, captureStrategy, createdAt)
- `captureJobs` (id, versionId, mode, targetPageCount, pagesCaptured, status, config, startedAt, completedAt)
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
  → captureJob tracké côté backend (status: running→paused→done)
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
- `POST /api/versions/:id/transitions` — Enregistrer une transition
- `GET /api/pages/:pageId/transitions` — Transitions d'une page

## Points d'attention

- Upload HTML limité à 50 MB (config multer)
- Les fichiers sont stockés sur disque dans `/data/uploads/{pageId}/`, pas en DB
- La duplication de version copie toutes les pages + pageLinks
- Le status d'une version peut être : active, test, deprecated

## Capture guidée — Références externes (lecture seule)

Pour comprendre le fonctionnement du player Lemon Learning (détection, guides, shadow DOM, API interne) :

- **Code source LL** : `/Users/pierre/Library/Mobile Documents/com~apple~CloudDocs/code/Lemon Learning code/`
  - `front-v2.65/` — Monorepo React (yarn workspaces, `packages/`)
  - `back-dev/` — Backend LL
- **Documentation LL** : `/Users/pierre/Library/Mobile Documents/com~apple~CloudDocs/code/Bienvenue dans la documentation de Lemon Learning /`
  - Export Notion — sections pertinentes : Le player, L'éditeur, Créer des contenus, Mise en place technique

Ces sources sont en **lecture seule** — ne jamais les modifier. Les consulter pour reverse-engineering du player LL et résolution des problèmes de capture guidée (lancement de guide, bubble observer, shadow DOM, etc.).
