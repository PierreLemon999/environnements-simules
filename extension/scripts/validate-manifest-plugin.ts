/**
 * Vite plugin that validates the Chrome extension manifest after each build.
 * Ensures all JS files referenced in content_scripts, background, etc.
 * actually exist in the dist/ output folder.
 * Fails the build loudly if anything is missing.
 */
import type { Plugin } from 'vite';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export function validateManifest(): Plugin {
	let outDir = 'dist';
	let isWatch = false;

	return {
		name: 'validate-manifest',
		configResolved(config) {
			outDir = config.build.outDir ?? 'dist';
			isWatch = !!config.build.watch;
		},
		closeBundle() {
			const manifestPath = resolve(outDir, 'manifest.json');
			if (!existsSync(manifestPath)) {
				console.warn('\n⚠️  manifest.json not found in dist/ — skipping validation\n');
				return;
			}

			const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
			const missing: string[] = [];

			// Check content_scripts
			if (Array.isArray(manifest.content_scripts)) {
				for (const cs of manifest.content_scripts) {
					for (const js of cs.js ?? []) {
						if (!existsSync(resolve(outDir, js))) {
							missing.push(`content_scripts: ${js}`);
						}
					}
					for (const css of cs.css ?? []) {
						if (!existsSync(resolve(outDir, css))) {
							missing.push(`content_scripts CSS: ${css}`);
						}
					}
				}
			}

			// Check background service worker
			if (manifest.background?.service_worker) {
				const sw = manifest.background.service_worker;
				if (!existsSync(resolve(outDir, sw))) {
					missing.push(`background.service_worker: ${sw}`);
				}
			}

			// Check action popup
			if (manifest.action?.default_popup) {
				const popup = manifest.action.default_popup;
				if (!existsSync(resolve(outDir, popup))) {
					missing.push(`action.default_popup: ${popup}`);
				}
			}

			// Check side_panel
			if (manifest.side_panel?.default_path) {
				const sp = manifest.side_panel.default_path;
				if (!existsSync(resolve(outDir, sp))) {
					missing.push(`side_panel.default_path: ${sp}`);
				}
			}

			if (missing.length > 0) {
				const msg = [
					'',
					'❌ MANIFEST VALIDATION FAILED',
					'The following files are referenced in manifest.json but missing from dist/:',
					...missing.map((m) => `   • ${m}`),
					'',
					'Fix: ensure all entry points in vite.config.ts match the manifest.',
					''
				].join('\n');
				if (isWatch) {
					// In watch mode, don't crash — next rebuild will fix it
					console.warn(msg);
					return;
				}
				throw new Error(msg);
			}

			console.log('\n✅ Manifest validation passed — all referenced files exist in dist/\n');
		}
	};
}
