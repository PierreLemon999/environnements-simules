/**
 * Guided capture step.
 * Triggers capture via extension message, monitors via Stagehand extract().
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import type { BrowserContext } from 'playwright';
import { z } from 'zod';
import { openPopup, sleep } from '../stagehand-helpers.js';
import type { ScannedGuide } from './scan.js';

export interface CaptureResult {
	success: boolean;
	pagesCaptured: number;
	duration: number;
	error?: string;
}

async function getCaptureState(ctx: BrowserContext, extensionId: string): Promise<unknown> {
	try {
		const popup = await openPopup(ctx, extensionId);
		const state = await popup.evaluate(async () => {
			return new Promise((resolve) => {
				chrome.storage.local.get(null, (items) => {
					const stateKey = Object.keys(items).find(k => k.startsWith('capture_state:'));
					resolve(stateKey ? items[stateKey] : null);
				});
			});
		});
		await popup.close();
		return state;
	} catch { return null; }
}

export async function runGuidedCapture(
	stagehand: Stagehand,
	ctx: BrowserContext,
	extensionId: string,
	guides: ScannedGuide[],
	tabId: number,
	opts: { mode: 'auto' | 'manual'; timeoutMs?: number }
): Promise<CaptureResult> {
	console.log(`  Starting guided capture (${opts.mode} mode, ${guides.length} guides)...`);
	const start = Date.now();
	const timeout = opts.timeoutMs || 120_000;

	// Trigger capture via extension message
	try {
		const popup = await openPopup(ctx, extensionId);
		await popup.evaluate(async (params: { tabId: number; guides: ScannedGuide[]; mode: string }) => {
			return new Promise((resolve) => {
				chrome.runtime.sendMessage({
					type: 'START_GUIDED_CAPTURE',
					tabId: params.tabId,
					guides: params.guides.map(g => ({ ...g, selected: true })),
					executionMode: params.mode,
				}, resolve);
			});
		}, { tabId, guides, mode: opts.mode });
		await popup.close();
		console.log('    Capture triggered');
	} catch (err) {
		return { success: false, pagesCaptured: 0, duration: 0, error: `Trigger failed: ${err}` };
	}

	// Monitor progress
	let lastLog = '';
	while (Date.now() - start < timeout) {
		await sleep(5000);

		const state = await getCaptureState(ctx, extensionId) as {
			isRunning?: boolean;
			pages?: unknown[];
			guided?: { status?: string; currentStepIndex?: number; totalSteps?: number; currentGuideName?: string };
		} | null;

		// Visual check via Stagehand
		let visual: { bubbleVisible: boolean; stepIndicator?: string } | null = null;
		try {
			visual = await stagehand.extract(
				'Check if there is a Lemon Learning guide bubble overlay visible on the page. If yes, what step number is shown (e.g. "2/5")?',
				z.object({
					bubbleVisible: z.boolean().describe('true if a guide instruction bubble is visible'),
					stepIndicator: z.string().optional().describe('step indicator text like "2/5" if visible'),
				})
			);
		} catch { /* stagehand may fail if page navigated */ }

		const elapsed = ((Date.now() - start) / 1000).toFixed(0);
		const pages = state?.pages?.length || 0;
		const status = state?.guided?.status || 'unknown';
		const step = state?.guided?.currentStepIndex ?? '?';
		const total = state?.guided?.totalSteps ?? '?';
		const guide = state?.guided?.currentGuideName || '?';
		const bubble = visual?.bubbleVisible ? `bubble:${visual.stepIndicator || 'yes'}` : 'no-bubble';

		const logLine = `[${elapsed}s] ${status} | guide:${guide} step:${step}/${total} | pages:${pages} | ${bubble}`;
		if (logLine !== lastLog) {
			console.log(`    ${logLine}`);
			lastLog = logLine;
		}

		if (state && state.isRunning === false) {
			console.log('    Capture finished');
			return {
				success: true,
				pagesCaptured: pages,
				duration: Date.now() - start,
			};
		}
	}

	console.log('    Capture timeout');
	return {
		success: false,
		pagesCaptured: 0,
		duration: Date.now() - start,
		error: 'Timeout',
	};
}
