---
paths:
  - "backend/src/routes/users.ts"
  - "backend/src/routes/assignments.ts"
  - "backend/src/routes/obfuscation.ts"
  - "backend/src/routes/update-requests.ts"
  - "backend/src/routes/analytics.ts"
  - "backend/src/routes/auth.ts"
  - "backend/src/routes/settings.ts"
  - "backend/src/routes/error-logs.ts"
  - "backend/src/services/error-logger.ts"
  - "frontend/src/routes/admin/users/**"
  - "frontend/src/routes/admin/invitations/**"
  - "frontend/src/routes/admin/obfuscation/**"
  - "frontend/src/routes/admin/update-requests/**"
  - "frontend/src/routes/admin/analytics/**"
  - "frontend/src/routes/admin/settings/**"
  - "frontend/src/routes/admin/error-logs/**"
  - "frontend/src/routes/login/**"
  - "frontend/src/lib/stores/auth.ts"
---

# Domaine : Administration & Gestion

Gestion des utilisateurs, invitations de prospects, règles d'obfuscation, analytics de consultation, demandes de mise à jour, et authentification.

## Périmètre fichiers

### Backend
- `routes/auth.ts` (327 LOC) — Login, Google SSO, verify JWT, demo-access
- `routes/users.ts` (322 LOC) — CRUD utilisateurs (admin only)
- `routes/assignments.ts` (209 LOC) — Tokens d'accès démo pour prospects
- `routes/obfuscation.ts` (247 LOC) — Règles CRUD + preview
- `routes/analytics.ts` (433 LOC) — Sessions, events, guides, overview
- `routes/update-requests.ts` (155 LOC) — Demandes de MAJ workflow
- `routes/settings.ts` (75 LOC) — Paramètres application
- `routes/error-logs.ts` (160 LOC) — Report, list, stats, delete logs d'erreurs
- `services/error-logger.ts` — Logging erreurs en DB, cleanup lazy 6 mois
- `middleware/auth.ts` — JWT verify, signToken(), authenticate()
- `middleware/roles.ts` — requireRole('admin'|'client')

### Frontend
- `routes/login/` — Page de connexion (email/password + Google SSO)
- `routes/admin/users/` — Gestion utilisateurs
- `routes/admin/invitations/` — Création tokens d'accès démo
- `routes/admin/obfuscation/` — Éditeur de règles par projet
- `routes/admin/analytics/` — Dashboard sessions + guides
- `routes/admin/update-requests/` — Workflow demandes MAJ
- `routes/admin/settings/` — Paramètres globaux
- `routes/admin/error-logs/` — Backlog d'erreurs (table + stats + filtres)
- `lib/stores/auth.ts` — Stores Svelte : user, token, isAuthenticated

## Tables DB impliquées

- `users` (id, email, name, role, passwordHash, googleId, company, avatarUrl, extensionVersion, language, createdAt)
- `demoAssignments` (id, versionId, userId (FK→users), accessToken, passwordHash, expiresAt, createdAt)
- `obfuscationRules` (id, projectId, searchTerm, replaceTerm, isRegex, isActive, createdAt)
- `sessions` (id, userId, assignmentId, versionId, ipAddress, userAgent, startedAt, endedAt)
- `sessionEvents` (id, sessionId, pageId, eventType, metadata, timestamp, durationSeconds)
- `updateRequests` (id, pageId, requestedBy, comment, status, createdAt, resolvedAt)
- `errorLogs` (id, source, level, message, stack, endpoint, method, statusCode, userId, userAgent, metadata, createdAt)

## Flux d'authentification

```
Admin (Google SSO):
  Frontend → POST /api/auth/google { idToken }
  Backend → Vérifie le token Google via google-auth-library
  → Auto-provisionne si domaine @lemonlearning.com/.fr ou @goldfuchs-software.de
  → Crée user admin si premier login, met à jour avatarUrl/name sinon
  → Signe JWT { userId, email, role, name } (expiration: 7 jours)
  → Retourne { data: { token, user } }
  → Frontend stocke dans localStorage + stores Svelte

  Dev bypass (NODE_ENV !== 'production'):
    POST /api/auth/google { devBypass: true, email, name, googleId }
    → Pas de vérification Google, trust les champs fournis

Client (email/password):
  Frontend → POST /api/auth/login { email, password }
  Backend → bcrypt.compare → JWT
  → Même flow JWT que SSO

Prospect (token d'accès):
  POST /api/auth/demo-access { accessToken, password }
  → Vérifie demoAssignment.accessToken + password + expiresAt
  → JWT avec role: 'client'

Vérification au chargement:
  +layout.svelte → loadFromStorage() → POST /api/auth/verify { token, extensionVersion? }
  → Si valide : hydrate stores (inclut avatarUrl depuis DB). Si invalide : logout.
  → Si extensionVersion fourni : stocké en DB pour l'utilisateur.
```

## Obfuscation

- Règles par projet, appliquées au serve-time (pas au stockage)
- Support texte brut et regex
- Preview : POST /api/projects/:id/obfuscation/preview { html, rules[] }
- Ordre d'application : par date de création (createdAt)

## Analytics

- Session créée quand un prospect accède à /demo/*
- Events trackés : page_view, click, guide_start, guide_complete
- Dashboard admin : overview agrégé + sessions filtrables + détail par session
- Stats guides : taux de complétion, temps moyen

## Endpoints API

**Auth:**
- `POST /api/auth/login` — Login client
- `POST /api/auth/google` — SSO admin (+ dev bypass)
- `POST /api/auth/demo-access` — Accès prospect
- `POST /api/auth/verify` — Vérifier JWT + stocker extensionVersion

**Users:** `GET/POST/PUT/DELETE /api/users` (admin only)

**Invitations:**
- `GET/POST/DELETE /api/versions/:id/assignments`

**Obfuscation:**
- `GET/POST/PUT/DELETE /api/projects/:id/obfuscation`
- `POST /api/projects/:id/obfuscation/preview`

**Analytics:**
- `GET /api/analytics/overview` — Stats agrégées
- `GET /api/analytics/sessions` — Sessions filtrables
- `GET /api/analytics/sessions/:id` — Détail session
- `GET /api/analytics/guides` — Stats guides
- `POST /api/analytics/events` — Enregistrer event (public, pas d'auth)

**Update requests:**
- `POST /api/pages/:id/update-request`
- `GET/PUT /api/update-requests`

**Settings:**
- `GET/PUT /api/settings` — Paramètres globaux

**Error logs:**
- `POST /api/error-logs/report` — Report erreur (frontend/extension, auth requise)
- `GET /api/error-logs` — Liste paginée + filtres (admin only)
- `GET /api/error-logs/stats` — Stats 24h/7j/par source (admin only)
- `DELETE /api/error-logs/:id` — Supprimer un log (admin only)
