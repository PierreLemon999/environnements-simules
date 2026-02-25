import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { updateRequests, pages, users } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();

/**
 * POST /pages/:pageId/update-request
 * Create an update request for a page.
 */
router.post(
  '/pages/:pageId/update-request',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const page = await db
        .select()
        .from(pages)
        .where(eq(pages.id, req.params.pageId))
        .get();

      if (!page) {
        res.status(404).json({ error: 'Page not found', code: 404 });
        return;
      }

      const { comment } = req.body;

      if (!comment) {
        res.status(400).json({ error: 'Comment is required', code: 400 });
        return;
      }

      const request = {
        id: uuidv4(),
        pageId: req.params.pageId,
        requestedBy: req.user!.userId,
        comment,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };

      await db.insert(updateRequests).values(request);

      res.status(201).json({ data: request });
    } catch (error) {
      console.error('Error creating update request:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * GET /update-requests
 * List all update requests.
 */
router.get(
  '/update-requests',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const requests = await db
        .select()
        .from(updateRequests)
        .orderBy(desc(updateRequests.createdAt))
        .all();

      // Enrich with page and user info
      const enriched = await Promise.all(
        requests.map(async (request) => {
          const page = await db
            .select({ id: pages.id, title: pages.title, urlPath: pages.urlPath })
            .from(pages)
            .where(eq(pages.id, request.pageId))
            .get();

          const user = await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, request.requestedBy))
            .get();

          return {
            ...request,
            page,
            requestedByUser: user,
          };
        })
      );

      res.json({ data: enriched });
    } catch (error) {
      console.error('Error listing update requests:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * PUT /update-requests/:id
 * Update the status of an update request.
 */
router.put(
  '/update-requests/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const request = await db
        .select()
        .from(updateRequests)
        .where(eq(updateRequests.id, req.params.id))
        .get();

      if (!request) {
        res.status(404).json({ error: 'Update request not found', code: 404 });
        return;
      }

      const { status } = req.body;

      if (!status || !['pending', 'in_progress', 'done'].includes(status)) {
        res.status(400).json({
          error: 'Valid status is required (pending, in_progress, done)',
          code: 400,
        });
        return;
      }

      const updated: Record<string, string | null> = { status };
      if (status === 'done') {
        updated.resolvedAt = new Date().toISOString();
      }

      await db
        .update(updateRequests)
        .set(updated)
        .where(eq(updateRequests.id, req.params.id));

      res.json({ data: { ...request, ...updated } });
    } catch (error) {
      console.error('Error updating update request:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

export default router;
