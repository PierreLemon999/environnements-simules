import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { projects, versions, pages } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();

/**
 * GET /projects
 * List all projects with version count and page count.
 */
router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const allProjects = await db.select().from(projects).all();

    // Enrich with counts
    const enriched = await Promise.all(
      allProjects.map(async (project) => {
        const versionList = await db
          .select()
          .from(versions)
          .where(eq(versions.projectId, project.id))
          .all();

        let totalPages = 0;
        for (const v of versionList) {
          const pageCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(pages)
            .where(eq(pages.versionId, v.id))
            .get();
          totalPages += pageCount?.count ?? 0;
        }

        return {
          ...project,
          versionCount: versionList.length,
          pageCount: totalPages,
        };
      })
    );

    res.json({ data: enriched });
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /projects
 * Create a new project.
 */
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, toolName, subdomain, description } = req.body;

    if (!name || !toolName || !subdomain) {
      res.status(400).json({ error: 'Name, toolName, and subdomain are required', code: 400 });
      return;
    }

    // Check subdomain uniqueness
    const existing = await db
      .select()
      .from(projects)
      .where(eq(projects.subdomain, subdomain))
      .get();
    if (existing) {
      res.status(409).json({ error: 'Subdomain already in use', code: 409 });
      return;
    }

    const now = new Date().toISOString();
    const project = {
      id: uuidv4(),
      name,
      toolName,
      subdomain,
      description: description || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(projects).values(project);

    res.status(201).json({ data: project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * GET /projects/:id
 * Get project detail with its versions.
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, req.params.id))
      .get();

    if (!project) {
      res.status(404).json({ error: 'Project not found', code: 404 });
      return;
    }

    const versionList = await db
      .select()
      .from(versions)
      .where(eq(versions.projectId, project.id))
      .all();

    res.json({
      data: {
        ...project,
        versions: versionList,
      },
    });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * PUT /projects/:id
 * Update a project.
 */
router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, req.params.id))
      .get();

    if (!project) {
      res.status(404).json({ error: 'Project not found', code: 404 });
      return;
    }

    const { name, toolName, subdomain, description } = req.body;

    // Check subdomain uniqueness if changing
    if (subdomain && subdomain !== project.subdomain) {
      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.subdomain, subdomain))
        .get();
      if (existing) {
        res.status(409).json({ error: 'Subdomain already in use', code: 409 });
        return;
      }
    }

    const updated = {
      name: name ?? project.name,
      toolName: toolName ?? project.toolName,
      subdomain: subdomain ?? project.subdomain,
      description: description !== undefined ? description : project.description,
      updatedAt: new Date().toISOString(),
    };

    await db.update(projects).set(updated).where(eq(projects.id, req.params.id));

    res.json({ data: { ...project, ...updated } });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * DELETE /projects/:id
 * Delete a project (cascades to versions, pages, etc.).
 */
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, req.params.id))
      .get();

    if (!project) {
      res.status(404).json({ error: 'Project not found', code: 404 });
      return;
    }

    await db.delete(projects).where(eq(projects.id, req.params.id));

    res.json({ data: { deleted: true, id: req.params.id } });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

export default router;
