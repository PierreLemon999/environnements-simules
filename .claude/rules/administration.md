---
paths:
  - "backend/src/routes/users.ts"
  - "backend/src/routes/assignments.ts"
  - "backend/src/routes/obfuscation.ts"
  - "backend/src/routes/update-requests.ts"
  - "backend/src/routes/analytics.ts"
  - "backend/src/routes/auth.ts"
  - "frontend/src/routes/admin/users/**"
  - "frontend/src/routes/admin/invitations/**"
  - "frontend/src/routes/admin/obfuscation/**"
  - "frontend/src/routes/admin/update-requests/**"
  - "frontend/src/routes/admin/analytics/**"
  - "frontend/src/routes/login/**"
  - "frontend/src/lib/stores/auth.ts"
---

# Domaine : Administration & Gestion

Gestion des utilisateurs, invitations de prospects, règles d'obfuscation, analytics de consultation, demandes de mise à jour, et authentification.

## Périmètre fichiers

### Backend
- `routes/auth.ts` (246 LOC) — Login, Google SSO, verify JWT, demo-access
- `routes/users.ts` (206 LOC) — CRUD utilisateurs (admin only)
- `routes/assignments.ts` (204 LOC) — Tokens d'accès démo pour prospects
- `routes/obfuscation.ts` (234 LOC) — Règles CRUD + preview
- `routes/analytics.ts` (385 LOC) — Sessions, events, guides, overview
- `routes/update-requests.ts` (154 LOC) — Demandes de MAJ workflow
- `middleware/auth.ts` — JWT verify, signToken(), authenticate()
- `middleware/roles.ts` — requireRole('admin'|'client')

### Frontend
- `routes/login/` — Page de connexion (email/password + Google SSO)
- `routes/admin/users/` — Gestion utilisateurs
- `routes/admin/invitations/` — Création tokens d'accès démo
- `routes/admin/obfuscation/` — Éditeur de règles par projet
- `routes/admin/analytics/` — Dashboard sessions + guides
- `routes/admin/update-requests/` — Workflow demandes MAJ
- `lib/stores/auth.ts` — Stores Svelte : user, token, isAuthenticated

## Tables DB impliquées

- `users` (id, email, name, role, passwordHash, googleId, createdAt)
- `demoAssignments` (id, versionId, recipientEmail, recipientName, company, token, password, expiresAt)
- `obfuscationRules` (id, projectId, searchTerm, replaceTerm, isRegex, isActive, order)
- `sessions` (id, assignmentId, ipAddress, userAgent, startedAt, lastActivityAt)
- `sessionEvents` (id, sessionId, pageId, eventType, metadata, createdAt)
- `updateRequests` (id, pageId, requestedBy, description, status, createdAt, resolvedAt)

## Flux d'authentification

```
Admin (Google SSO):
  Frontend → POST /api/auth/google { credential }
  Backend → Vérifie token Google (mock en dev) → Crée user si premier login
  → Retourne JWT (7 jours) + user object
  → Frontend stocke dans localStorage + stores Svelte

Client (email/password):
  Frontend → POST /api/auth/login { email, password }
  Backend → bcrypt.compare → JWT
  → Même stockage côté frontend

Prospect (token d'accès):
  POST /api/auth/demo-access { token, password }
  → Vérifie assignment non expiré → JWT limité

Vérification au chargement:
  +layout.svelte → loadFromStorage() → POST /api/auth/verify
  → Si valide : hydrate stores. Si invalide : logout.
```

## Obfuscation

- Règles par projet, appliquées au serve-time (pas au stockage)
- Support texte brut et regex
- Preview : POST /api/projects/:id/obfuscation/preview { html, rules[] }
- Ordre d'application : champ `order` dans la table

## Analytics

- Session créée quand un prospect accède à /demo/*
- Events trackés : page_view, click, scroll, guide_start, guide_complete
- Dashboard admin : overview agrégé + sessions filtrables + détail par session
- Stats guides : taux de complétion, temps moyen

## Endpoints API

**Auth:**
- `POST /api/auth/login` — Login client
- `POST /api/auth/google` — SSO admin
- `POST /api/auth/demo-access` — Accès prospect
- `POST /api/auth/verify` — Vérifier JWT

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
