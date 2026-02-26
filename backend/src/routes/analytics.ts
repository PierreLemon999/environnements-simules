import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import {
  sessions,
  sessionEvents,
  guides,
  guidePages,
  versions,
  users,
  pages,
  demoAssignments,
} from '../db/schema.js';
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /analytics/sessions
 * List sessions with optional filters: versionId, userId, from, to.
 */
router.get('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const { versionId, userId, from, to, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);

    let query = db.select().from(sessions).orderBy(desc(sessions.startedAt));

    // Build conditions array
    const conditions = [];
    if (versionId) conditions.push(eq(sessions.versionId, versionId as string));
    if (userId) conditions.push(eq(sessions.userId, userId as string));
    if (from) conditions.push(gte(sessions.startedAt, from as string));
    if (to) conditions.push(lte(sessions.startedAt, to as string));

    let result;
    if (conditions.length > 0) {
      result = await db
        .select()
        .from(sessions)
        .where(and(...conditions))
        .orderBy(desc(sessions.startedAt))
        .limit(limit)
        .all();
    } else {
      result = await db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.startedAt))
        .limit(limit)
        .all();
    }

    // Enrich with event counts
    const enriched = await Promise.all(
      result.map(async (session) => {
        const eventCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(sessionEvents)
          .where(eq(sessionEvents.sessionId, session.id))
          .get();

        const user = session.userId
          ? await db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(users)
              .where(eq(users.id, session.userId))
              .get()
          : null;

        // Fetch assignment data if session has an assignmentId
        let assignment = null;
        if (session.assignmentId) {
          const assignmentRow = await db
            .select()
            .from(demoAssignments)
            .where(eq(demoAssignments.id, session.assignmentId))
            .get();
          if (assignmentRow) {
            // Get the assigned user to derive client info
            const assignedUser = await db
              .select({ id: users.id, name: users.name, email: users.email })
              .from(users)
              .where(eq(users.id, assignmentRow.userId))
              .get();
            assignment = {
              clientName: assignedUser?.name ?? null,
              clientEmail: assignedUser?.email ?? '',
            };
          }
        }

        return {
          ...session,
          eventCount: eventCount?.count ?? 0,
          user,
          assignment,
        };
      })
    );

    res.json({ data: enriched });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * GET /analytics/sessions/:id
 * Get session detail with all events.
 */
