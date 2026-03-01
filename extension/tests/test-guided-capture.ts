/**
 * Automated test: Guided capture flow on Salesforce
 *
 * Tests the full guided capture pipeline:
 *   1. Launch Chrome with extensions (Lemon Lab + LL Player)
 *   2. Login to Salesforce + LL Player
 *   3. Scan guides from React Query cache
 *   4. Launch guided capture in auto mode via service worker
 *   5. Observe progress (bubble detection, step capture)
 *   6. Report results
 *
 * Usage: npx tsx tests/test-guided-capture.ts
 *
 * This is an exploratory/learning test — it logs rich diagnostics
 * to help iterate on the guided capture system.
 */

import type { Page, BrowserContext } from 'playwright';
import {
	launchBrowser,
	getExtensionId,
	loginToSalesforce,
	loginToLLPlayer,
	loginToLemonLab,
	openLLPlayerPanel,
	findSalesforcePage,
	openPopup,
	sleep,
	screenshot,
} from './helpers';

// ---------------------------------------------------------------------------
// Step 0 — Ensure active project + version is set (required for capture)
// ---------------------------------------------------------------------------

async function ensureActiveProjectVersion(
	context: BrowserContext,
	extensionId: string
): Promise<{ projectId?: string; versionId?: string }> {
	console.log('  Setting up active project/version...');

	const sw = context.serviceWorkers().find(w =>
		w.url().includes(extensionId) && w.url().includes('service-worker')
	);
	if (!sw) { console.log('  No service worker found'); return {}; }

	// Check if already set
	const current = await sw.evaluate(() => {
		return new Promise<{ hasVersion: boolean; versionId?: string; projectId?: string }>(resolve => {
			chrome.storage.local.get(['active_version', 'active_project'], result => {
				resolve({
					hasVersion: !!result.active_version?.id,
					versionId: result.active_version?.id,
					projectId: result.active_project?.id
				});
			});
		});
	});

	if (current.hasVersion) {
		console.log(`  Already set: project=${current.projectId}, version=${current.versionId}`);
		return { projectId: current.projectId, versionId: current.versionId };
	}

	// Use the popup relay to call the API via the extension's message system
	const relay = await openPopup(context, extensionId);

	try {
		// Fetch projects
		const projects = await relay.evaluate(async () => {
			const res = await chrome.runtime.sendMessage({ type: 'GET_PROJECTS' });
			return res;
		}).catch(() => null);

		let projectId: string | undefined;
		let versionId: string | undefined;

		const projectList = (projects as any)?.data || [];
		if (projectList.length > 0) {
			projectId = projectList[0].id;
			console.log(`  Found project: "${projectList[0].name}" (${projectId})`);

			// Fetch versions for this project
			const versions = await relay.evaluate(async (pid: string) => {
				const res = await chrome.runtime.sendMessage({ type: 'GET_VERSIONS', projectId: pid });
				return res;
			}, projectId).catch(() => null);

			const versionList = (versions as any)?.data || [];
			if (versionList.length > 0) {
				versionId = versionList[0].id;
				console.log(`  Found version: "${versionList[0].name}" (${versionId})`);
			} else {
				// Create a version
				const newVer = await relay.evaluate(async (pid: string) => {
					return chrome.runtime.sendMessage({ type: 'CREATE_VERSION', projectId: pid, name: 'Test capture' });
				}, projectId).catch(() => null);
				versionId = (newVer as any)?.data?.id;
				console.log(`  Created version: ${versionId}`);
			}
		} else {
			// Create a project (with auto-version)
			const newProj = await relay.evaluate(async () => {
				return chrome.runtime.sendMessage({ type: 'CREATE_PROJECT', name: 'Salesforce Test', toolName: 'Salesforce' });
			}).catch(() => null);
			projectId = (newProj as any)?.data?.id;
			console.log(`  Created project: ${projectId}`);

			// Fetch the auto-created version
			if (projectId) {
				const versions = await relay.evaluate(async (pid: string) => {
					return chrome.runtime.sendMessage({ type: 'GET_VERSIONS', projectId: pid });
				}, projectId).catch(() => null);
				versionId = ((versions as any)?.data || [])[0]?.id;
				console.log(`  Auto-created version: ${versionId}`);
			}
		}

		// Set active project + version in storage
		if (projectId && versionId) {
			const project = projectList.find((p: any) => p.id === projectId) || { id: projectId, name: 'Salesforce Test' };
			const version = { id: versionId, name: 'Test capture' };

			await sw.evaluate(({ project, version }) => {
				return new Promise<void>(resolve => {
					chrome.storage.local.set({
						active_project: project,
						active_version: version
					}, () => resolve());
				});
			}, { project, version });

			console.log(`  Active project/version set`);
		}

		await relay.close();
		return { projectId, versionId };
	} catch (err) {
		console.log('  Setup failed:', String(err).substring(0, 200));
		await relay.close();
		return {};
	}
}

