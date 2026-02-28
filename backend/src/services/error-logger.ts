import { db } from '../db/index.js';
import { errorLogs } from '../db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { lt } from 'drizzle-orm';
import type { Request } from 'express';

// ── Lazy cleanup config ─────────────────────────────────────────────────────

let insertCount = 0;
const CLEANUP_EVERY_N = 100;
const RETENTION_DAYS = 180; // 6 months

// ── Types ───────────────────────────────────────────────────────────────────

interface LogErrorParams {
  source: 'backend' | 'frontend' | 'extension';
  level?: 'error' | 'warn' | 'info';
  message: string;
  stack?: string | null;
  endpoint?: string | null;
  method?: string | null;
  statusCode?: number | null;
  userId?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ── Core logging function ───────────────────────────────────────────────────

export function logError(params: LogErrorParams): string {
  const id = uuidv4();

  try {
    db.insert(errorLogs).values({
      id,
      source: params.source,
      level: params.level ?? 'error',
      message: params.message.slice(0, 2000),
      stack: params.stack?.slice(0, 5000) ?? null,
      endpoint: params.endpoint ?? null,
      method: params.method ?? null,
      statusCode: params.statusCode ?? null,
      userId: params.userId ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt: new Date().toISOString(),
    }).run();
  } catch (e) {
    console.error('[ErrorLogger] Failed to persist error log:', e);
    return id;
  }

  // Lazy cleanup
  insertCount++;
  if (insertCount >= CLEANUP_EVERY_N) {
    insertCount = 0;
    cleanupOldLogs();
  }

  return id;
}

// ── Route error helper ──────────────────────────────────────────────────────

export function logRouteError(req: Request, error: unknown, context?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));

  logError({
    source: 'backend',
    message: context ? `${context}: ${err.message}` : err.message,
    stack: err.stack,
    endpoint: req.originalUrl,
    method: req.method,
    statusCode: 500,
    userId: req.user?.userId ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  });

  console.error(context || 'Route error:', error);
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

function cleanupOldLogs(): void {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoff = cutoffDate.toISOString();

    const result = db.delete(errorLogs)
      .where(lt(errorLogs.createdAt, cutoff))
      .run();

    if (result.changes > 0) {
      console.log(`[ErrorLogger] Cleaned up ${result.changes} old error logs`);
    }
  } catch (e) {
    console.error('[ErrorLogger] Cleanup failed:', e);
  }
}

// Run cleanup once at startup
cleanupOldLogs();
