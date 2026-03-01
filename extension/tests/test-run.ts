#!/usr/bin/env npx tsx
/**
 * Test orchestrator — modular, resumable, Stagehand-powered.
 *
 * Usage:
 *   npx tsx tests/test-run.ts --all                    # Full flow
 *   npx tsx tests/test-run.ts --step=login             # SF + LL + ext login only
 *   npx tsx tests/test-run.ts --step=login,detect      # Login then detect
 *   npx tsx tests/test-run.ts --step=scan              # Scan guides (assumes logged in)
 *   npx tsx tests/test-run.ts --step=capture            # Full capture (assumes ready)
 *   npx tsx tests/test-run.ts --fresh-profile --all    # Wipe profile, full flow
 */

import { createTestBrowser, getExtensionId, sleep, type TestBrowser } from './stagehand-helpers.js';
import { loginToSalesforce } from './steps/sf-login.js';
import { loginToLLPlayer } from './steps/ll-login.js';
import { loginToLemonLab } from './steps/ext-login.js';
import { detectLLPlayer, detectViaExtension } from './steps/detect.js';
import { scanGuides, type ScannedGuide } from './steps/scan.js';
import { runGuidedCapture } from './steps/capture.js';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const VALID_STEPS = ['login', 'detect', 'scan', 'capture'] as const;
type Step = typeof VALID_STEPS[number];

