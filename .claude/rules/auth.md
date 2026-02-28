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
Frontend POST /api/auth/google { idToken }
  → Backend vérifie le token via google-auth-library (OAuth2Client.verifyIdToken)
  → Auto-provisionne si domaine autorisé :
    @lemonlearning.com, @lemonlearning.fr, @goldfuchs-software.de
  → Premier login : crée user admin avec avatarUrl et name du profil Google
  → Login suivant : met à jour avatarUrl et name si changés
  → Signe JWT { userId, email, role, name } (expiration: 7 jours)
  → Retourne { data: { token, user: { id, name, email, role, avatarUrl, language } } }
  → Frontend: localStorage.setItem('auth_token', token)
  → Frontend: stores auth.ts mis à jour

Dev bypass (NODE_ENV !== 'production'):
  POST /api/auth/google { devBypass: true, email, name, googleId, avatarUrl? }
  → Pas de vérification Google, trust les champs fournis
  → Même auto-provisionnement et même réponse
```

### Client (email/password)
```
Frontend POST /api/auth/login { email, password }
  → Backend: bcrypt.compare(password, user.passwordHash)
  → Admins refusés sur cet endpoint (Google SSO obligatoire)
  → Même flow JWT que SSO
```

### Prospect (token d'accès)
```
POST /api/auth/demo-access { accessToken, password }
  → Backend: vérifie demoAssignment.accessToken + bcrypt(password) + expiresAt
  → JWT avec role: 'client'
  → Retourne aussi versionId et expiresAt
```

## Vérification au chargement

```
+layout.svelte onMount()
  → auth.loadFromStorage()
  → Lit localStorage['auth_token']
  → POST /api/auth/verify { token, extensionVersion? }
  → Backend: décode JWT + fetch user complet depuis DB (pour avatarUrl)
  → Si extensionVersion fourni : UPDATE users SET extension_version
  → Si 200 + valid: hydrate user + token stores (avec avatarUrl)
  → Si invalid: logout() → clear stores + localStorage
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
  → lib/auth.ts: verifyToken() → POST /api/auth/verify { token, extensionVersion }
  → extensionVersion = chrome.runtime.getManifest().version (envoyé à chaque verify)
  → Alarm Chrome toutes les 30 min pour refresh
  → lib/api.ts injecte le token dans les requêtes vers le backend
```

## Points d'attention

- JWT secret en dev: 'dev-secret' — à configurer en prod via JWT_SECRET env var
- Pas de refresh token: le JWT dure 7 jours, renouvelé via /verify
- Google SSO: vérification réelle via google-auth-library + GOOGLE_CLIENT_ID env var
- Dev bypass disponible quand NODE_ENV !== 'production'
- Les endpoints publics (/demo/*, /analytics/events) n'utilisent PAS authenticate()
- avatarUrl récupéré du profil Google et persisté en DB, retourné via /verify
- extensionVersion stocké en DB via /verify pour tracking dans le backoffice
