import { Router, Request, Response } from 'express';
import { serveDemoPage, NotFoundError } from '../services/demo-serving.js';

const router = Router();

/** HTML-escape for safe interpolation into HTML responses */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GET /demo/:subdomain/*
 * Serve a captured page as a demo.
 * Finds the project by subdomain, active version, matching page,
 * then applies obfuscation, link rewriting, and tag manager injection.
 */
router.get('/:subdomain', handleDemoRequest);
router.get('/:subdomain/{*path}', handleDemoRequest);

async function handleDemoRequest(req: Request, res: Response): Promise<void> {
  try {
    const { subdomain } = req.params;
    // Express 5 / path-to-regexp 8.x: {*path} captures the rest of the URL
    const pathParam = (req.params as Record<string, string | string[]>).path;
    const requestPath = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');

    const result = await serveDemoPage(subdomain, requestPath);

    // Set appropriate headers for serving HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Sanitize header values to prevent header injection (strip newlines/control chars)
    res.setHeader('X-Demo-Project', result.project.name.replace(/[\r\n\x00-\x1f]/g, ''));
    res.setHeader('X-Demo-Page', result.page.title.replace(/[\r\n\x00-\x1f]/g, ''));

    // Disable caching for demo pages (content may change with obfuscation rules)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.send(result.html);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head><title>Page non trouvée</title></head>
        <body>
          <h1>404 - Page non trouvée</h1>
          <p>${escapeHtml(error.message)}</p>
        </body>
        </html>
      `);
      return;
    }

    console.error('Error serving demo page:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head><title>Erreur</title></head>
      <body>
        <h1>500 - Erreur interne</h1>
        <p>Une erreur est survenue lors du chargement de la page.</p>
      </body>
      </html>
    `);
  }
}

export default router;
