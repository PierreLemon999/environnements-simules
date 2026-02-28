import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { chromeExtensionReload } from './scripts/reload-plugin';
import { validateManifest } from './scripts/validate-manifest-plugin';

const manifest = JSON.parse(readFileSync(resolve(__dirname, 'public/manifest.json'), 'utf-8'));

export default defineConfig(({ mode }) => ({
	define: {
		__APP_VERSION__: JSON.stringify(manifest.version),
		__BUILD_HASH__: JSON.stringify(Date.now().toString(36).slice(-6))
	},
	plugins: [svelte(), validateManifest(), ...(mode === 'development' ? [chromeExtensionReload()] : [])],
	base: './',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
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
				chunkFileNames: 'shared/[name]-[hash].js',
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
