---
paths:
  - "backend/src/routes/demo.ts"
  - "backend/src/services/demo-serving.ts"
  - "backend/src/services/link-rewriter.ts"
  - "backend/src/services/obfuscation.ts"
  - "frontend/src/routes/view/**"
  - "frontend/src/routes/demo/**"
  - "frontend/src/lib/components/demo/**"
---

# Domaine : Player / Serveur de démos

Le système qui sert les pages capturées aux prospects et clients : résolution de projet, obfuscation, réécriture de liens, injection de scripts, et les viewers frontend.

## Périmètre fichiers

### Backend (serving engine)
- `routes/demo.ts` (64 LOC) — Router Express, point d'entrée GET /demo/:subdomain/*
- `services/demo-serving.ts` (179 LOC) — Orchestrateur : project→version→page→transform→serve
- `services/link-rewriter.ts` (108 LOC) — Réécriture des liens internes
- `services/obfuscation.ts` (70 LOC) — Moteur search/replace texte et regex

### Frontend (viewers)
- `routes/view/[...path]/` — Viewer prospect (accès par token, pas de login)
- `routes/demo/[...path]/` — Viewer client authentifié
- `lib/components/demo/` — Toolbar, banners, contrôles du viewer

## Tables DB impliquées

- `projects` (subdomain — clé de résolution)
- `versions` (status='active' — version servie)
- `pages` (urlPath, filePath — page à servir)
- `pageLinks` (liens internes pour la réécriture)
- `obfuscationRules` (règles appliquées au serve-time)
- `tagManagerConfig` (script injecté dans chaque page)
- `sessions` + `sessionEvents` (tracking côté analytics)

## Flux principal : Servir une démo

```
GET /demo/salesforce-demo/accounts/list
  │
  ├─ 1. Résolution projet
  │     SELECT * FROM projects WHERE subdomain = 'salesforce-demo'
  │
  ├─ 2. Version active
  │     SELECT * FROM versions WHERE projectId = ? AND status = 'active'
  │
  ├─ 3. Page par URL
  │     SELECT * FROM pages WHERE versionId = ? AND urlPath = 'accounts/list'
  │
  ├─ 4. Lecture HTML
  │     fs.readFile('/data/uploads/{pageId}/index.html')
  │
  ├─ 5. Obfuscation
  │     Pour chaque règle active du projet (ordonnée) :
  │       - Si isRegex : new RegExp(searchTerm, 'g').replace(html, replaceTerm)
  │       - Sinon : html.replaceAll(searchTerm, replaceTerm)
  │
  ├─ 6. Réécriture liens
  │     Parse HTML → trouve <a href="..."> → résout contre pageLinks
  │     → remplace par /demo/salesforce-demo/{targetUrlPath}
  │     Résultat : tous les liens internes restent dans la démo
  │
  ├─ 7. Injection tag manager
  │     Si tagManagerConfig existe pour ce projet :
  │     → Injecte <script> avant </body>
  │
  └─ 8. Réponse
        Content-Type: text/html
        HTML transformé envoyé au navigateur
```

## Endpoints API

- `GET /api/demo/:subdomain/*` — Servir une page démo (PUBLIC, pas d'auth)
- `POST /api/analytics/events` — Enregistrer un événement de tracking (PUBLIC)

## Viewers frontend

### `/view/[...path]/` (prospect)
- Accès via token d'invitation (demoAssignment)
- Barre d'info en haut avec nom du projet
- Pas de contrôles d'édition

### `/demo/[...path]/` (client authentifié)
- Même rendu mais avec toolbar de navigation
- Peut nécessiter login préalable

## Points d'attention

- Les endpoints de demo sont PUBLICS (pas de middleware auth)
- L'obfuscation est appliquée au serve-time, pas au stockage → le HTML original est préservé
- L'ordre des règles d'obfuscation compte (champ `order`)
- Le link rewriter ne transforme que les liens vers des pages effectivement capturées
- Le tag manager script est injecté dynamiquement, pas stocké dans le HTML
- Performance : chaque requête lit un fichier HTML du disque + applique les transformations
