/**
 * LL Player detection step.
 * Uses Stagehand extract() for DOM state + Playwright for extension messages.
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import type { BrowserContext } from 'playwright';
import { z } from 'zod';
import { openPopup, sleep } from '../stagehand-helpers.js';

export interface DetectionResult {
	detected: boolean;
	hasCustomElement: boolean;
	hasShadowRoot: boolean;
	elementCount: number;
	signals: string[];
}

export async function detectLLPlayer(stagehand: Stagehand): Promise<DetectionResult> {
	console.log('  Detecting LL Player...');

	try {
		const result = await stagehand.extract(
			'Check the page for a Lemon Learning player. Look for: (1) a <lemon-learning-player> custom HTML element, (2) any element with "lemon-learning" in its ID or class, (3) a floating action button in the bottom-right corner. Report what you find.',
			z.object({
				hasCustomElement: z.boolean().describe('true if <lemon-learning-player> element exists'),
				hasShadowRoot: z.boolean().describe('true if the custom element has a shadow root'),
				elementCount: z.number().describe('number of elements inside the shadow root, 0 if no shadow root'),
				signals: z.array(z.string()).describe('list of detection signals found (e.g. "custom-element", "shadow-root", "fab-visible")'),
			})
		);

		const detected = result.hasCustomElement || result.signals.length > 0;
		console.log(`  LL Player ${detected ? 'DETECTED' : 'NOT FOUND'}: ${result.signals.join(', ')}`);

		return { detected, ...result };
	} catch (err) {
		console.error('  Detection failed:', err);
		return { detected: false, hasCustomElement: false, hasShadowRoot: false, elementCount: 0, signals: [] };
	}
}

export async function detectViaExtension(
	ctx: BrowserContext,
	extensionId: string,
	tabId: number
): Promise<{ detected: boolean; signals: string[] }> {
	console.log('  Detecting via extension message...');

	try {
		const popup = await openPopup(ctx, extensionId);
		const result = await popup.evaluate(async (tid: number) => {
			return new Promise<{ detected: boolean; signals: string[] }>((resolve) => {
				chrome.runtime.sendMessage({ type: 'DETECT_LL_PLAYER', tabId: tid }, (resp) => {
					resolve(resp || { detected: false, signals: [] });
				});
			});
		}, tabId);

		await popup.close();
		console.log(`  Extension detection: ${result.detected ? 'YES' : 'NO'}`);
		return result;
	} catch (err) {
		console.error('  Extension detection failed:', err);
		return { detected: false, signals: [] };
	}
}
