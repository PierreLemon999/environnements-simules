import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { chromeExtensionReload } from './scripts/reload-plugin';
import { validateManifest } from './scripts/validate-manifest-plugin';

const manifest = JSON.parse(readFileSync(resolve(__dirname, 'public/manifest.json'), 'utf-8'));

// ⚠ DEV AUTO-RELOAD SYSTEM — read before changing build config!
// Three pieces work together to auto-reload the extension during `npm run dev`:
//   1. chromeExtensionReload() plugin (scripts/reload-plugin.ts)
//      → starts HTTP server on port 38587, updates timestamp after each rebuild
//   2. Service worker polling (src/background/service-worker.ts, bottom of file)
//      → polls http://127.0.0.1:38587 every 1.5s, calls chrome.runtime.reload() on change
//   3. This config: emptyOutDir=false + no hash in chunk names during dev
//      → prevents Chrome from breaking when dist/ files are overwritten
//
// CRITICAL: In dev mode, chunk filenames MUST be stable (no [hash]).
// If you add [hash] to chunkFileNames in dev, Chrome will fail to load
// the service worker after a rebuild because it references the old filename.
// Similarly, emptyOutDir MUST be false in dev — wiping dist/ while Chrome
// has the extension loaded causes "service worker registration failed" (status 15).

const isDev = process.argv.includes('--mode') && process.argv.includes('development');

export default defineConfig(({ mode }) => ({
	define: {
		__APP_VERSION__: JSON.stringify(manifest.version),
		__BUILD_HASH__: JSON.stringify(Date.now().toString(36).slice(-6))
	},
	plugins: [svelte(), validateManifest(), ...(mode === 'development' ? [chromeExtensionReload()] : [])],
	base: './',
	build: {
		outDir: 'dist',
		emptyOutDir: !isDev,
		rollupOptions: {
			input: {
				popup: resolve(__dirname, 'src/popup/index.html'),
				sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
				background: resolve(__dirname, 'src/background/service-worker.ts'),
				content: resolve(__dirname, 'src/content/content-script.ts'),
				'capture-hooks': resolve(__dirname, 'src/content/capture-hooks.ts')
			},
			output: {
				// Inline all chunks into entry files — Chrome MV3 service workers
				// don't support dynamic imports from separate chunk files
				inlineDynamicImports: false,
				manualChunks: undefined,
				entryFileNames: (chunkInfo) => {
					if (chunkInfo.name === 'background') return 'background/service-worker.js';
					if (chunkInfo.name === 'content') return 'content/content-script.js';
					if (chunkInfo.name === 'capture-hooks') return 'content/capture-hooks.js';
					if (chunkInfo.name === 'sidepanel') return 'sidepanel/[name].js';
					return 'popup/[name].js';
				},
				// Stable chunk names in dev (no hash) so Chrome doesn't break on rebuild
				chunkFileNames: mode === 'development' ? 'shared/[name].js' : 'shared/[name]-[hash].js',
				assetFileNames: (assetInfo) => {
					if (assetInfo.names?.[0]?.endsWith('.css')) {
						return 'assets/[name][extname]';
					}
					return 'assets/[name][extname]';
				}
			}
		},
		target: 'esnext',
		minify: false,
		sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false
	},
	resolve: {
		alias: {
			'$lib': resolve(__dirname, 'src/lib')
		}
	}
}));
