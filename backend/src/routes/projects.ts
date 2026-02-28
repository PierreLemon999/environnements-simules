import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { projects, versions, pages } from '../db/schema.js';
import { eq, sql, and, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { getToolLogo } from '../db/tool-logos.js';

const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

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
 * GET /projects/check-subdomain
 * Check if a subdomain is available and valid.
 */
router.get('/check-subdomain', authenticate, async (req: Request, res: Response) => {
  try {
    const subdomain = req.query.subdomain as string;
    const excludeId = req.query.excludeId as string | undefined;

    if (!subdomain) {
      res.json({ data: { available: false, reason: 'empty' } });
      return;
    }

    if (!SUBDOMAIN_REGEX.test(subdomain)) {
      res.json({ data: { available: false, reason: 'invalid' } });
      return;
    }

    if (excludeId) {
      const existing = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.subdomain, subdomain), ne(projects.id, excludeId)))
        .get();
      res.json({ data: { available: !existing } });
    } else {
      const existing = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.subdomain, subdomain))
        .get();
      res.json({ data: { available: !existing } });
    }
  } catch (error) {
    console.error('Error checking subdomain:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /projects
 * Create a new project.
 */
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, subdomain, description, logoUrl, iconColor, faviconUrl } = req.body;
    const toolName = req.body.toolName || name;

    if (!name || !subdomain) {
      res.status(400).json({ error: 'Name and subdomain are required', code: 400 });
      return;
    }

    if (!SUBDOMAIN_REGEX.test(subdomain)) {
      res.status(400).json({ error: 'Subdomain must contain only lowercase letters, digits, and hyphens (2-63 chars)', code: 400 });
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
      logoUrl: logoUrl || getToolLogo(toolName) || getToolLogo(name) || null,
      iconColor: iconColor || null,
      faviconUrl: faviconUrl || null,
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
 * GET /projects/by-subdomain/:subdomain/favicon
 * Return project favicon (public, no auth — used by demo viewers).
 */
router.get('/by-subdomain/:subdomain/favicon', async (req: Request, res: Response) => {
  try {
    const project = await db
      .select({ faviconUrl: projects.faviconUrl })
      .from(projects)
      .where(eq(projects.subdomain, req.params.subdomain))
      .get();

    if (!project) {
      res.status(404).json({ error: 'Project not found', code: 404 });
      return;
    }

    res.json({ data: { faviconUrl: project.faviconUrl } });
  } catch (error) {
    console.error('Error getting project favicon:', error);
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

    // Enrich versions with page counts
    let totalPageCount = 0;
    const enrichedVersions = await Promise.all(
      versionList.map(async (v) => {
        const pageCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(pages)
          .where(eq(pages.versionId, v.id))
          .get();
        const count = pageCount?.count ?? 0;
        totalPageCount += count;
        return { ...v, pageCount: count };
      })
    );

    res.json({
      data: {
        ...project,
        versions: enrichedVersions,
        pageCount: totalPageCount,
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

    const { name, toolName, subdomain, description, logoUrl, iconColor, faviconUrl } = req.body;

    // Validate subdomain format if changing
    if (subdomain && subdomain !== project.subdomain) {
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
        res.status(400).json({ error: 'Subdomain must contain only lowercase letters, digits, and hyphens (2-63 chars)', code: 400 });
        return;
      }
    }

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
      logoUrl: logoUrl !== undefined ? (logoUrl || null) : project.logoUrl,
      iconColor: iconColor !== undefined ? (iconColor || null) : project.iconColor,
      faviconUrl: faviconUrl !== undefined ? (faviconUrl || null) : project.faviconUrl,
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
