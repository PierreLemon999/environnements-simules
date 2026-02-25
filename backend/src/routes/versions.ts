import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { versions, pages, projects } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { dataDir } from '../db/index.js';

const router = Router();

/**
 * GET /projects/:projectId/versions
 * List all versions for a project.
 */
router.get(
  '/projects/:projectId/versions',
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

      const versionList = await db
        .select()
        .from(versions)
        .where(eq(versions.projectId, req.params.projectId))
        .all();

      res.json({ data: versionList });
    } catch (error) {
      console.error('Error listing versions:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * POST /projects/:projectId/versions
 * Create a new version for a project.
 */
router.post(
  '/projects/:projectId/versions',
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

      const { name, status, language } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Version name is required', code: 400 });
        return;
      }

      const version = {
        id: uuidv4(),
        projectId: req.params.projectId,
        name,
        status: status || 'active',
        language: language || 'fr',
        authorId: req.user!.userId,
        createdAt: new Date().toISOString(),
      };

      await db.insert(versions).values(version);

      res.status(201).json({ data: version });
    } catch (error) {
      console.error('Error creating version:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * PUT /versions/:id
 * Update version (status, name, language).
 */
router.put(
  '/versions/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const version = await db
        .select()
        .from(versions)
        .where(eq(versions.id, req.params.id))
        .get();

      if (!version) {
        res.status(404).json({ error: 'Version not found', code: 404 });
        return;
      }

      const { name, status, language } = req.body;

      const updated = {
        name: name ?? version.name,
        status: status ?? version.status,
        language: language ?? version.language,
      };

      await db.update(versions).set(updated).where(eq(versions.id, req.params.id));

      res.json({ data: { ...version, ...updated } });
    } catch (error) {
      console.error('Error updating version:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * POST /versions/:id/duplicate
 * Duplicate (fork) a version with all its pages.
 */
router.post(
  '/versions/:id/duplicate',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const sourceVersion = await db
        .select()
        .from(versions)
        .where(eq(versions.id, req.params.id))
        .get();

      if (!sourceVersion) {
        res.status(404).json({ error: 'Version not found', code: 404 });
        return;
      }

      const { name } = req.body;
      const newVersionId = uuidv4();

      // Create the new version
      const newVersion = {
        id: newVersionId,
        projectId: sourceVersion.projectId,
        name: name || `${sourceVersion.name} (copie)`,
        status: 'test' as const,
        language: sourceVersion.language,
        authorId: req.user!.userId,
        createdAt: new Date().toISOString(),
      };

      await db.insert(versions).values(newVersion);

      // Duplicate all pages
      const sourcePages = await db
        .select()
        .from(pages)
        .where(eq(pages.versionId, req.params.id))
        .all();

      for (const sourcePage of sourcePages) {
        const newPageId = uuidv4();
        const newFilePath = `uploads/${newVersionId}/${newPageId}.html`;
        const fullNewPath = path.join(dataDir, newFilePath);

        // Create directory for the new version
        const newVersionDir = path.dirname(fullNewPath);
        if (!fs.existsSync(newVersionDir)) {
          fs.mkdirSync(newVersionDir, { recursive: true });
        }

        // Copy the HTML file
        const sourceFilePath = path.join(dataDir, sourcePage.filePath);
        if (fs.existsSync(sourceFilePath)) {
          fs.copyFileSync(sourceFilePath, fullNewPath);
        }

        await db.insert(pages).values({
          id: newPageId,
          versionId: newVersionId,
          urlSource: sourcePage.urlSource,
          urlPath: sourcePage.urlPath,
          title: sourcePage.title,
          filePath: newFilePath,
          fileSize: sourcePage.fileSize,
          captureMode: sourcePage.captureMode,
          thumbnailPath: null,
          healthStatus: sourcePage.healthStatus,
          createdAt: new Date().toISOString(),
        });
      }

      res.status(201).json({
        data: {
          ...newVersion,
          pagesCopied: sourcePages.length,
        },
      });
    } catch (error) {
      console.error('Error duplicating version:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * DELETE /versions/:id
 * Delete a version and all its pages.
 */
router.delete(
  '/versions/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const version = await db
        .select()
        .from(versions)
        .where(eq(versions.id, req.params.id))
        .get();

      if (!version) {
        res.status(404).json({ error: 'Version not found', code: 404 });
        return;
      }

      // Delete the version's upload directory
      const versionDir = path.join(dataDir, 'uploads', req.params.id);
      if (fs.existsSync(versionDir)) {
        fs.rmSync(versionDir, { recursive: true, force: true });
      }

      await db.delete(versions).where(eq(versions.id, req.params.id));

      res.json({ data: { deleted: true, id: req.params.id } });
    } catch (error) {
      console.error('Error deleting version:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * GET /versions/:id/export
 * Export a version as a .zip file containing all pages + metadata.
 */
router.get(
  '/versions/:id/export',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const version = await db
        .select()
        .from(versions)
        .where(eq(versions.id, req.params.id))
        .get();

      if (!version) {
        res.status(404).json({ error: 'Version not found', code: 404 });
        return;
      }

      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, version.projectId))
        .get();

      const versionPages = await db
        .select()
        .from(pages)
        .where(eq(pages.versionId, req.params.id))
        .all();

      // Set headers for zip download
      const filename = `${project?.subdomain || 'export'}-${version.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.pipe(res);

      // Add metadata JSON
      const metadata = {
        project: {
          id: project?.id,
          name: project?.name,
          toolName: project?.toolName,
          subdomain: project?.subdomain,
        },
        version: {
          id: version.id,
          name: version.name,
          status: version.status,
          language: version.language,
          createdAt: version.createdAt,
        },
        pages: versionPages.map((p) => ({
          id: p.id,
          title: p.title,
          urlSource: p.urlSource,
          urlPath: p.urlPath,
          fileSize: p.fileSize,
          captureMode: p.captureMode,
          healthStatus: p.healthStatus,
          createdAt: p.createdAt,
        })),
        exportedAt: new Date().toISOString(),
      };

      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      // Add HTML files
      for (const pg of versionPages) {
        const filePath = path.join(dataDir, pg.filePath);
        if (fs.existsSync(filePath)) {
          // Use the URL path as filename (cleaned up)
          const pageName = pg.urlPath.replace(/^\//, '').replace(/\//g, '_') || 'index';
          archive.file(filePath, { name: `pages/${pageName}.html` });
        }
      }

      await archive.finalize();
    } catch (error) {
      console.error('Error exporting version:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error', code: 500 });
      }
    }
  }
);

export default router;