// ---------------------------------------------------------------------------
// Step 1 — Scan guides via React Query cache (same logic as our extension)
// ---------------------------------------------------------------------------

async function scanGuidesFromPage(page: Page): Promise<{
	guides: Array<{ id: string; name: string; stepCount: number; hasSteps: boolean }>;
	cacheFound: boolean;
	rawCacheKeys: string[];
}> {
	return page.evaluate(() => {
		try {
			const raw = localStorage.getItem('REACT_QUERY_OFFLINE_CACHE');
			if (!raw) return { guides: [], cacheFound: false, rawCacheKeys: [] };

			const parsed = JSON.parse(raw);
			const queries: Array<{ queryKey: unknown[]; state?: { data?: unknown } }> =
				parsed?.clientState?.queries || [];

			const cacheKeys = queries.map(q => JSON.stringify(q.queryKey).substring(0, 120));

			const guides: Array<{ id: string; name: string; stepCount: number; hasSteps: boolean }> = [];

			for (const q of queries) {
				const data = q.state?.data;
				if (!data || typeof data !== 'object') continue;

				// Section query — contains array of guides
				const sections = (data as any)?.data || (data as any)?.sections || data;
				if (!Array.isArray(sections)) continue;

				for (const section of sections) {
					const guidesList = section?.guides || section?.items || [];
					if (!Array.isArray(guidesList)) continue;

					for (const g of guidesList) {
						const id = String(g.id || g.guide_id || '');
						const name = g.name || g.title || g.guide_name || '';
						const steps = g.steps || g.guide_steps || [];
						if (id && name) {
							guides.push({
								id,
								name,
								stepCount: Array.isArray(steps) ? steps.length : (g.step_count || g.steps_count || 0),
								hasSteps: Array.isArray(steps) && steps.length > 0,
							});
						}
					}
				}
			}

			return { guides, cacheFound: true, rawCacheKeys: cacheKeys };
		} catch (err) {
			return { guides: [], cacheFound: false, rawCacheKeys: [String(err).substring(0, 200)] };
		}
	});
}

// ---------------------------------------------------------------------------
// Step 2 — Trigger guided capture via extension messages
// ---------------------------------------------------------------------------

async function triggerGuidedCapture(
	context: BrowserContext,
	extensionId: string,
	tabId: number,
	guides: Array<{ id: string; name: string; stepCount: number }>,
	mode: 'auto' | 'manual' = 'auto',
): Promise<{ started: boolean; error?: string }> {
	// We cannot use chrome.runtime.sendMessage from Playwright directly.
	// Instead, we execute code in the extension's service worker context.
	const swUrl = `chrome-extension://${extensionId}/background/service-worker.js`;
	const sw = context.serviceWorkers().find(w => w.url() === swUrl);

	if (sw) {
		// Use service worker evaluation — pass message to the handler
		try {
			const result = await sw.evaluate(
				({ guides, mode, tabId }) => {
					// Access the message handler that's already registered
					return (self as any).__testTriggerGuidedCapture?.({ guides, mode, tabId });
				},
				{ guides, mode, tabId }
			);
			return { started: !!result };
		} catch {
			// Fallback to popup-based approach
		}
	}

	// Fallback: Open popup and trigger via UI simulation
	// The extension popup sends START_GUIDED_CAPTURE to the service worker
	// We'll simulate this by using the popup page
	return { started: false, error: 'Service worker evaluation not available — use popup flow' };
}

