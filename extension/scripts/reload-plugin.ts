/**
 * Vite plugin — extension auto-reload during `vite build --watch`.
 *
 * Starts a tiny HTTP server on port 38587 that serves a timestamp.
 * The service worker polls this endpoint every 1.5s and calls
 * chrome.runtime.reload() when the timestamp changes.
 *
 * Why HTTP instead of reading a file from the extension?
 * → Chrome caches chrome-extension:// files aggressively; even with
 *   cache-busting query params, fetch() returns stale data.
 */
import type { Plugin } from 'vite';
import { createServer, type Server } from 'http';

const RELOAD_PORT = 38587;

let server: Server | null = null;
let currentTs = '';

export function chromeExtensionReload(): Plugin {
	return {
		name: 'chrome-extension-reload',
		buildStart() {
			if (server) return;

			currentTs = String(Date.now());

			server = createServer((req, res) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.setHeader('Cache-Control', 'no-store');
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify({ ts: currentTs }));
			});

			server.listen(RELOAD_PORT, '127.0.0.1', () => {
				console.log(`\n  Extension reload server on http://127.0.0.1:${RELOAD_PORT}\n`);
			});

			// Don't prevent process exit in non-watch (single build) mode
			server.unref();

			server.on('error', (err: NodeJS.ErrnoException) => {
				if (err.code === 'EADDRINUSE') {
					console.warn(`  ⚠ Port ${RELOAD_PORT} in use — reload server skipped`);
					server = null;
				}
			});
		},
		writeBundle() {
			// Update timestamp after each successful build
			currentTs = String(Date.now());
		},
		closeBundle() {
			// Don't close in watch mode — keep server running
		},
	};
}
