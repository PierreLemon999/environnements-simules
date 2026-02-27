import { Router, Request, Response } from 'express';
import { db, dataDir } from '../db/index.js';
import { pages, versions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Configure multer for HTML file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
});

const router = Router();

/**
 * POST /versions/:versionId/pages
 * Upload a captured page (multipart: HTML file + metadata JSON).
 */
router.post(
  '/versions/:versionId/pages',
  authenticate,
  requireRole('admin'),
  upload.single('file'),
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

      if (!req.file) {
        res.status(400).json({ error: 'HTML file is required', code: 400 });
        return;
      }

      // Parse metadata from the request body
      let metadata: {
        urlSource?: string;
        urlPath?: string;
        title?: string;
        captureMode?: string;
      } = {};

      if (req.body.metadata) {
        try {
          metadata = JSON.parse(req.body.metadata);
        } catch {
          res.status(400).json({ error: 'Invalid metadata JSON', code: 400 });
          return;
        }
      } else {
        metadata = {
          urlSource: req.body.urlSource,
          urlPath: req.body.urlPath,
          title: req.body.title,
          captureMode: req.body.captureMode,
        };
      }

      if (!metadata.urlSource || !metadata.title) {
        res.status(400).json({
          error: 'urlSource and title are required in metadata',
          code: 400,
        });
        return;
      }

      // Generate URL path from source URL if not provided
      let urlPath = metadata.urlPath;
      if (!urlPath) {
        try {
          const parsed = new URL(metadata.urlSource);
          urlPath = parsed.pathname.replace(/^\/+|\/+$/g, '') || 'index';
        } catch {
          urlPath = 'index';
        }
      }

      const pageId = uuidv4();
      const relativeFilePath = `uploads/${req.params.versionId}/${pageId}.html`;
      const fullPath = path.join(dataDir, relativeFilePath);

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write the HTML file
      fs.writeFileSync(fullPath, req.file.buffer);

      const page = {
        id: pageId,
        versionId: req.params.versionId,
        urlSource: metadata.urlSource,
        urlPath,
        title: metadata.title,
        filePath: relativeFilePath,
        fileSize: req.file.size,
        captureMode: (metadata.captureMode as 'free' | 'guided' | 'auto') || 'free',
        thumbnailPath: null,
        healthStatus: 'ok' as const,
        createdAt: new Date().toISOString(),
      };

      await db.insert(pages).values(page);

      res.status(201).json({ data: page });
    } catch (error) {
      console.error('Error uploading page:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * GET /versions/:versionId/pages
 * List all pages for a version.
 */
router.get(
  '/versions/:versionId/pages',
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

      const pageList = await db
        .select()
        .from(pages)
        .where(eq(pages.versionId, req.params.versionId))
        .all();

      res.json({ data: pageList });
    } catch (error) {
      console.error('Error listing pages:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * GET /versions/:versionId/tree
 * Get tree structure of pages grouped by URL path segments.
 */
router.get(
  '/versions/:versionId/tree',
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

      const pageList = await db
        .select()
        .from(pages)
        .where(eq(pages.versionId, req.params.versionId))
        .all();

      // Build tree structure from URL paths
      interface TreeNode {
        name: string;
        path: string;
        page?: typeof pageList[number];
        children: TreeNode[];
      }

      const root: TreeNode = { name: '/', path: '', children: [] };

      for (const page of pageList) {
        const segments = page.urlPath.split('/').filter(Boolean);
        let current = root;

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const currentPath = segments.slice(0, i + 1).join('/');

          let child = current.children.find((c) => c.name === segment);
          if (!child) {
            child = { name: segment, path: currentPath, children: [] };
            current.children.push(child);
          }

          if (i === segments.length - 1) {
            child.page = page;
          }

          current = child;
        }
      }

      res.json({ data: root });
    } catch (error) {
      console.error('Error building tree:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * GET /pages/:id
 * Get page detail.
 */
router.get('/pages/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const page = await db
      .select()
      .from(pages)
      .where(eq(pages.id, req.params.id))
      .get();

    if (!page) {
      res.status(404).json({ error: 'Page not found', code: 404 });
      return;
    }

    res.json({ data: page });
  } catch (error) {
    console.error('Error getting page:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * PUT /pages/:id
 * Update page metadata.
 */
router.put(
  '/pages/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const page = await db
        .select()
        .from(pages)
        .where(eq(pages.id, req.params.id))
        .get();

      if (!page) {
        res.status(404).json({ error: 'Page not found', code: 404 });
        return;
      }

      const { title, urlPath, healthStatus } = req.body;

      const updated = {
        title: title ?? page.title,
        urlPath: urlPath ?? page.urlPath,
        healthStatus: healthStatus ?? page.healthStatus,
      };

      await db.update(pages).set(updated).where(eq(pages.id, req.params.id));

      res.json({ data: { ...page, ...updated } });
    } catch (error) {
      console.error('Error updating page:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * GET /pages/:id/content
 * Read the raw HTML content of a page.
 */
router.get(
  '/pages/:id/content',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const page = await db
        .select()
        .from(pages)
        .where(eq(pages.id, req.params.id))
        .get();

      if (!page) {
        res.status(404).json({ error: 'Page not found', code: 404 });
        return;
      }

      const fullPath = path.join(dataDir, page.filePath);
      if (!fs.existsSync(fullPath)) {
        res.json({ data: { html: '' } });
        return;
      }

      const html = fs.readFileSync(fullPath, 'utf-8');
      res.json({ data: { html } });
    } catch (error) {
      console.error('Error reading page content:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * PATCH /pages/:id/content
 * Update HTML content of a page (for live edit).
 */
router.patch(
  '/pages/:id/content',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const page = await db
        .select()
        .from(pages)
        .where(eq(pages.id, req.params.id))
        .get();

      if (!page) {
        res.status(404).json({ error: 'Page not found', code: 404 });
        return;
      }

      const { html } = req.body;

      if (!html) {
        res.status(400).json({ error: 'HTML content is required', code: 400 });
        return;
      }

      const fullPath = path.join(dataDir, page.filePath);
      fs.writeFileSync(fullPath, html, 'utf-8');

      // Update file size
      const stats = fs.statSync(fullPath);
      await db
        .update(pages)
        .set({ fileSize: stats.size })
        .where(eq(pages.id, req.params.id));

      res.json({ data: { updated: true, id: req.params.id, fileSize: stats.size } });
    } catch (error) {
      console.error('Error updating page content:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * DELETE /pages/:id
 * Delete a page and its HTML file.
 */
router.delete(
  '/pages/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const page = await db
        .select()
        .from(pages)
        .where(eq(pages.id, req.params.id))
        .get();

      if (!page) {
        res.status(404).json({ error: 'Page not found', code: 404 });
        return;
      }

      // Delete the file
      const fullPath = path.join(dataDir, page.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      await db.delete(pages).where(eq(pages.id, req.params.id));

      res.json({ data: { deleted: true, id: req.params.id } });
    } catch (error) {
      console.error('Error deleting page:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

export default router;
