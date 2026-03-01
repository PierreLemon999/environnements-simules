# Extension — Chrome Manifest V3 + Svelte

## Structure

```
src/
├── background/service-worker.ts    # Message handler (27 types), orchestration capture
├── content/
│   ├── content-script.ts           # Capture du DOM dans le contexte de la page
│   └── capture-hooks.ts            # Hooks injectés dans le MAIN world
├── popup/
│   ├── App.svelte                  # Router principal
│   ├── LoginView.svelte            # Auth extension
│   ├── MainView.svelte             # Interface de capture
│   ├── AutoCapturePanel.svelte     # Config crawl automatique
│   ├── GuidedCapturePanel.svelte   # UI capture guidée
│   ├── CreateProjectModal.svelte   # Création de projet
│   ├── ProjectDropdown.svelte      # Sélecteur de projet
│   ├── VersionDropdown.svelte      # Sélecteur de version
│   └── PageItem.svelte             # Item dans la liste des pages capturées
├── sidepanel/                      # Side panel Chrome (réutilise popup App.svelte)
└── lib/
    ├── api.ts                      # Client HTTP backend + reportError (auto-report 5xx/network)
    ├── auth.ts                     # Token management (chrome.storage.local)
    ├── capture.ts                  # Capture DOM : inline CSS, images base64, nettoyage
    ├── auto-capture.ts             # BFS crawling avec zones d'intérêt
    ├── guided-orchestrator.ts      # Orchestration capture guidée (auto/manual)
    ├── resource-fetcher.ts         # Téléchargement et inlining de ressources externes
    ├── modal-detector.ts           # Détection de modales/overlays
    ├── dom-fingerprint.ts          # Empreinte DOM pour déduplication
    ├── transition-tracker.ts       # Tracking des transitions SPA
    ├── context.ts                  # Contexte de capture partagé
    ├── constants.ts                # STORAGE_KEYS, PAGE_STATUS, types
    └── uuid.ts                     # Génération UUID v4

## Protocole de messages (popup ↔ service worker)

CAPTURE_PAGE, CAPTURE_PAGE_WITH_MODALS, GET_CAPTURE_STATE,
SET_CAPTURE_MODE, SET_CAPTURE_STRATEGY, PAUSE_CAPTURE, RESUME_CAPTURE,
START_AUTO_CRAWL, STOP_AUTO_CRAWL, GET_AUTO_CONFIG, SAVE_AUTO_CONFIG,
START_GUIDED_CAPTURE, STOP_GUIDED_CAPTURE,
REMOVE_PAGE, RECAPTURE_PAGE, DELETE_BACKEND_PAGE,
GET_PROJECTS, GET_VERSIONS, CREATE_PROJECT, CREATE_VERSION,
CREATE_CAPTURE_JOB, UPDATE_CAPTURE_JOB,
DETECT_LL_PLAYER, SCAN_LL_GUIDES, BUBBLE_CHANGED,
CHECK_AUTH, LOGOUT

## Stockage (chrome.storage.local)

- AUTH_TOKEN, USER, ACTIVE_PROJECT, ACTIVE_VERSION
- CAPTURE_STATE: { mode, isPaused, pages[], jobId?, targetPageCount }
- AUTO_CONFIG: { startUrl, maxDepth, blacklist, interestZones[] }

## Cycle de capture

1. Popup envoie CAPTURE_PAGE avec tabId
2. Service worker exécute captureCurrentPage() via chrome.scripting
3. content-script clone le DOM, inline CSS, convertit images en base64, retire scripts
4. Upload vers POST /api/versions/:id/pages (multipart FormData)
5. Mise à jour de l'état local

## Token refresh

Alarm Chrome toutes les 30 min → POST /api/auth/verify → refresh si valide
```

## Dev Auto-Reload (IMPORTANT — ne pas casser)

L'extension se recharge automatiquement quand du code change pendant `npm run dev`.

**3 pièces interdépendantes :**

| Pièce | Fichier | Rôle |
|-------|---------|------|
| Vite plugin | `scripts/reload-plugin.ts` | Serveur HTTP sur port **38587**, met à jour un timestamp après chaque rebuild |
| Service worker | `service-worker.ts` (fin du fichier) | Poll `http://127.0.0.1:38587` toutes les 1.5s, appelle `chrome.runtime.reload()` si timestamp change |
| Config Vite | `vite.config.ts` | `emptyOutDir: false` + **pas de hash** dans `chunkFileNames` en dev |

**Pourquoi c'est fragile — NE PAS MODIFIER :**
- `emptyOutDir` DOIT être `false` en dev : sinon dist/ est vidé entre les rebuilds → Chrome désactive le service worker (status code 15)
- `chunkFileNames` DOIT être `shared/[name].js` (sans `[hash]`) en dev : sinon le SW importe un chunk qui n'existe plus après rebuild → crash
- Le port **38587** est hardcodé dans le plugin ET le service worker — changer l'un sans l'autre casse le reload
- On utilise HTTP (pas un fichier chrome-extension://) car Chrome cache agressivement les fichiers d'extension

**Usage :** `npm run dev` → charger `dist/` comme extension non empaquetée → chaque save recharge l'extension (~1.5s)

## Versioning (OBLIGATOIRE)

**Source de vérité** : `public/manifest.json` → version synchronisée dans `package.json`.

### Règles

- **Chaque modification de l'extension DOIT incrémenter la version** :
  - `patch` (0.3.0 → 0.3.1) : bugfix, ajustement UI, refacto interne
  - `minor` (0.3.x → 0.4.0) : nouvelle fonctionnalité, nouveau message handler, changement d'API
  - `major` (0.x.y → 1.0.0) : breaking change, refonte majeure
- **Les deux fichiers doivent rester synchronisés** (manifest.json ET package.json)
- Le script `scripts/bump-version.ts` gère l'incrément automatique
- Le build prod (`npm run build`) auto-incrémente le patch via `prebuild`
- Le dev (`npm run dev`) n'incrémente PAS

### Commandes

```bash
npm run bump            # patch: 0.3.0 → 0.3.1
npm run bump:minor      # minor: 0.3.x → 0.4.0
npm run bump:major      # major: 0.x.y → 1.0.0
npm run build           # auto-bump patch + build
```

### Affichage

- La version est injectée au build via `__APP_VERSION__` (Vite `define`)
- Déclaration TS : `src/globals.d.ts`
- Affichée dans le header du popup : "Lemon Lab v0.3.0" (petit, grisé)
