---
paths:
  - "backend/src/db/**"
  - "backend/src/routes/**"
---

# Base de données — SQLite + Drizzle ORM

## Schéma (17 tables)

### Core
```
projects
  id (UUID PK), name, toolName, subdomain (unique), description,
  logoUrl, iconColor, faviconUrl, createdAt, updatedAt

versions
  id (UUID PK), projectId (FK→projects), name,
  status (active|test|deprecated), language, authorId (FK→users),
  captureStrategy (url_based|fingerprint_based), createdAt

pages
  id (UUID PK), versionId (FK→versions), urlSource, urlPath, title,
  filePath, fileSize, captureMode (free|guided|auto), thumbnailPath,
  healthStatus (ok|warning|error), pageType (page|modal|spa_state),
  parentPageId, domFingerprint, syntheticUrl, captureTimingMs,
  stateIndex, createdAt

pageLinks
  id (UUID PK), sourcePageId (FK→pages), targetPageId (FK→pages),
  originalHref, rewrittenHref

pageTransitions
  id (UUID PK), versionId (FK→versions), sourcePageId (FK→pages),
  targetPageId (FK→pages), triggerType (click|pushState|replaceState|popstate|hashchange|manual),
  triggerSelector, triggerText, loadingTimeMs, hadLoadingIndicator (0/1),
  loadingIndicatorType, captureMode (free|guided|auto), createdAt
```

### Guides
```
guides
  id (UUID PK), versionId (FK→versions), name, description, createdAt

guidePages
  id (UUID PK), guideId (FK→guides), pageId (FK→pages), stepOrder (int)
```

### Features
```
obfuscationRules
  id (UUID PK), projectId (FK→projects), searchTerm, replaceTerm,
  isRegex (0/1), isActive (0/1), createdAt

demoAssignments
  id (UUID PK), versionId (FK→versions), userId (FK→users),
  accessToken (unique), passwordHash, expiresAt, createdAt

sessions
  id (UUID PK), userId (FK→users), assignmentId (FK→demoAssignments),
  versionId (FK→versions), ipAddress, userAgent, startedAt, endedAt

sessionEvents
  id (UUID PK), sessionId (FK→sessions), pageId (FK→pages),
  eventType (page_view|guide_start|guide_complete|click),
  metadata (JSON string), timestamp, durationSeconds

updateRequests
  id (UUID PK), pageId (FK→pages), requestedBy (FK→users),
  comment, status (pending|in_progress|done), createdAt, resolvedAt

captureJobs
  id (UUID PK), versionId (FK→versions), mode (free|guided|auto),
  targetPageCount, pagesCaptured, status (running|paused|done|error),
  config (JSON string), startedAt, completedAt

interestZones
  id (UUID PK), captureJobId (FK→captureJobs), urlPattern,
  depthMultiplier (real, default 1.0)

tagManagerConfig
  id (UUID PK), projectId (FK→projects), scriptUrl, configJson (JSON string),
  isActive (0/1)
```

### Error Logging
```
errorLogs
  id (UUID PK), source (backend|frontend|extension), level (error|warn|info, default error),
  message, stack, endpoint, method, statusCode, userId, userAgent,
  metadata (JSON string), createdAt
```

### Auth
```
users
  id (UUID PK), name, email (unique), passwordHash, role (admin|client),
  company, avatarUrl, googleId, extensionVersion, language, createdAt
```

## Relations principales

```
projects 1:N versions 1:N pages
pages 1:N pageLinks (self-referential via sourcePageId/targetPageId)
pages 1:N pageTransitions (self-referential via sourcePageId/targetPageId)
projects 1:N obfuscationRules
projects 1:1 tagManagerConfig
versions 1:N demoAssignments 1:N sessions 1:N sessionEvents
versions 1:N guides 1:N guidePages → pages
versions 1:N captureJobs 1:N interestZones
pages 1:N updateRequests
users 1:N demoAssignments (via userId)
users 1:N versions (via authorId)
```

## Conventions

- Tous les IDs : UUID v4 strings (jamais d'auto-increment)
- Dates : ISO 8601 strings (pas de timestamps Unix)
- Booleans : integers 0/1 (contrainte SQLite)
- Cascade deletes : configurés dans le schéma Drizzle pour les FK
- Source de vérité : `backend/src/db/schema.ts`
