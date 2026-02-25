import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { captureJobs, interestZones, versions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();

/**
 * POST /versions/:versionId/capture-jobs
 * Create a new capture job.
 */
router.post(
  '/versions/:versionId/capture-jobs',
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

      const { mode, targetPageCount, config } = req.body;

      if (!mode || !targetPageCount) {
        res.status(400).json({
          error: 'mode and targetPageCount are required',
          code: 400,
        });
        return;
      }

      const job = {
        id: uuidv4(),
        versionId: req.params.versionId,
        mode,
        targetPageCount,
        pagesCaptured: 0,
        status: 'running' as const,
        config: config ? JSON.stringify(config) : null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      };

      await db.insert(captureJobs).values(job);

      res.status(201).json({ data: job });
    } catch (error) {
      console.error('Error creating capture job:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * GET /capture-jobs/:id
 * Get capture job status with interest zones.
 */
router.get(
  '/capture-jobs/:id',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const job = await db
        .select()
        .from(captureJobs)
        .where(eq(captureJobs.id, req.params.id))
        .get();

      if (!job) {
        res.status(404).json({ error: 'Capture job not found', code: 404 });
        return;
      }

      const zones = await db
        .select()
        .from(interestZones)
        .where(eq(interestZones.captureJobId, job.id))
        .all();

      res.json({
        data: {
          ...job,
          config: job.config ? JSON.parse(job.config) : null,
          interestZones: zones,
        },
      });
    } catch (error) {
      console.error('Error getting capture job:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * PUT /capture-jobs/:id
 * Update capture job (pages_captured, status).
 */
router.put(
  '/capture-jobs/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const job = await db
        .select()
        .from(captureJobs)
        .where(eq(captureJobs.id, req.params.id))
        .get();

      if (!job) {
        res.status(404).json({ error: 'Capture job not found', code: 404 });
        return;
      }

      const { pagesCaptured, status, config } = req.body;

      const updated: Record<string, unknown> = {};
      if (pagesCaptured !== undefined) updated.pagesCaptured = pagesCaptured;
      if (status !== undefined) updated.status = status;
      if (config !== undefined) updated.config = JSON.stringify(config);

      // Auto-set completedAt when job is done or errored
      if (status === 'done' || status === 'error') {
        updated.completedAt = new Date().toISOString();
      }

      await db
        .update(captureJobs)
        .set(updated)
        .where(eq(captureJobs.id, req.params.id));

      res.json({ data: { ...job, ...updated } });
    } catch (error) {
      console.error('Error updating capture job:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * POST /capture-jobs/:id/interest-zones
 * Add an interest zone to a capture job.
 */
router.post(
  '/capture-jobs/:id/interest-zones',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const job = await db
        .select()
        .from(captureJobs)
        .where(eq(captureJobs.id, req.params.id))
        .get();

      if (!job) {
        res.status(404).json({ error: 'Capture job not found', code: 404 });
        return;
      }

      const { urlPattern, depthMultiplier } = req.body;

      if (!urlPattern) {
        res.status(400).json({ error: 'urlPattern is required', code: 400 });
        return;
      }

      const zone = {
        id: uuidv4(),
        captureJobId: req.params.id,
        urlPattern,
        depthMultiplier: depthMultiplier ?? 1.0,
      };

      await db.insert(interestZones).values(zone);

      res.status(201).json({ data: zone });
    } catch (error) {
      console.error('Error adding interest zone:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

export default router;
