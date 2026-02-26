# Environnements Simulés

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

## Gotchas

- shadcn-svelte CLI requiert Tailwind v4 → composants créés manuellement avec bits-ui
- Svelte 5 : `$state()`, `$derived()`, `$effect()`, `let { x } = $props()`
- Ne jamais `npm install` Playwright/deps à la racine (casse backend node_modules)

## Design System

- Bg: #FFFFFF / #F9FAFB | Primary: #3B82F6 | Text: #111827 / #6B7280 / #9CA3AF
- Success: #10B981 | Error: #EF4444 | Warning: #F59E0B
- Cards: white, border #E5E7EB, rounded-lg | Sidebar: 220px / 48px collapsed
- Style : Linear/Notion-inspired, minimal

## Rôles

- **admin** : employés Lemon Learning, Google SSO, accès total
- **client** : prospects, email+password, accès viewer uniquement

## Domaines (voir .claude/rules/)

Le projet est découpé en 3 domaines fonctionnels documentés dans `.claude/rules/` :
- **capture** : extension Chrome + upload/gestion des pages capturées
- **administration** : users, invitations, obfuscation, analytics, update-requests
- **player** : serveur de démos publiques, link rewriting, tag manager
