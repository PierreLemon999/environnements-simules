/**
 * Vite plugin that triggers Chrome extension reload after each rebuild.
 *
 * Writes a timestamp to dist/__reload__ after each build.
 * The service worker watches this file and calls chrome.runtime.reload().
 */
import type { Plugin } from 'vite';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

export function chromeExtensionReload(): Plugin {
	let outDir = 'dist';

	return {
		name: 'chrome-extension-reload',
		configResolved(config) {
			outDir = config.build.outDir ?? 'dist';
		},
		writeBundle() {
			try {
				const dir = resolve(outDir);
				mkdirSync(dir, { recursive: true });
				writeFileSync(resolve(dir, 'hot-reload.json'), JSON.stringify({ ts: Date.now() }));
			} catch {
				// Ignore errors
			}
		}
	};
}