router.get('/sessions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, req.params.id))
      .get();

    if (!session) {
      res.status(404).json({ error: 'Session not found', code: 404 });
      return;
    }

    const events = await db
      .select()
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, session.id))
      .all();

    // Enrich events with page info
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        const page = event.pageId
          ? await db
              .select({ id: pages.id, title: pages.title, urlPath: pages.urlPath })
              .from(pages)
              .where(eq(pages.id, event.pageId))
              .get()
          : null;

        return {
          ...event,
          metadata: event.metadata ? JSON.parse(event.metadata) : null,
          page,
        };
      })
    );

    const user = session.userId
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, session.userId))
          .get()
      : null;

    // Fetch assignment data
    let assignment = null;
    if (session.assignmentId) {
      const assignmentRow = await db
        .select()
        .from(demoAssignments)
        .where(eq(demoAssignments.id, session.assignmentId))
        .get();
      if (assignmentRow) {
        const assignedUser = await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, assignmentRow.userId))
          .get();
        assignment = {
          clientName: assignedUser?.name ?? null,
          clientEmail: assignedUser?.email ?? '',
        };
      }
    }

    res.json({
      data: {
        ...session,
        user,
        assignment,
        events: enrichedEvents,
      },
    });
  } catch (error) {
    console.error('Error getting session detail:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * GET /analytics/guides
 * Get guide statistics (play count, completion rate).
 */
router.get('/guides', authenticate, async (req: Request, res: Response) => {
  try {
    const allGuides = await db.select().from(guides).all();

    const stats = await Promise.all(
      allGuides.map(async (guide) => {
        // Count guide_start events
        const startCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(sessionEvents)
          .where(
            and(
              eq(sessionEvents.eventType, 'guide_start'),
              sql`json_extract(${sessionEvents.metadata}, '$.guideId') = ${guide.id}`
            )
          )
          .get();

        // Count guide_complete events
        const completeCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(sessionEvents)
          .where(
            and(
              eq(sessionEvents.eventType, 'guide_complete'),
              sql`json_extract(${sessionEvents.metadata}, '$.guideId') = ${guide.id}`
            )
          )
          .get();

        // Get page count for the guide
        const pageCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(guidePages)
          .where(eq(guidePages.guideId, guide.id))
          .get();

        return {
          ...guide,
          playCount: startCount?.count ?? 0,
          completionCount: completeCount?.count ?? 0,
          pageCount: pageCount?.count ?? 0,
        };
      })
    );

    res.json({ data: stats });
  } catch (error) {
    console.error('Error getting guide stats:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * GET /analytics/overview
 * Get aggregated analytics overview.
 */
router.get('/overview', authenticate, async (req: Request, res: Response) => {
  try {
    const totalSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .get();

    const totalEvents = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessionEvents)
      .get();

    const totalPageViews = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessionEvents)
      .where(eq(sessionEvents.eventType, 'page_view'))
      .get();

    const totalGuideStarts = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessionEvents)
      .where(eq(sessionEvents.eventType, 'guide_start'))
      .get();

    const totalGuideCompletions = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessionEvents)
      .where(eq(sessionEvents.eventType, 'guide_complete'))
      .get();

    // Average session duration (for sessions that have ended)
    const avgDuration = await db
      .select({
        avg: sql<number>`avg(
          (julianday(${sessions.endedAt}) - julianday(${sessions.startedAt})) * 86400
        )`,
      })
      .from(sessions)
      .where(sql`${sessions.endedAt} IS NOT NULL`)
      .get();

    // Sessions in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(gte(sessions.startedAt, sevenDaysAgo.toISOString()))
      .get();

    // Unique users in the last 7 days
    const recentUniqueUsers = await db
      .select({ count: sql<number>`count(distinct ${sessions.userId})` })
      .from(sessions)
      .where(
        and(
          gte(sessions.startedAt, sevenDaysAgo.toISOString()),
          sql`${sessions.userId} IS NOT NULL`
        )
      )
      .get();

    res.json({
      data: {
        totalSessions: totalSessions?.count ?? 0,
        totalEvents: totalEvents?.count ?? 0,
        totalPageViews: totalPageViews?.count ?? 0,
        totalGuideStarts: totalGuideStarts?.count ?? 0,
        totalGuideCompletions: totalGuideCompletions?.count ?? 0,
        averageSessionDurationSeconds: Math.max(0, Math.round(avgDuration?.avg ?? 0)),
        last7Days: {
          sessions: recentSessions?.count ?? 0,
          uniqueUsers: recentUniqueUsers?.count ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('Error getting analytics overview:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /analytics/events
 * Record an event from the demo viewer.
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { sessionId, pageId, eventType, metadata, durationSeconds } = req.body;

    if (!sessionId || !eventType) {
      res.status(400).json({
        error: 'sessionId and eventType are required',
        code: 400,
      });
      return;
    }

    // Verify session exists
    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!session) {
      res.status(404).json({ error: 'Session not found', code: 404 });
      return;
    }

    const event = {
      id: uuidv4(),
      sessionId,
      pageId: pageId || null,
      eventType,
      metadata: metadata ? JSON.stringify(metadata) : null,
      timestamp: new Date().toISOString(),
      durationSeconds: durationSeconds || null,
    };

    await db.insert(sessionEvents).values(event);

    res.status(201).json({ data: event });
  } catch (error) {
    console.error('Error recording event:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

export default router;
