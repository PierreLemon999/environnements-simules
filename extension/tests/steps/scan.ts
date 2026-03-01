/**
 * Guide scanning step.
 * Uses Playwright (extension messaging for SCAN_LL_GUIDES).
 */

import type { BrowserContext } from 'playwright';
import { openPopup } from '../stagehand-helpers.js';

export interface ScannedGuide {
	id: string | number;
	name: string;
	stepCount: number;
	steps?: unknown[];
}

export async function scanGuides(
	ctx: BrowserContext,
	extensionId: string,
	tabId: number
): Promise<ScannedGuide[]> {
	console.log('  Scanning guides via extension...');

	try {
		const popup = await openPopup(ctx, extensionId);
		const result = await popup.evaluate(async (tid: number) => {
			return new Promise<{ guides?: Array<{ id: string | number; name: string; stepCount: number; steps?: unknown[] }> }>((resolve) => {
				chrome.runtime.sendMessage({ type: 'SCAN_LL_GUIDES', tabId: tid }, (resp) => {
					resolve(resp || {});
				});
			});
		}, tabId);

		await popup.close();

		const guides = result?.guides || [];
		console.log(`  Found ${guides.length} guides:`);
		for (const g of guides) {
			console.log(`    - ${g.name} (${g.stepCount} steps)`);
		}
		return guides;
	} catch (err) {
		console.error('  Scan failed:', err);
		return [];
	}
}
