---
paths:
  - "backend/src/middleware/**"
  - "backend/src/routes/auth.ts"
  - "frontend/src/lib/stores/auth.ts"
  - "frontend/src/routes/login/**"
  - "extension/src/lib/auth.ts"
---

# Authentification — JWT + Google SSO + Email/Password

## Flux par type d'utilisateur

### Admin (Google SSO)
```
Frontend POST /api/auth/google { credential: "google-token" }
  → Backend vérifie le token Google (mock en dev: accepte tout)
  → Crée le user si premier login (role: 'admin')
  → Signe JWT { userId, email, role, name } (expiration: 7 jours)
  → Retourne { data: { token, user } }
  → Frontend: localStorage.setItem('auth_token', token)
  → Frontend: stores auth.ts mis à jour
```

### Client (email/password)
```
Frontend POST /api/auth/login { email, password }
  → Backend: bcrypt.compare(password, user.passwordHash)
  → Même flow JWT que SSO
```

### Prospect (token d'invitation)
```
POST /api/auth/demo-access { token, password }
  → Backend: vérifie demoAssignment.token + password + expiresAt
  → JWT limité avec role: 'client'
```

## Vérification au chargement

```
+layout.svelte onMount()
  → auth.loadFromStorage()
  → Lit localStorage['auth_token']
  → POST /api/auth/verify { token }
  → Si 200: hydrate user + token stores
  → Si 401: logout() → clear stores + localStorage
```

## Backend middleware

```typescript
// middleware/auth.ts
authenticate()      // Extrait JWT du header, vérifie, peuple req.user
signToken(payload)  // Signe un JWT (secret: process.env.JWT_SECRET || 'dev-secret')

// middleware/roles.ts
requireRole('admin')   // 403 si req.user.role !== 'admin'
requireRole('client')  // 403 si req.user.role !== 'client'

// Usage dans les routes:
router.get('/users', authenticate(), requireRole('admin'), handler)
```

## Extension Chrome

```
chrome.storage.local['AUTH_TOKEN'] (pas localStorage)
  → lib/auth.ts: verifyToken() → POST /api/auth/verify
  → Alarm Chrome toutes les 30 min pour refresh
  → lib/api.ts injecte le token dans les requêtes vers le backend
```

## Points d'attention

- JWT secret en dev: 'dev-secret' — à configurer en prod via JWT_SECRET env var
- Pas de refresh token: le JWT dure 7 jours, renouvelé via /verify
- Google SSO en dev: mock endpoint qui accepte n'importe quel credential
- Les endpoints publics (/demo/*, /analytics/events) n'utilisent PAS authenticate()
