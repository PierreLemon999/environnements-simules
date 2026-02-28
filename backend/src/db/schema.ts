import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID v4
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // nullable for Google SSO admins
  role: text('role', { enum: ['admin', 'client'] }).notNull().default('client'),
  company: text('company'), // nullable — company name for client users
  avatarUrl: text('avatar_url'),
  googleId: text('google_id'),
  extensionVersion: text('extension_version'),
  language: text('language').notNull().default('fr'),
  createdAt: text('created_at').notNull(),
});

// ── Projects ─────────────────────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  toolName: text('tool_name').notNull(),
  subdomain: text('subdomain').notNull().unique(),
  description: text('description'),
  logoUrl: text('logo_url'),
  iconColor: text('icon_color'),
  faviconUrl: text('favicon_url'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ── Versions ─────────────────────────────────────────────────────────────────
export const versions = sqliteTable('versions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'test', 'deprecated'] }).notNull().default('active'),
  language: text('language').notNull().default('fr'),
  authorId: text('author_id').notNull().references(() => users.id),
  captureStrategy: text('capture_strategy', { enum: ['url_based', 'fingerprint_based'] }).notNull().default('url_based'),
  createdAt: text('created_at').notNull(),
});

// ── Pages ────────────────────────────────────────────────────────────────────
export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(),
  versionId: text('version_id').notNull().references(() => versions.id, { onDelete: 'cascade' }),
  urlSource: text('url_source').notNull(),
  urlPath: text('url_path').notNull(),
  title: text('title').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  captureMode: text('capture_mode', { enum: ['free', 'guided', 'auto'] }).notNull().default('free'),
  thumbnailPath: text('thumbnail_path'),
  healthStatus: text('health_status', { enum: ['ok', 'warning', 'error'] }).notNull().default('ok'),
  pageType: text('page_type', { enum: ['page', 'modal', 'spa_state'] }).notNull().default('page'),
  parentPageId: text('parent_page_id'),
  domFingerprint: text('dom_fingerprint'),
  syntheticUrl: text('synthetic_url'),
  captureTimingMs: integer('capture_timing_ms'),
  stateIndex: integer('state_index'),
  createdAt: text('created_at').notNull(),
});

// ── Page Links ───────────────────────────────────────────────────────────────
export const pageLinks = sqliteTable('page_links', {
  id: text('id').primaryKey(),
  sourcePageId: text('source_page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  targetPageId: text('target_page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  originalHref: text('original_href').notNull(),
  rewrittenHref: text('rewritten_href'),
});

// ── Page Transitions ─────────────────────────────────────────────────────────
export const pageTransitions = sqliteTable('page_transitions', {
  id: text('id').primaryKey(),
  versionId: text('version_id').notNull().references(() => versions.id, { onDelete: 'cascade' }),
  sourcePageId: text('source_page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  targetPageId: text('target_page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  triggerType: text('trigger_type', { enum: ['click', 'pushState', 'replaceState', 'popstate', 'hashchange', 'manual'] }).notNull(),
  triggerSelector: text('trigger_selector'),
  triggerText: text('trigger_text'),
  loadingTimeMs: integer('loading_time_ms'),
  hadLoadingIndicator: integer('had_loading_indicator').notNull().default(0),
  loadingIndicatorType: text('loading_indicator_type'),
  captureMode: text('capture_mode', { enum: ['free', 'guided', 'auto'] }).notNull(),
  createdAt: text('created_at').notNull(),
});

// ── Guides ───────────────────────────────────────────────────────────────────
export const guides = sqliteTable('guides', {
  id: text('id').primaryKey(),
  versionId: text('version_id').notNull().references(() => versions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

// ── Guide Pages ──────────────────────────────────────────────────────────────
export const guidePages = sqliteTable('guide_pages', {
  id: text('id').primaryKey(),
  guideId: text('guide_id').notNull().references(() => guides.id, { onDelete: 'cascade' }),
  pageId: text('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  stepOrder: integer('step_order').notNull(),
});

// ── Obfuscation Rules ────────────────────────────────────────────────────────
export const obfuscationRules = sqliteTable('obfuscation_rules', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  searchTerm: text('search_term').notNull(),
  replaceTerm: text('replace_term').notNull(),
  isRegex: integer('is_regex').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull(),
});

// ── Demo Assignments ─────────────────────────────────────────────────────────
export const demoAssignments = sqliteTable('demo_assignments', {
  id: text('id').primaryKey(),
  versionId: text('version_id').notNull().references(() => versions.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

// ── Sessions ─────────────────────────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  assignmentId: text('assignment_id').references(() => demoAssignments.id),
  versionId: text('version_id').notNull().references(() => versions.id),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
});

// ── Session Events ───────────────────────────────────────────────────────────
export const sessionEvents = sqliteTable('session_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  pageId: text('page_id').references(() => pages.id),
  eventType: text('event_type', { enum: ['page_view', 'guide_start', 'guide_complete', 'click'] }).notNull(),
  metadata: text('metadata'), // JSON string
  timestamp: text('timestamp').notNull(),
  durationSeconds: integer('duration_seconds'),
});

// ── Update Requests ──────────────────────────────────────────────────────────
export const updateRequests = sqliteTable('update_requests', {
  id: text('id').primaryKey(),
  pageId: text('page_id').notNull().references(() => pages.id, { onDelete: 'cascade' }),
  requestedBy: text('requested_by').notNull().references(() => users.id),
  comment: text('comment').notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'done'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
});

// ── Capture Jobs ─────────────────────────────────────────────────────────────
export const captureJobs = sqliteTable('capture_jobs', {
  id: text('id').primaryKey(),
  versionId: text('version_id').notNull().references(() => versions.id, { onDelete: 'cascade' }),
  mode: text('mode', { enum: ['free', 'guided', 'auto'] }).notNull(),
  targetPageCount: integer('target_page_count').notNull(),
  pagesCaptured: integer('pages_captured').notNull().default(0),
  status: text('status', { enum: ['running', 'paused', 'done', 'error'] }).notNull().default('running'),
  config: text('config'), // JSON string: stores blacklist, settings
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
});

// ── Interest Zones ───────────────────────────────────────────────────────────
export const interestZones = sqliteTable('interest_zones', {
  id: text('id').primaryKey(),
  captureJobId: text('capture_job_id').notNull().references(() => captureJobs.id, { onDelete: 'cascade' }),
  urlPattern: text('url_pattern').notNull(),
  depthMultiplier: real('depth_multiplier').notNull().default(1.0),
});

// ── Tag Manager Config ───────────────────────────────────────────────────────
export const tagManagerConfig = sqliteTable('tag_manager_config', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  scriptUrl: text('script_url').notNull(),
  configJson: text('config_json'), // JSON string
  isActive: integer('is_active').notNull().default(1),
});