// ---------------------------------------------------------------------------
// Step 3 — Monitor capture state
// ---------------------------------------------------------------------------

async function getCaptureState(context: BrowserContext, extensionId: string): Promise<unknown> {
	const sw = context.serviceWorkers().find(w =>
		w.url().includes(extensionId) && w.url().includes('service-worker')
	);

	if (sw) {
		try {
			return await sw.evaluate(() => {
				return new Promise(resolve => {
					// State is stored per-version: capture_state:<versionId>
					chrome.storage.local.get(['active_version'], vr => {
						const versionId = vr?.active_version?.id;
						if (!versionId) { resolve(null); return; }
						const key = `capture_state:${versionId}`;
						chrome.storage.local.get([key], result => {
							resolve(result?.[key] || null);
						});
					});
				});
			});
		} catch {}
	}

	return null;
}

// ---------------------------------------------------------------------------
// Step 4 — Test via extension popup page (used as message relay)
// The popup page can call chrome.runtime.sendMessage to the service worker.
// We pass an explicit tabId so it doesn't matter which tab is "active".
// ---------------------------------------------------------------------------

async function getSfTabId(context: BrowserContext, extensionId: string): Promise<number | null> {
	const sw = context.serviceWorkers().find(w =>
		w.url().includes(extensionId) && w.url().includes('service-worker')
	);
	if (!sw) return null;

	return sw.evaluate(() => {
		return new Promise<number | null>(resolve => {
			chrome.tabs.query({}, tabs => {
				const sf = tabs.find(t =>
					(t.url?.includes('salesforce.com') || t.url?.includes('force.com'))
					&& !t.url?.includes('login.salesforce.com')
				);
				resolve(sf?.id ?? null);
			});
		});
	});
}

async function sendExtMessage(relayPage: Page, msg: Record<string, unknown>): Promise<unknown> {
	return relayPage.evaluate(async (m) => {
		return chrome.runtime.sendMessage(m);
	}, msg);
}