function parseArgs(): { steps: Step[]; freshProfile: boolean } {
	const args = process.argv.slice(2);
	const freshProfile = args.includes('--fresh-profile');

	if (args.includes('--all')) {
		return { steps: [...VALID_STEPS], freshProfile };
	}

	const stepArg = args.find(a => a.startsWith('--step='));
	if (stepArg) {
		const steps = stepArg.replace('--step=', '').split(',').filter(s => VALID_STEPS.includes(s as Step)) as Step[];
		if (steps.length === 0) {
			console.error(`Invalid steps. Valid: ${VALID_STEPS.join(', ')}`);
			process.exit(1);
		}
		return { steps, freshProfile };
	}

	// Default: show usage
	console.log('Usage: npx tsx tests/test-run.ts --all | --step=login,detect,scan,capture [--fresh-profile]');
	process.exit(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getActiveTabId(tb: TestBrowser, extensionId: string): Promise<number> {
	// Find the Salesforce tab and get its tabId via extension
	const popup = await tb.playwright.newPage();
	await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
	await sleep(1000);

	const tabId = await popup.evaluate(async () => {
		return new Promise<number>((resolve) => {
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				// Find SF tab (not extension pages)
				const sfTab = tabs.find(t => t.url?.includes('salesforce.com') || t.url?.includes('force.com'));
				resolve(sfTab?.id || tabs[0]?.id || -1);
			});
		});
	});

	// If no SF tab in active, query all tabs
	if (tabId === -1) {
		const allTabId = await popup.evaluate(async () => {
			return new Promise<number>((resolve) => {
				chrome.tabs.query({}, (tabs) => {
					const sfTab = tabs.find(t => t.url?.includes('salesforce.com') || t.url?.includes('force.com'));
					resolve(sfTab?.id || -1);
				});
			});
		});
		await popup.close();
		return allTabId;
	}

	await popup.close();
	return tabId;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const { steps, freshProfile } = parseArgs();

	console.log('╔══════════════════════════════════════════════╗');
	console.log('║  Lemon Lab — Test Runner (Stagehand)        ║');
	console.log('╚══════════════════════════════════════════════╝');
	console.log(`  Steps: ${steps.join(' → ')}`);
	console.log(`  Fresh profile: ${freshProfile}`);
	console.log('');

	// Build extension if needed
	const { existsSync } = await import('fs');
	const { resolve, dirname } = await import('path');
	const { fileURLToPath } = await import('url');
	const __dirname = dirname(fileURLToPath(import.meta.url));
	if (!existsSync(resolve(__dirname, '../dist/manifest.json'))) {
		console.log('  Extension not built. Run: cd extension && npx vite build');
		process.exit(1);
	}

	const tb = await createTestBrowser({ freshProfile });
	let extensionId = '';

	// Cleanup on exit
	process.on('SIGINT', async () => {
		console.log('\n  Shutting down...');
		await tb.close();
		process.exit(0);
	});

	try {
		// Always need extension ID
		extensionId = await getExtensionId(tb.playwright, 'Lemon Lab');
		if (!extensionId) {
			console.error('  Could not find Lemon Lab extension');
			await tb.close();
			process.exit(1);
		}
		console.log(`  Extension ID: ${extensionId}\n`);

		// ---- STEP: login ----
		if (steps.includes('login')) {
			console.log('━━━ Step: LOGIN ━━━');

			if (!tb.stagehand) {
				console.error('  Stagehand not available — cannot do SF/LL login');
				console.log('  (Only extension login will be attempted)');
			} else {
				// Salesforce
				const sfOk = await loginToSalesforce(tb.stagehand);
				if (!sfOk) {
					console.error('  SF login failed — cannot continue');
					await keepAlive();
					return;
				}

				// Wait for page to stabilize
				await sleep(3000);

				// LL Player
				const llOk = await loginToLLPlayer(tb.stagehand);
				if (!llOk) {
					console.log('  LL Player login failed (may need manual intervention)');
				}
			}

			// Extension
			const extOk = await loginToLemonLab(tb.playwright, extensionId);
			if (!extOk) {
				console.log('  Extension login failed');
			}

			console.log('');
		}

		// ---- STEP: detect ----
		if (steps.includes('detect')) {
			console.log('━━━ Step: DETECT ━━━');

			if (tb.stagehand) {
				const result = await detectLLPlayer(tb.stagehand);
				if (!result.detected) {
					console.log('  LL Player not detected — may need login first');
				}
			} else {
				console.log('  Stagehand not available — skipping visual detection');
			}

			const tabId = await getActiveTabId(tb, extensionId);
			if (tabId > 0) {
				await detectViaExtension(tb.playwright, extensionId, tabId);
			}

			console.log('');
		}

		// ---- STEP: scan ----
		let guides: ScannedGuide[] = [];
		if (steps.includes('scan')) {
			console.log('━━━ Step: SCAN ━━━');

			const tabId = await getActiveTabId(tb, extensionId);
			if (tabId <= 0) {
				console.error('  No Salesforce tab found');
			} else {
				guides = await scanGuides(tb.playwright, extensionId, tabId);
			}

			console.log('');
		}

		// ---- STEP: capture ----
		if (steps.includes('capture')) {
			console.log('━━━ Step: CAPTURE ━━━');

			const tabId = await getActiveTabId(tb, extensionId);
			if (tabId <= 0) {
				console.error('  No Salesforce tab found');
			} else {
				// Scan if not done yet
				if (guides.length === 0) {
					guides = await scanGuides(tb.playwright, extensionId, tabId);
				}

				if (guides.length === 0) {
					console.log('  No guides found — cannot capture');
				} else {
					// Pick first guide with multiple steps for testing
					const target = guides.find(g => g.stepCount >= 2) || guides[0];
					console.log(`  Capturing guide: "${target.name}" (${target.stepCount} steps)`);

					if (!tb.stagehand) {
						console.log('  Stagehand not available — cannot run visual capture monitoring');
					} else {
						const result = await runGuidedCapture(
							tb.stagehand, tb.playwright, extensionId,
							[target], tabId,
							{ mode: 'auto', timeoutMs: 180_000 }
						);

						console.log(`  Result: ${result.success ? 'SUCCESS' : 'FAILED'} — ${result.pagesCaptured} pages in ${(result.duration / 1000).toFixed(0)}s`);
						if (result.error) console.log(`  Error: ${result.error}`);
					}
				}
			}

			console.log('');
		}

		console.log('══════════════════════════════════════════════');
		console.log('  All steps complete. Browser kept open.');
		console.log('  Press Ctrl+C to exit.');
		console.log('══════════════════════════════════════════════');

		await keepAlive();
	} catch (err) {
		console.error('  Fatal error:', err);
		await tb.close();
		process.exit(1);
	}
}

function keepAlive(): Promise<never> {
	return new Promise(() => {}); // Block forever
}

main();
