# Backend — Express.js 5 + Drizzle ORM + SQLite

## Structure

```
src/
├── index.ts              # App Express, registration des 13 routers, middleware global
├── db/
│   ├── schema.ts         # 16 tables Drizzle (source de vérité du schéma)
│   ├── index.ts          # Init Drizzle + dataDir
│   └── seed.ts           # Données de test complètes
├── middleware/
│   ├── auth.ts           # JWT verify, signToken(), authenticate()
│   └── roles.ts          # requireRole('admin'|'client')
├── routes/               # 13 fichiers de routes (voir .claude/rules/ par domaine)
│   ├── auth.ts           # Login, Google SSO, verify JWT, demo-access
│   ├── projects.ts       # CRUD projets
│   ├── versions.ts       # CRUD versions + duplicate
│   ├── pages.ts          # CRUD pages + upload multipart HTML
│   ├── demo.ts           # Serving démo publique
│   ├── obfuscation.ts    # Règles CRUD + preview
│   ├── assignments.ts    # Tokens d'accès démo
│   ├── analytics.ts      # Sessions, events, guides, overview
│   ├── update-requests.ts # Demandes de MAJ workflow
│   ├── capture-jobs.ts   # Jobs de capture auto
│   ├── transitions.ts    # Transitions entre pages (SPA)
│   ├── users.ts          # CRUD utilisateurs (admin only)
│   └── settings.ts       # Paramètres application
└── services/
    ├── demo-serving.ts   # Orchestration : project→version→page→obfuscate→rewrite→inject
    ├── link-rewriter.ts  # Réécriture des liens internes vers /demo/:subdomain/
    └── obfuscation.ts    # Moteur search/replace (texte + regex)
```

## Patterns

- Chaque route utilise `authenticate()` + `requireRole()` sauf endpoints publics
- `req.user` contient `{ userId, email, role, name }` après auth
- Upload pages : multer, multipart FormData, stockage dans `/data/uploads/{pageId}/`
- Réponses : toujours `res.json({ data: ... })` ou `res.status(xxx).json({ error, code })`

## DB

- SQLite via better-sqlite3 (in-process, pas de serveur)
- Drizzle ORM pour les queries type-safe
- Fichier DB : `backend/data/app.db`
- Cascade deletes configurés dans le schéma
- 16 tables : voir `.claude/rules/database.md` pour le schéma complet
