import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { obfuscationRules, projects } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { previewObfuscation } from '../services/obfuscation.js';
import { logRouteError } from '../services/error-logger.js';

const router = Router();

/**
 * GET /projects/:projectId/obfuscation
 * List all obfuscation rules for a project.
 */
router.get(
  '/projects/:projectId/obfuscation',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, req.params.projectId))
        .get();

      if (!project) {
        res.status(404).json({ error: 'Project not found', code: 404 });
        return;
      }

      const rules = await db
        .select()
        .from(obfuscationRules)
        .where(eq(obfuscationRules.projectId, req.params.projectId))
        .all();

      res.json({ data: rules });
    } catch (error) {
      logRouteError(req, error, 'Error listing obfuscation rules');
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * POST /projects/:projectId/obfuscation
 * Add a new obfuscation rule.
 */
router.post(
  '/projects/:projectId/obfuscation',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, req.params.projectId))
        .get();

      if (!project) {
        res.status(404).json({ error: 'Project not found', code: 404 });
        return;
      }

      const { searchTerm, replaceTerm, isRegex, isActive } = req.body;

      if (!searchTerm || replaceTerm === undefined) {
        res.status(400).json({
          error: 'searchTerm and replaceTerm are required',
          code: 400,
        });
        return;
      }

      // Block HTML/script injection in replaceTerm
      if (/<script/i.test(replaceTerm) || /on\w+\s*=/i.test(replaceTerm)) {
        res.status(400).json({ error: 'replaceTerm must not contain script tags or event handlers', code: 400 });
        return;
      }

      // Validate regex if isRegex is true
      if (isRegex) {
        try {
          new RegExp(searchTerm);
        } catch {
          res.status(400).json({ error: 'Invalid regex pattern', code: 400 });
          return;
        }
      }

      const rule = {
        id: uuidv4(),
        projectId: req.params.projectId,
        searchTerm,
        replaceTerm,
        isRegex: isRegex ? 1 : 0,
        isActive: isActive !== undefined ? (isActive ? 1 : 0) : 1,
        createdAt: new Date().toISOString(),
      };

      await db.insert(obfuscationRules).values(rule);

      res.status(201).json({ data: rule });
    } catch (error) {
      logRouteError(req, error, 'Error creating obfuscation rule');
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * PUT /obfuscation/:id
 * Update an obfuscation rule.
 */
router.put(
  '/obfuscation/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const rule = await db
        .select()
        .from(obfuscationRules)
        .where(eq(obfuscationRules.id, req.params.id))
        .get();

      if (!rule) {
        res.status(404).json({ error: 'Obfuscation rule not found', code: 404 });
        return;
      }

      const { searchTerm, replaceTerm, isRegex, isActive } = req.body;

      // Block HTML/script injection in replaceTerm
      if (replaceTerm !== undefined && (/<script/i.test(replaceTerm) || /on\w+\s*=/i.test(replaceTerm))) {
        res.status(400).json({ error: 'replaceTerm must not contain script tags or event handlers', code: 400 });
        return;
      }

      // Validate regex if updating to regex mode
      if (isRegex && searchTerm) {
        try {
          new RegExp(searchTerm);
        } catch {
          res.status(400).json({ error: 'Invalid regex pattern', code: 400 });
          return;
        }
      }

      const updated = {
        searchTerm: searchTerm ?? rule.searchTerm,
        replaceTerm: replaceTerm ?? rule.replaceTerm,
        isRegex: isRegex !== undefined ? (isRegex ? 1 : 0) : rule.isRegex,
        isActive: isActive !== undefined ? (isActive ? 1 : 0) : rule.isActive,
      };

      await db
        .update(obfuscationRules)
        .set(updated)
        .where(eq(obfuscationRules.id, req.params.id));

      res.json({ data: { ...rule, ...updated } });
    } catch (error) {
      logRouteError(req, error, 'Error updating obfuscation rule');
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * DELETE /obfuscation/:id
 * Delete an obfuscation rule.
 */
router.delete(
  '/obfuscation/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const rule = await db
        .select()
        .from(obfuscationRules)
        .where(eq(obfuscationRules.id, req.params.id))
        .get();

      if (!rule) {
        res.status(404).json({ error: 'Obfuscation rule not found', code: 404 });
        return;
      }

      await db.delete(obfuscationRules).where(eq(obfuscationRules.id, req.params.id));

      res.json({ data: { deleted: true, id: req.params.id } });
    } catch (error) {
      logRouteError(req, error, 'Error deleting obfuscation rule');
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * POST /projects/:projectId/obfuscation/preview
 * Preview obfuscation on a sample HTML string.
 */
router.post(
  '/projects/:projectId/obfuscation/preview',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, req.params.projectId))
        .get();

      if (!project) {
        res.status(404).json({ error: 'Project not found', code: 404 });
        return;
      }

      const { sampleHtml } = req.body;

      if (!sampleHtml) {
        res.status(400).json({ error: 'sampleHtml is required', code: 400 });
        return;
      }

      const rules = await db
        .select()
        .from(obfuscationRules)
        .where(eq(obfuscationRules.projectId, req.params.projectId))
        .all();

      const result = previewObfuscation(sampleHtml, rules);

      res.json({ data: result });
    } catch (error) {
      logRouteError(req, error, 'Error previewing obfuscation');
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

export default router;