async function testGuidedCapture(
	context: BrowserContext,
	extensionId: string,
	sfPage: Page,
): Promise<void> {
	console.log('\n--- Test: Guided capture ---');

	// Open a popup page to use as message relay
	const relay = await context.newPage();
	await relay.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
	await sleep(1500);

	// Get SF tab ID via service worker
	const tabId = await getSfTabId(context, extensionId);
	console.log('  SF tab ID:', tabId);
	if (!tabId) {
		console.log('  No Salesforce tab found');
		await relay.close();
		return;
	}

	// Step 1: Detect LL Player
	console.log('  Detecting LL Player...');
	const detectResult = await sendExtMessage(relay, { type: 'DETECT_LL_PLAYER', tabId })
		.catch(err => ({ error: String(err).substring(0, 200) }));

	console.log('  Detection:', JSON.stringify(detectResult, null, 2)?.substring(0, 400));

	const detected = (detectResult as any)?.detected === true;
	if (!detected) {
		console.log('  LL Player not detected');
		const diag = (detectResult as any)?.diagnostics;
		if (diag) console.log('  Diagnostics:', JSON.stringify(diag, null, 2)?.substring(0, 500));
		await relay.close();
		return;
	}

	// Step 2: Scan guides
	console.log('  Scanning guides...');
	const scanResult = await sendExtMessage(relay, { type: 'SCAN_LL_GUIDES', tabId })
		.catch(err => ({ error: String(err).substring(0, 200) }));

	console.log('  Scan:', JSON.stringify(scanResult, null, 2)?.substring(0, 500));

	const guides = (scanResult as any)?.guides || [];
	console.log(`  Found ${guides.length} guides`);

	if (guides.length > 0) {
		for (const g of guides.slice(0, 5)) {
			const stepsInfo = g.steps ? ` (${g.steps.length} steps detailed)` : '';
			console.log(`    [${g.id}] "${g.name}" — ${g.stepCount} steps${stepsInfo}`);
		}

		// Step 3: Start guided capture (pick shortest guide with >=2 steps)
		const sorted = [...guides].sort((a: any, b: any) => a.stepCount - b.stepCount);
		const target = sorted.find((g: any) => g.stepCount >= 2) || sorted[0];
		console.log(`\n  Starting capture: "${target.name}" (${target.stepCount} steps) — auto mode`);

		const startResult = await sendExtMessage(relay, {
			type: 'START_GUIDED_CAPTURE',
			tabId,
			guides: [{ ...target, selected: true }],
			executionMode: 'auto',
		}).catch(err => ({ error: String(err).substring(0, 200) }));

		console.log('  Start:', JSON.stringify(startResult)?.substring(0, 200));

		// Check initial state immediately
		await sleep(2000);
		const initialState = await getCaptureState(context, extensionId);
		console.log('  Initial state:', JSON.stringify(initialState, null, 0)?.substring(0, 500) || 'null');

		// Also check active version (required for upload)
		const sw = context.serviceWorkers().find(w =>
			w.url().includes(extensionId) && w.url().includes('service-worker'));
		if (sw) {
			const storageInfo = await sw.evaluate(() => {
				return new Promise<Record<string, unknown>>(resolve => {
					chrome.storage.local.get(['active_version', 'active_project', 'auth_token'], (result) => {
						resolve({
							hasVersion: !!result.active_version,
							hasProject: !!result.active_project,
							hasAuth: !!result.auth_token,
							versionId: result.active_version?.id,
							projectName: result.active_project?.name
						});
					});
				});
			}).catch(() => ({}));
			console.log('  Storage:', JSON.stringify(storageInfo));
		}

		// Monitor capture progress
		console.log('  Monitoring capture (60s)...');
		for (let i = 0; i < 12; i++) {
			await sleep(5000);
			const state = await getCaptureState(context, extensionId);
			const stateStr = JSON.stringify(state, null, 0) || 'null';
			console.log(`  [${(i + 1) * 5}s] ${stateStr.substring(0, 400)}`);

			// Periodic screenshots
			if (i % 3 === 0) {
				await sfPage.screenshot({ path: screenshot(`gc-sf-${(i + 1) * 5}s`) });
			}

			// Stop early if capture is done/stopped
			if (state && (state as any).isRunning === false) {
				console.log('  Capture ended');
				break;
			}
		}
	} else {
		console.log('  No guides found via extension message');
		console.log('  Debug:', JSON.stringify((scanResult as any)?.debug)?.substring(0, 300));

		// Fallback: Scrape guide names directly from shadow DOM visible text
		console.log('  Attempting direct shadow DOM guide scrape...');
		const scrapeResult = await sfPage.evaluate(() => {
			const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
			if (!sr) return { elements: 0, texts: [] as string[], classes: [] as string[] };

			const texts: string[] = [];
			const classes: string[] = [];
			for (const el of Array.from(sr.querySelectorAll('*'))) {
				const h = el as HTMLElement;
				const cls = h.className?.toString() || '';
				if (cls) classes.push(cls.substring(0, 80));
				const r = h.getBoundingClientRect();
				if (r.width < 5 || r.height < 5) continue;
				const ownText = Array.from(h.childNodes)
					.filter(n => n.nodeType === 3)
					.map(n => n.textContent?.trim())
					.filter(Boolean)
					.join(' ');
				if (ownText && ownText.length > 2) texts.push(ownText);
			}

			return {
				elements: sr.querySelectorAll('*').length,
				texts: [...new Set(texts)].slice(0, 50),
				classes: [...new Set(classes)].slice(0, 30),
			};
		});
		console.log(`  Shadow DOM: ${scrapeResult.elements} elements, ${scrapeResult.texts.length} visible texts`);
		for (const t of scrapeResult.texts.slice(0, 20)) {
			console.log(`    "${t}"`);
		}
		if (scrapeResult.classes.length > 0) {
			console.log('  Sample classes:');
			for (const c of scrapeResult.classes.slice(0, 15)) {
				console.log(`    ${c}`);
			}
		}
	}

	await sfPage.screenshot({ path: screenshot('gc-sf-final') });
	await relay.close();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log('='.repeat(60));
	console.log('  Lemon Lab — Guided Capture E2E Test');
	console.log('='.repeat(60));

	// 1. Launch browser
	const context = await launchBrowser();
	const extensionId = await getExtensionId(context, 'Lemon Lab');
	const llExtId = await getExtensionId(context, 'Lemon Learning Player');

	console.log('  Extension IDs:');
	console.log('    Lemon Lab:', extensionId || 'NOT FOUND');
	console.log('    LL Player:', llExtId || 'NOT FOUND');

	if (!extensionId) {
		console.error('  Lemon Lab extension not found — build it first (npx vite build)');
		await context.close();
		return;
	}

	// 2. Login to Salesforce
	const page = await context.newPage();
	const sfLoggedIn = await loginToSalesforce(page);
	if (!sfLoggedIn) {
		console.error('  SF login failed — aborting');
		await context.close();
		return;
	}

	// 3. Wait for page + LL Player to load
	console.log('  Waiting 8s for SF + LL Player init...');
	await sleep(8000);

	// 4. Login to LL Player
	if (llExtId) {
		await loginToLLPlayer(page);
		console.log('  Waiting 5s for LL Player post-login init...');
		await sleep(5000);
	}

	// 5. Login to Lemon Lab extension (local devBypass)
	const llLoggedIn = await loginToLemonLab(context, extensionId);
	if (!llLoggedIn) {
		console.log('  Lemon Lab login failed — popup tests will show login screen');
	}

	// 6. Ensure an active project+version is set (required for capture to work)
	const { versionId } = await ensureActiveProjectVersion(context, extensionId);
	if (!versionId) {
		console.log('  No version set — capture will not save pages but we can still test the flow');
	}

	// 7. Open LL Player panel to populate React Query cache
	const panelOpen = await openLLPlayerPanel(page);
	if (!panelOpen) {
		console.log('  Panel did not open — will try to continue anyway');
	}

	// 8. Direct storage scan — dump all localStorage keys to find LL data
	console.log('\n--- Storage scan ---');
	const storageInfo = await page.evaluate(() => {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)!;
			const val = localStorage.getItem(key) || '';
			keys.push(`${key} (${val.length} bytes)`);
		}
		return { keyCount: localStorage.length, keys };
	});
	console.log(`  localStorage: ${storageInfo.keyCount} keys`);
	for (const k of storageInfo.keys.slice(0, 30)) {
		console.log(`    ${k}`);
	}

	// Also check IndexedDB databases
	const idbDbs = await page.evaluate(async () => {
		try {
			const dbs = await indexedDB.databases();
			return dbs.map(d => `${d.name} (v${d.version})`);
		} catch { return ['indexedDB.databases() not supported']; }
	});
	console.log(`  IndexedDB databases: ${idbDbs.length}`);
	for (const db of idbDbs.slice(0, 10)) {
		console.log(`    ${db}`);
	}

	// Try React Query cache scan
	console.log('\n--- React Query cache scan ---');
	const scanResult = await scanGuidesFromPage(page);
	console.log('  Cache found:', scanResult.cacheFound);
	console.log('  Guides found:', scanResult.guides.length);
	if (scanResult.guides.length > 0) {
		for (const g of scanResult.guides.slice(0, 10)) {
			console.log(`    [${g.id}] "${g.name}" — ${g.stepCount} steps (hasSteps: ${g.hasSteps})`);
		}
	} else if (scanResult.rawCacheKeys.length > 0) {
		console.log('  Cache keys:');
		for (const k of scanResult.rawCacheKeys.slice(0, 15)) {
			console.log('    ' + k);
		}
	}

	// 9. Test guided capture
	const sfPage = findSalesforcePage(context) || page;
	await testGuidedCapture(context, extensionId, sfPage);

	// 10. Final state check
	console.log('\n--- Final state ---');
	const finalState = await getCaptureState(context, extensionId);
	console.log('  Capture state:', JSON.stringify(finalState, null, 2)?.substring(0, 500));

	await sfPage.screenshot({ path: screenshot('gc-final') });

	console.log('\n  Test complete. Browser kept open for inspection.');
	console.log('  Press Ctrl+C to close.');
	await new Promise(() => {});
}

main().catch(err => {
	console.error('Fatal error:', err);
	process.exit(1);
});
