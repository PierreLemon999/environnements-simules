/**
 * Production server: single HTTP server dispatching to Express (API) and SvelteKit (frontend).
 * Express also listens on localhost:3001 for SvelteKit SSR proxy requests.
 */
import http from 'http';
import app from './index.js';

// Import SvelteKit handler (built by adapter-node)
const { handler: svelteHandler } = await import('../../frontend/build/handler.js');

const PORT = parseInt(process.env.PORT || '8080', 10);

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // Route API, demo, and upload requests to Express
  if (url.startsWith('/api/') || url.startsWith('/demo/') || url.startsWith('/uploads/')) {
    app(req, res);
  } else {
    // Everything else goes to SvelteKit
    svelteHandler(req, res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running on http://0.0.0.0:${PORT}`);
});
