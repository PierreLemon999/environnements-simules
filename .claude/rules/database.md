---
paths:
  - "backend/src/db/**"
  - "backend/src/routes/**"
---

# Base de données — SQLite + Drizzle ORM

## Schéma (15 tables)

### Core
```
projects
  id (UUID PK), name, toolName, subdomain (unique), description,
  logoUrl, status, createdAt, updatedAt

versions
  id (UUID PK), projectId (FK→projects), name, status (draft|active|archived),
  createdAt, updatedAt
  ⚠️ Un seul status='active' par projet

pages
  id (UUID PK), versionId (FK→versions), title, urlPath, filePath,
  fileSize, status, capturedAt, updatedAt

pageLinks
  id (UUID PK), sourcePageId (FK→pages), targetPageId (FK→pages),
  linkUrl, anchorText
```

### Guides
```
guides
  id (UUID PK), versionId (FK→versions), name, description, createdAt

guidePages
  id (UUID PK), guideId (FK→guides), pageId (FK→pages), stepNumber, instruction
```

### Features
```
obfuscationRules
  id (UUID PK), projectId (FK→projects), searchTerm, replaceTerm,
  isRegex (0/1), isActive (0/1), order (int)

demoAssignments
  id (UUID PK), versionId (FK→versions), recipientEmail, recipientName,
  company, token (unique), password (hashed), expiresAt, createdAt

sessions
  id (UUID PK), assignmentId (FK→demoAssignments), ipAddress, userAgent,
  startedAt, lastActivityAt

sessionEvents
  id (UUID PK), sessionId (FK→sessions), pageId (FK→pages),
  eventType, metadata (JSON string), createdAt

updateRequests
  id (UUID PK), pageId (FK→pages), requestedBy (FK→users),
  description, status (pending|approved|rejected|done), createdAt, resolvedAt

captureJobs
  id (UUID PK), versionId (FK→versions), status (pending|running|done|failed),
  startUrl, maxDepth, pagesFound, pagesCaptured, createdAt, completedAt

interestZones
  id (UUID PK), captureJobId (FK→captureJobs), urlPattern, depthMultiplier

tagManagerConfig
  id (UUID PK), projectId (FK→projects), script, isActive (0/1), updatedAt
```

### Auth
```
users
  id (UUID PK), email (unique), name, role (admin|client),
  passwordHash, googleId, createdAt
```

## Relations principales

```
projects 1:N versions 1:N pages
pages 1:N pageLinks (self-referential via sourcePageId/targetPageId)
projects 1:N obfuscationRules
projects 1:1 tagManagerConfig
versions 1:N demoAssignments 1:N sessions 1:N sessionEvents
versions 1:N guides 1:N guidePages → pages
versions 1:N captureJobs 1:N interestZones
pages 1:N updateRequests
```

## Conventions

- Tous les IDs : UUID v4 strings (jamais d'auto-increment)
- Dates : ISO 8601 strings (pas de timestamps Unix)
- Booleans : integers 0/1 (contrainte SQLite)
- Cascade deletes : configurés dans le schéma Drizzle pour les FK
- Source de vérité : `backend/src/db/schema.ts`
