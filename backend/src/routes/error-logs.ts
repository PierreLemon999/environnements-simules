import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { errorLogs } from '../db/schema.js';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';
import { logError, logRouteError } from '../services/error-logger.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();

// ── Rate limiting (in-memory) ───────────────────────────────────────────────

const reportRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = reportRateLimit.get(ip) ?? [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  reportRateLimit.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  return false;
}

// ── POST /report — Client error reporting ───────────────────────────────────

router.post('/report', authenticate, (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many error reports', code: 429 });
    return;
  }

  const { source, message, stack, endpoint, statusCode, metadata } = req.body;

  if (!source || !message) {
    res.status(400).json({ error: 'source and message are required', code: 400 });
    return;
  }

  if (!['frontend', 'extension'].includes(source)) {
    res.status(400).json({ error: 'source must be frontend or extension', code: 400 });
    return;
  }

  const id = logError({
    source,
    message: String(message),
    stack: stack ? String(stack) : null,
    endpoint: endpoint ? String(endpoint) : null,
    statusCode: typeof statusCode === 'number' ? statusCode : null,
    userId: req.user?.userId ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    metadata: metadata && typeof metadata === 'object' ? metadata : null,
  });

  res.status(201).json({ data: { id } });
});

// ── GET / — Admin list with filters ─────────────────────────────────────────

router.get('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const {
      source,
      level,
      from,
      to,
      limit: limitStr,
      offset: offsetStr,
    } = req.query;

    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const offset = parseInt(offsetStr as string) || 0;

    const conditions = [];
    if (source) conditions.push(eq(errorLogs.source, source as 'backend' | 'frontend' | 'extension'));
    if (level) conditions.push(eq(errorLogs.level, level as 'error' | 'warn' | 'info'));
    if (from) conditions.push(gte(errorLogs.createdAt, from as string));
    if (to) conditions.push(lte(errorLogs.createdAt, to as string));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select()
      .from(errorLogs)
      .where(whereClause)
      .orderBy(desc(errorLogs.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(errorLogs)
      .where(whereClause)
      .get();

    res.json({
      data: result,
      pagination: {
        total: countResult?.count ?? 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    logRouteError(req, error, 'Error fetching error logs');
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

// ── GET /stats — Admin dashboard stats ──────────────────────────────────────

router.get('/stats', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const last24h = new Date(Date.now() - 86_400_000).toISOString();
    const last7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [total, count24h, count7d] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(errorLogs).get(),
      db.select({ count: sql<number>`count(*)` }).from(errorLogs).where(gte(errorLogs.createdAt, last24h)).get(),
      db.select({ count: sql<number>`count(*)` }).from(errorLogs).where(gte(errorLogs.createdAt, last7d)).get(),
    ]);

    const bySource = db.all(
      sql`SELECT source, count(*) as count FROM error_logs WHERE created_at >= ${last7d} GROUP BY source`
    );

    res.json({
      data: {
        total: total?.count ?? 0,
        last24h: count24h?.count ?? 0,
        last7d: count7d?.count ?? 0,
        bySource,
      },
    });
  } catch (error) {
    logRouteError(req, error, 'Error fetching error stats');
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

// ── DELETE /:id — Admin delete single log ───────────────────────────────────

router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await db.delete(errorLogs).where(eq(errorLogs.id, req.params.id as string));
    res.json({ data: { deleted: true, id: req.params.id } });
  } catch (error) {
    logRouteError(req, error, 'Error deleting error log');
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

export default router;
