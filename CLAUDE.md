# Lemon Lab

Plateforme Lemon Learning : extension Chrome capture des pages SaaS → backend les stocke/sert avec obfuscation → admins gèrent tout → prospects voient les démos.

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | SvelteKit (Svelte 5) + shadcn-svelte (manual, bits-ui) + Tailwind v3 + Lucide |
| Backend | Express.js 5 + TypeScript + Drizzle ORM + better-sqlite3 |
| Extension | Chrome MV3 + Vite + Svelte (popup) |
| Auth | JWT + Google SSO (admins) + email/password (clients) |

## Commandes

```bash
npm run dev                              # Backend + frontend concurrently
cd backend && npm run dev                # Backend seul (port 3001)
cd frontend && npm run dev               # Frontend seul (port 5173)
cd backend && npx tsx src/db/seed.ts     # Seed DB
cd frontend && npm run build             # Build prod
```

## Conventions

- **Code** : anglais. **UI** : français.
- Nommage : kebab-case fichiers, PascalCase composants Svelte
- API : `{ data: ... }` succès, `{ error: string, code: number }` erreur
- IDs : UUID v4 strings partout. Dates : ISO 8601 strings. Booleans DB : 0/1.
- Auth : `Authorization: Bearer <jwt>`
- Commits : conventional commits (feat:, fix:, chore:)
- Frontend proxy : vite.config.ts redirige `/api` vers backend:3001
- **Versioning extension** : toute modif de l'extension DOIT incrémenter la version (voir `extension/CLAUDE.md` § Versioning). Patch auto au build, minor/major manuellement.
- **Versioning frontend** : toute modif du frontend DOIT incrémenter la version (`cd frontend && npm run bump`). La version est affichée dans le BO (coin bas-droite) via `__APP_VERSION__`.

## Gotchas

- shadcn-svelte CLI requiert Tailwind v4 → composants créés manuellement avec bits-ui
- Svelte 5 : `$state()`, `$derived()`, `$effect()`, `let { x } = $props()`
- Ne jamais `npm install` Playwright/deps à la racine (casse backend node_modules)

## Design System (Lemon Learning)

Source : `DESIGN SYSTEM Lemon Learning/` (PDFs couleurs, typographie, icônes)

- Font: Albert Sans (Google Fonts)
- Primary: #2B72EE (hover #245FC6) | Yellow accent: #FAE100
- Text: #242F42 / #6D7481 / #9197A0 (bluish grays)
- Bg: #FFFFFF / #F7F7F8 | Border: #E2E3E6 | Input: #F0F1F2
- Success: #10B981 | Warning: #F18E2A | Error: #F1362A
- Cards: white, border #E2E3E6, rounded-lg | Sidebar: 260px / 48px collapsed
- Favicon : "Capture Dot Citron" (coins bleus + citron jaune)
- Style : Linear/Notion-inspired, minimal

## Rôles

- **admin** : employés Lemon Learning, Google SSO, accès total
- **client** : prospects, email+password, accès viewer uniquement

## Hébergement & Domaines

| Domaine | Usage |
|---------|-------|
| **getlemonlab.com** | Landing page vitrine (root) + back-office admin (/admin, /login) |
| **env-ll.com** | Lecteur de démos publiques (URL clean pour prospects/clients) |

- Hébergement : Railway (single service, Dockerfile)
- DNS/CDN/SSL : Cloudflare (proxy activé, Always HTTPS, www→apex redirect)
- Production : single-process (`production-server.ts`) — Express API + SvelteKit sur port 8080

## Domaines fonctionnels (voir .claude/rules/)

Le projet est découpé en 3 domaines fonctionnels documentés dans `.claude/rules/` :
- **capture** : extension Chrome + upload/gestion des pages capturées
- **administration** : users, invitations, obfuscation, analytics, update-requests
- **player** : serveur de démos publiques, link rewriting, tag manager
