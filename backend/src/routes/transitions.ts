import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { pageTransitions, versions, pages } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();

/**
 * POST /versions/:versionId/transitions
 * Create a new page transition record.
 */
router.post(
  '/versions/:versionId/transitions',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const version = await db
        .select()
        .from(versions)
        .where(eq(versions.id, req.params.versionId))
        .get();

      if (!version) {
        res.status(404).json({ error: 'Version not found', code: 404 });
        return;
      }

      const {
        sourcePageId,
        targetPageId,
        triggerType,
        triggerSelector,
        triggerText,
        loadingTimeMs,
        hadLoadingIndicator,
        loadingIndicatorType,
        captureMode,
      } = req.body;

      if (!sourcePageId || !targetPageId || !triggerType || !captureMode) {
        res.status(400).json({
          error: 'sourcePageId, targetPageId, triggerType, and captureMode are required',
          code: 400,
        });
        return;
      }

      const transition = {
        id: uuidv4(),
        versionId: req.params.versionId,
        sourcePageId,
        targetPageId,
        triggerType,
        triggerSelector: triggerSelector || null,
        triggerText: triggerText || null,
        loadingTimeMs: loadingTimeMs ?? null,
        hadLoadingIndicator: hadLoadingIndicator ? 1 : 0,
        loadingIndicatorType: loadingIndicatorType || null,
        captureMode,
        createdAt: new Date().toISOString(),
      };

      await db.insert(pageTransitions).values(transition);

      res.status(201).json({ data: transition });
    } catch (error) {
      console.error('Error creating transition:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * GET /versions/:versionId/transitions
 * List all transitions for a version.
 */
router.get(
  '/versions/:versionId/transitions',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const version = await db
        .select()
        .from(versions)
        .where(eq(versions.id, req.params.versionId))
        .get();

      if (!version) {
        res.status(404).json({ error: 'Version not found', code: 404 });
        return;
      }

      const transitions = await db
        .select()
        .from(pageTransitions)
        .where(eq(pageTransitions.versionId, req.params.versionId))
        .all();

      res.json({ data: transitions });
    } catch (error) {
      console.error('Error listing transitions:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * GET /pages/:pageId/transitions
 * Get all incoming and outgoing transitions for a page.
 */
router.get(
  '/pages/:pageId/transitions',
  authenticate,
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

      const outgoing = await db
        .select()
        .from(pageTransitions)
        .where(eq(pageTransitions.sourcePageId, req.params.pageId))
        .all();

      const incoming = await db
        .select()
        .from(pageTransitions)
        .where(eq(pageTransitions.targetPageId, req.params.pageId))
        .all();

      res.json({ data: { incoming, outgoing } });
    } catch (error) {
      console.error('Error getting page transitions:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * DELETE /transitions/:id
 * Delete a transition record.
 */
router.delete(
  '/transitions/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const transition = await db
        .select()
        .from(pageTransitions)
        .where(eq(pageTransitions.id, req.params.id))
        .get();

      if (!transition) {
        res.status(404).json({ error: 'Transition not found', code: 404 });
        return;
      }

      await db.delete(pageTransitions).where(eq(pageTransitions.id, req.params.id));

      res.json({ data: { deleted: true, id: req.params.id } });
    } catch (error) {
      console.error('Error deleting transition:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

export default router;
