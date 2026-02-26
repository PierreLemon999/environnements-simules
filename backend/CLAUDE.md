# Backend — Express.js 5 + Drizzle ORM + SQLite

## Structure

```
src/
├── index.ts              # App Express, registration des 11 routers, middleware global
├── db/
│   ├── schema.ts         # 15 tables Drizzle (source de vérité du schéma)
│   ├── index.ts          # Init Drizzle + dataDir
│   └── seed.ts           # Données de test complètes
├── middleware/
│   ├── auth.ts           # JWT verify, signToken(), authenticate()
│   └── roles.ts          # requireRole('admin'|'client')
├── routes/               # 11 fichiers de routes (voir .claude/rules/ par domaine)
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
- 15 tables : voir `.claude/rules/database.md` pour le schéma complet
