import { Router, Request, Response } from 'express';
import { db, dataDir } from '../db/index.js';
import { pages, versions, projects } from '../db/schema.js';
import { eq, and, ne } from 'drizzle-orm';
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
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'screenshot', maxCount: 1 }
  ]),
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

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const htmlFile = files?.file?.[0];
      const screenshotFile = files?.screenshot?.[0];

      if (!htmlFile) {
        res.status(400).json({ error: 'HTML file is required', code: 400 });
        return;
      }

      // Parse metadata from the request body
      let metadata: {
        urlSource?: string;
        urlPath?: string;
        title?: string;
        captureMode?: string;
        pageType?: string;
        parentPageId?: string;
        domFingerprint?: string;
        syntheticUrl?: string;
        captureTimingMs?: number;
        stateIndex?: number;
        faviconDataUri?: string;
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
          pageType: req.body.pageType,
          parentPageId: req.body.parentPageId,
          domFingerprint: req.body.domFingerprint,
          syntheticUrl: req.body.syntheticUrl,
          captureTimingMs: req.body.captureTimingMs ? parseInt(req.body.captureTimingMs, 10) : undefined,
          stateIndex: req.body.stateIndex ? parseInt(req.body.stateIndex, 10) : undefined,
        };
      }

      if (!metadata.urlSource || !metadata.title) {
        res.status(400).json({
          error: 'urlSource and title are required in metadata',
          code: 400,
        });
        return;
      }

      // Determine page type
      const pageType = (metadata.pageType as 'page' | 'modal' | 'spa_state') || 'page';

      // Generate URL path from source URL if not provided, always normalize
      let urlPath = metadata.urlPath;
      if (!urlPath) {
        if (pageType === 'modal' && metadata.parentPageId) {
          // For modal pages without explicit urlPath, derive from parent
          const parentPage = await db
            .select()
            .from(pages)
            .where(eq(pages.id, metadata.parentPageId))
            .get();
          const parentPath = parentPage?.urlPath || 'index';
          const titleSlug = (metadata.title || 'modal')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
          urlPath = `${parentPath}/__modal/${titleSlug}`;
        } else {
          try {
            const parsed = new URL(metadata.urlSource);
            urlPath = parsed.pathname.replace(/^\/+|\/+$/g, '') || 'index';
          } catch {
            urlPath = 'index';
          }
        }
      } else {
        // Normalize: strip leading/trailing slashes and query string
        try {
          // If it looks like a full URL path with query, strip query
          const qIdx = urlPath.indexOf('?');
          if (qIdx !== -1) urlPath = urlPath.substring(0, qIdx);
        } catch { /* ignore */ }
        urlPath = urlPath.replace(/^\/+|\/+$/g, '') || 'index';
      }

      // Detect HTTP error pages by checking title and HTML content
      let healthStatus: 'ok' | 'warning' | 'error' = 'ok';
      const titleErrorMatch = metadata.title?.match(/^(?:Error\s+)?(\d{3})\b/i);
      if (titleErrorMatch) {
        const code = parseInt(titleErrorMatch[1], 10);
        if (code >= 400 && code < 600) {
          healthStatus = 'error';
          console.warn(`[Pages] HTTP error page detected at upload: ${code} — ${metadata.title} (${metadata.urlSource})`);
        }
      }
      if (healthStatus === 'ok') {
        const htmlHead = htmlFile.buffer.toString('utf-8', 0, Math.min(htmlFile.buffer.length, 2048));
        if (/HTTP\s+ERROR\s+\d{3}/i.test(htmlHead)) {
          healthStatus = 'error';
          console.warn(`[Pages] HTTP error page detected in HTML body: ${metadata.urlSource}`);
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
      fs.writeFileSync(fullPath, htmlFile.buffer);

      // Write screenshot if provided
      let screenshotRelativePath: string | null = null;
      if (screenshotFile) {
        screenshotRelativePath = `uploads/${req.params.versionId}/${pageId}.png`;
        fs.writeFileSync(path.join(dataDir, screenshotRelativePath), screenshotFile.buffer);
      }

      const page = {
        id: pageId,
        versionId: req.params.versionId,
        urlSource: metadata.urlSource,
        urlPath,
        title: metadata.title,
        filePath: relativeFilePath,
        fileSize: htmlFile.size,
        captureMode: (metadata.captureMode as 'free' | 'guided' | 'auto') || 'free',
        thumbnailPath: screenshotRelativePath,
        healthStatus,
        pageType,
        parentPageId: metadata.parentPageId || null,
        domFingerprint: metadata.domFingerprint || null,
        syntheticUrl: metadata.syntheticUrl || null,
        captureTimingMs: metadata.captureTimingMs ?? null,
        stateIndex: metadata.stateIndex ?? null,
        createdAt: new Date().toISOString(),
      };

      await db.insert(pages).values(page);

      // Auto-set project favicon from first capture if project has none
      if (metadata.faviconDataUri) {
        try {
          const project = await db
            .select({ id: projects.id, faviconUrl: projects.faviconUrl })
            .from(projects)
            .innerJoin(versions, eq(versions.projectId, projects.id))
            .where(eq(versions.id, req.params.versionId))
            .get();

          if (project && !project.faviconUrl) {
            await db.update(projects)
              .set({ faviconUrl: metadata.faviconDataUri, updatedAt: new Date().toISOString() })
              .where(eq(projects.id, project.id));
            console.log(`[Pages] Auto-set favicon for project ${project.id} from capture`);
          }
        } catch (err) {
          console.warn('[Pages] Failed to auto-set project favicon:', err);
        }
      }

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

      // Fetch non-modal pages for the tree
      const pageList = await db
        .select()
        .from(pages)
        .where(
          and(
            eq(pages.versionId, req.params.versionId),
            ne(pages.pageType, 'modal')
          )
        )
        .all();

      // Fetch modal pages separately
      const modalList = await db
        .select()
        .from(pages)
        .where(
          and(
            eq(pages.versionId, req.params.versionId),
            eq(pages.pageType, 'modal')
          )
        )
        .all();

      // Group modals by parentPageId
      const modalsByParent = new Map<string, typeof modalList>();
      for (const modal of modalList) {
        if (modal.parentPageId) {
          const existing = modalsByParent.get(modal.parentPageId) || [];
          existing.push(modal);
          modalsByParent.set(modal.parentPageId, existing);
        }
      }

      // Build tree structure from URL paths
      interface TreeNode {
        name: string;
        path: string;
        page?: typeof pageList[number];
        modals?: typeof modalList;
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
            // Attach modals to their parent page node
            const pageModals = modalsByParent.get(page.id);
            if (pageModals && pageModals.length > 0) {
              child.modals = pageModals;
            }
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

    // Include child modals for this page
    const childModals = await db
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.parentPageId, req.params.id),
          eq(pages.pageType, 'modal')
        )
      )
      .all();

    res.json({ data: { ...page, modals: childModals } });
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
 * GET /pages/:id/screenshot
 * Serve the screenshot image for a page (if available).
 */
router.get(
  '/pages/:id/screenshot',
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

      if (!page.thumbnailPath) {
        res.status(404).json({ error: 'No screenshot for this page', code: 404 });
        return;
      }

      const fullPath = path.join(dataDir, page.thumbnailPath);
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'Screenshot file not found on disk', code: 404 });
        return;
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      fs.createReadStream(fullPath).pipe(res);
    } catch (error) {
      console.error('Error serving screenshot:', error);
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

      // Delete the HTML file
      const fullPath = path.join(dataDir, page.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // Delete the screenshot if present
      if (page.thumbnailPath) {
        const screenshotFullPath = path.join(dataDir, page.thumbnailPath);
        if (fs.existsSync(screenshotFullPath)) {
          fs.unlinkSync(screenshotFullPath);
        }
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
