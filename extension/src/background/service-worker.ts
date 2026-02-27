import { STORAGE_KEYS, PAGE_STATUS, type CapturedPage } from '$lib/constants';
import {
	captureCurrentPage,
	captureModalAsPage,
	uploadCapturedPage,
	getCaptureState,
	updateCaptureState,
	addCapturedPageToState,
	updatePageStatus,
	removePageFromState
} from '$lib/capture';
import { buildSelfContainedPage } from '$lib/resource-fetcher';
import {
	startAutoCrawl,
	stopAutoCrawl,
	pauseAutoCrawl,
	resumeAutoCrawl,
	getAutoConfig,
	saveAutoConfig,
	type AutoCaptureConfig
} from '$lib/auto-capture';
import { v4 as uuidv4 } from '$lib/uuid';
import { verifyToken } from '$lib/auth';
import api, { uploadPage } from '$lib/api';

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	handleMessage(message)
		.then(sendResponse)
		.catch((err) => sendResponse({ error: err.message }));
	return true; // async response
});

async function handleMessage(
	message: { type: string; [key: string]: unknown }
): Promise<unknown> {
	switch (message.type) {
		case 'CAPTURE_PAGE':
			return handleCapturePage(message.tabId as number);

		case 'GET_CAPTURE_STATE':
			return getCaptureState();

		case 'SET_CAPTURE_MODE':
			return updateCaptureState({ mode: message.mode as 'free' | 'guided' | 'auto' });

		case 'PAUSE_CAPTURE':
			return updateCaptureState({ isPaused: true });

		case 'RESUME_CAPTURE':
			return updateCaptureState({ isPaused: false });

		case 'START_AUTO_CRAWL': {
			const config = message.config as AutoCaptureConfig;
			const tabId = message.tabId as number;
			await startAutoCrawl(tabId, config);
			return { success: true };
		}

		case 'STOP_AUTO_CRAWL':
			await stopAutoCrawl();
			return { success: true };

		case 'GET_AUTO_CONFIG':
			return getAutoConfig();

		case 'SAVE_AUTO_CONFIG':
			await saveAutoConfig(message.config as AutoCaptureConfig);
			return { success: true };

		case 'REMOVE_PAGE':
			await removePageFromState(message.localId as string);
			return { success: true };

		case 'RECAPTURE_PAGE': {
			const state = await getCaptureState();
			const page = state.pages.find((p) => p.localId === message.localId);
			if (page) {
				// Remove old page and recapture
				await removePageFromState(message.localId as string);
				return handleCapturePage(message.tabId as number);
			}
			throw new Error('Page not found');
		}

		case 'DELETE_BACKEND_PAGE': {
			await api.del(`/pages/${message.pageId}`);
			await removePageFromState(message.localId as string);
			return { success: true };
		}

		case 'GET_PROJECTS':
			return api.get('/projects');

		case 'GET_VERSIONS':
			return api.get(`/projects/${message.projectId}/versions`);

		case 'CREATE_CAPTURE_JOB': {
			const versionId = message.versionId as string;
			const mode = message.mode as string;
			const targetPageCount = message.targetPageCount as number;
			const result = await api.post(`/versions/${versionId}/capture-jobs`, {
				mode,
				targetPageCount
			});
			return result;
		}

		case 'UPDATE_CAPTURE_JOB': {
			const jobId = message.jobId as string;
			const updates = message.updates as Record<string, unknown>;
			return api.put(`/capture-jobs/${jobId}`, updates);
		}

		case 'DETECT_LL_PLAYER': {
			const tabId = message.tabId as number;
			return detectLLPlayer(tabId);
		}

		case 'SCAN_LL_GUIDES': {
			const tabId = message.tabId as number;
			return scanLLGuides(tabId);
		}

		case 'CREATE_VERSION': {
			const projectId = message.projectId as string;
			const versionName = message.name as string;
			return api.post(`/projects/${projectId}/versions`, {
				name: versionName,
				language: 'fr'
			});
		}

		case 'CREATE_PROJECT': {
			const name = message.name as string;
			const toolName = message.toolName as string;
			const subdomain = toolName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
			const projectRes = await api.post('/projects', { name, toolName, subdomain });
			// Auto-create a first version v1.0
			if (projectRes?.data?.id) {
				await api.post(`/projects/${projectRes.data.id}/versions`, {
					name: 'v1.0',
					language: 'fr'
				}).catch(() => {});
			}
			return projectRes;
		}

		case 'CHECK_AUTH':
			return verifyToken();

		case 'LOGOUT': {
			// Remove auth + preferences, then clear all per-version capture states
			const allKeys = Object.keys(await chrome.storage.local.get(null));
			const captureKeys = allKeys.filter((k) => k.startsWith(`${STORAGE_KEYS.CAPTURE_STATE}:`));
			await chrome.storage.local.remove([
				STORAGE_KEYS.AUTH_TOKEN,
				STORAGE_KEYS.USER,
				STORAGE_KEYS.ACTIVE_PROJECT,
				STORAGE_KEYS.ACTIVE_VERSION,
				STORAGE_KEYS.CAPTURE_MODE,
				...captureKeys
			]);
			return { success: true };
		}

		case 'CAPTURE_PAGE_WITH_MODALS':
			return handleCapturePageWithModals(message.tabId as number);

		default:
			throw new Error(`Unknown message type: ${message.type}`);
	}
}

// ---------------------------------------------------------------------------
// Capture flow
// ---------------------------------------------------------------------------

async function handleCapturePage(tabId: number): Promise<CapturedPage> {
	const LOG = '[ES Capture]';
	console.log(`${LOG} === Starting capture for tab ${tabId} ===`);

	const state = await getCaptureState();

	// Get active version
	const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
	const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
	if (!version?.id) {
		console.error(`${LOG} No active version selected`);
		throw new Error('Aucune version sélectionnée');
	}
	console.log(`${LOG} Version: ${version.id} (${version.name || 'unnamed'})`);

	const localId = uuidv4();

	// Create page entry in state
	const page: CapturedPage = {
		id: '',
		localId,
		title: 'Capture en cours...',
		url: '',
		fileSize: 0,
		status: PAGE_STATUS.CAPTURING,
		capturedAt: new Date().toISOString()
	};

	await addCapturedPageToState(page);

	try {
		// Step 0: Scroll page to trigger lazy loading, then wait for DOM stabilization
		console.log(`${LOG} Step 0: Scrolling page + DOM stabilization`);
		try {
			await chrome.tabs.sendMessage(tabId, { type: 'SCROLL_PAGE' });
			console.log(`${LOG} Scroll complete`);
		} catch (e) {
			console.warn(`${LOG} Scroll skipped (content script not ready):`, e instanceof Error ? e.message : e);
		}
		try {
			const stabilityResult = await chrome.tabs.sendMessage(tabId, { type: 'WAIT_FOR_STABLE_DOM', timeout: 8000 });
			console.log(`${LOG} DOM stabilization:`, stabilityResult);
		} catch (e) {
			console.warn(`${LOG} DOM stabilization skipped:`, e instanceof Error ? e.message : e);
		}

		// Step 1: Collect DOM + resource manifest
		console.log(`${LOG} Step 1: Collecting DOM + resources`);
		const collected = await captureCurrentPage(tabId);
		console.log(`${LOG} Collected: "${collected.title}" (${collected.url}), ${collected.resources.stylesheetUrls.length} CSS, ${collected.resources.imageUrls.length} images, ${collected.resources.faviconUrls.length} favicons`);
		await updatePageStatus(localId, PAGE_STATUS.UPLOADING, {
			title: collected.title,
			url: collected.url
		});

		// Step 2: Fetch all resources and build self-contained HTML + screenshot
		console.log(`${LOG} Step 2: Building self-contained HTML`);

		const buildStart = Date.now();
		const [selfContainedHtml, screenshotDataUrl] = await Promise.all([
			buildSelfContainedPage(collected.html, collected.resources, collected.url),
			chrome.tabs.captureVisibleTab({ format: 'png' }).catch((e) => {
				console.warn(`${LOG} Screenshot capture failed:`, e instanceof Error ? e.message : e);
				return null;
			})
		]);
		console.log(`${LOG} Build complete in ${Date.now() - buildStart}ms — HTML: ${(selfContainedHtml.length / 1024).toFixed(0)}KB, Screenshot: ${screenshotDataUrl ? 'yes' : 'no'}`);

		// Convert screenshot data URL to Blob
		let screenshotBlob: Blob | null = null;
		if (screenshotDataUrl) {
			try {
				const resp = await fetch(screenshotDataUrl);
				screenshotBlob = await resp.blob();
				console.log(`${LOG} Screenshot blob: ${(screenshotBlob.size / 1024).toFixed(0)}KB`);
			} catch (e) {
				console.warn(`${LOG} Screenshot data URL conversion failed:`, e instanceof Error ? e.message : e);
			}
		}

		// Step 3: Upload to backend
		console.log(`${LOG} Step 3: Uploading to backend`);
		const uploadStart = Date.now();
		const result = await uploadCapturedPage(
			version.id,
			{ html: selfContainedHtml, title: collected.title, url: collected.url },
			state.mode,
			screenshotBlob
		);
		console.log(`${LOG} Upload complete in ${Date.now() - uploadStart}ms — page ID: ${result.id}, size: ${result.fileSize}`);

		// Step 4: Mark as done (derive urlPath from captured URL)
		let urlPath: string | undefined;
		try {
			const parsedUrl = new URL(collected.url);
			urlPath = parsedUrl.pathname + parsedUrl.search;
		} catch {
			// Keep undefined
		}
		await updatePageStatus(localId, PAGE_STATUS.DONE, {
			id: result.id,
			fileSize: result.fileSize,
			urlPath
		});

		// Update badge with done count
		const updatedState = await getCaptureState();
		const totalDone = updatedState.pages.filter(
			(p) => p.status === PAGE_STATUS.DONE
		).length;
		await updateBadge(totalDone);

		// For single captures (non-auto), clear badge after 3s
		if (state.mode !== 'auto') {
			setTimeout(() => updateBadge(0), 3000);
		}

		// Update capture job if exists
		if (state.jobId) {
			const currentState = await getCaptureState();
			const doneCount = currentState.pages.filter(
				(p) => p.status === PAGE_STATUS.DONE
			).length;

			await api.put(`/capture-jobs/${state.jobId}`, {
				pagesCaptured: doneCount,
				status: doneCount >= currentState.targetPageCount ? 'done' : 'running'
			}).catch((e) => {
				console.warn(`${LOG} Capture job update failed:`, e instanceof Error ? e.message : e);
			});
		}

		console.log(`${LOG} === Capture complete for "${collected.title}" ===`);
		return (await getCaptureState()).pages.find((p) => p.localId === localId)!;
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
		console.error(`${LOG} === Capture FAILED ===`, errorMsg, err);
		await updatePageStatus(localId, PAGE_STATUS.ERROR, { error: errorMsg });
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Capture page + detect and capture modals
// ---------------------------------------------------------------------------

async function handleCapturePageWithModals(tabId: number): Promise<{
	page: CapturedPage;
	modalCount: number;
}> {
	const LOG = '[ES Capture+Modals]';

	// Step 1: Capture the main page normally
	const mainPage = await handleCapturePage(tabId);
	const mainPageBackendId = mainPage.id;
	console.log(`${LOG} Main page captured: ${mainPageBackendId}`);

	// Step 2: Detect modals in the tab
	let modals: Array<{
		selector: string;
		detectionMethod: string;
		title: string;
	}> = [];

	try {
		const detectResult = await chrome.tabs.sendMessage(tabId, { type: 'DETECT_MODALS' });
		modals = detectResult?.modals || [];
		console.log(`${LOG} Detected ${modals.length} modal(s)`);
	} catch (e) {
		console.warn(`${LOG} Modal detection failed:`, e instanceof Error ? e.message : e);
	}

	if (modals.length === 0) {
		return { page: mainPage, modalCount: 0 };
	}

	// Get active version for modal uploads
	const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
	const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
	if (!version?.id) {
		console.warn(`${LOG} No active version — skipping modal capture`);
		return { page: mainPage, modalCount: 0 };
	}

	// Step 3: Capture each detected modal
	let capturedModalCount = 0;
	for (const modal of modals) {
		try {
			console.log(`${LOG} Capturing modal: "${modal.title}" (${modal.selector})`);

			// Capture the modal subtree via content script
			const modalData = await captureModalAsPage(tabId, modal.selector);

			// Build self-contained HTML for the modal
			const selfContainedModalHtml = await buildSelfContainedPage(
				modalData.html,
				modalData.resources,
				modalData.url
			);

			// Generate a slug from the modal title for URL path
			const titleSlug = modal.title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
				.substring(0, 50) || 'modal';

			// Derive parent URL path
			let parentUrlPath = 'index';
			try {
				const parsedUrl = new URL(modalData.url);
				parentUrlPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '') || 'index';
			} catch { /* keep default */ }

			const modalUrlPath = `${parentUrlPath}/__modal/${titleSlug}`;

			// Upload modal as a page with pageType: 'modal'
			const blob = new Blob([selfContainedModalHtml], { type: 'text/html' });
			const result = await uploadPage(version.id, blob, {
				urlSource: modalData.url,
				urlPath: modalUrlPath,
				title: modal.title,
				captureMode: 'free',
				pageType: 'modal',
				parentPageId: mainPageBackendId,
			});

			capturedModalCount++;
			console.log(`${LOG} Modal uploaded: ${result.data.id} (${modal.title})`);
		} catch (e) {
			console.warn(`${LOG} Modal capture failed for "${modal.title}":`, e instanceof Error ? e.message : e);
		}
	}

	console.log(`${LOG} === Done: ${capturedModalCount}/${modals.length} modals captured ===`);
	return { page: mainPage, modalCount: capturedModalCount };
}

// ---------------------------------------------------------------------------
// Token refresh on alarm
// ---------------------------------------------------------------------------

chrome.alarms?.create('token-refresh', { periodInMinutes: 30 });
chrome.alarms?.onAlarm.addListener(async (alarm) => {
	if (alarm.name === 'token-refresh') {
		await verifyToken();
	}
});

// ---------------------------------------------------------------------------
// Extension install handler
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
	console.log('[Lab] Extension installed');
});

// ---------------------------------------------------------------------------
// Side Panel — toggle on action click (modern + legacy)
// ---------------------------------------------------------------------------

const SIDE_PANEL_PATH = 'src/sidepanel/index.html';

const sidePanelApi = chrome.sidePanel as typeof chrome.sidePanel & {
	close?: (options: { tabId?: number; windowId?: number }) => Promise<void>;
	onOpened?: chrome.events.Event<(info: { tabId?: number }) => void>;
	onClosed?: chrome.events.Event<(info: { tabId?: number }) => void>;
};
const hasClose = typeof sidePanelApi.close === 'function';
const hasEvents = Boolean(sidePanelApi.onOpened && sidePanelApi.onClosed);
const isModern = hasClose && hasEvents;

const openTabs = new Set<number>();

// Disable default behavior — we control toggle manually
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
chrome.sidePanel.setOptions({ enabled: false, path: SIDE_PANEL_PATH }).catch(() => {});

// Pre-configure new tabs (modern flow)
if (isModern) {
	chrome.tabs.onCreated.addListener((tab) => {
		if (tab.id) {
			chrome.sidePanel.setOptions({
				tabId: tab.id, enabled: true, path: SIDE_PANEL_PATH
			}).catch(() => {});
		}
	});
}

// Track panel state via native events (modern API)
if (isModern) {
	sidePanelApi.onOpened!.addListener((info) => {
		if (typeof info.tabId === 'number') openTabs.add(info.tabId);
	});
	sidePanelApi.onClosed!.addListener((info) => {
		if (typeof info.tabId === 'number') openTabs.delete(info.tabId);
	});
}

// Cleanup on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
	openTabs.delete(tabId);
});

// Toggle on action click / keyboard shortcut
chrome.action.onClicked.addListener((tab) => {
	if (!tab.id) return;
	const tabId = tab.id;
	const windowId = tab.windowId;

	if (openTabs.has(tabId)) {
		// CLOSE
		if (isModern) {
			sidePanelApi.close!({ tabId, windowId }).catch(() => {
				// Fallback legacy: disable = close
				chrome.sidePanel.setOptions({ tabId, enabled: false, path: SIDE_PANEL_PATH }).catch(() => {});
				openTabs.delete(tabId);
			});
		} else {
			chrome.sidePanel.setOptions({ tabId, enabled: false, path: SIDE_PANEL_PATH }).catch(() => {});
			openTabs.delete(tabId);
		}
	} else {
		// OPEN — setOptions then open, with immediate attempt in user gesture
		chrome.sidePanel.setOptions(
			{ tabId, enabled: true, path: SIDE_PANEL_PATH },
			() => {
				chrome.sidePanel.open({ tabId, windowId }).then(() => {
					openTabs.add(tabId);
				}).catch(() => {});
			}
		);
		// Immediate attempt (must be in user gesture context)
		chrome.sidePanel.open({ tabId, windowId }).then(() => {
			openTabs.add(tabId);
		}).catch(() => {});
	}
});

// ---------------------------------------------------------------------------
// Dev auto-reload — polls __reload__ file written by Vite plugin
// ---------------------------------------------------------------------------

if (import.meta.env?.MODE === 'development' || !import.meta.env?.PROD) {
	let lastReloadTs = '';

	const checkForReload = async () => {
		try {
			// Cache-buster required: chrome-extension:// URLs are aggressively cached
			const url = chrome.runtime.getURL('hot-reload.json') + '?t=' + Date.now();
			const res = await fetch(url);
			const { ts } = await res.json();
			if (lastReloadTs && ts !== lastReloadTs) {
				console.log('[Dev] Rebuild detected, reloading extension…');
				chrome.runtime.reload();
				return;
			}
			lastReloadTs = ts;
		} catch {
			// File doesn't exist yet or extension is loading
		}
	};

	// Check every 1.5s
	setInterval(checkForReload, 1500);
	checkForReload();
}

// ---------------------------------------------------------------------------
// Badge helper
// ---------------------------------------------------------------------------

async function updateBadge(count: number): Promise<void> {
	if (count > 0) {
		await chrome.action.setBadgeText({ text: String(count) });
		await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
	} else {
		await chrome.action.setBadgeText({ text: '' });
	}
}

// ---------------------------------------------------------------------------
// Lemon Learning Player detection & guide scanning
// ---------------------------------------------------------------------------

/**
 * Detect the LL Player by executing a script in the page's MAIN world,
 * which gives us access to window.LemonPlayer and other page globals.
 */
async function detectLLPlayer(tabId: number): Promise<{ detected: boolean; method?: string; error?: string }> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: { tabId },
			world: 'MAIN',
			func: () => {
				// 1. Check the embed script tag (most reliable)
				if (document.getElementById('lemonlearning-player-embed')) {
					return { detected: true, method: 'script-tag' };
				}
				// 2. Check the global LemonPlayer instance
				if ((window as unknown as Record<string, unknown>).LemonPlayer) {
					return { detected: true, method: 'LemonPlayer' };
				}
				// 3. Check shadow DOM host element
				if (document.getElementById('lemon-learning-player')) {
					return { detected: true, method: 'shadow-dom-host' };
				}
				// 4. Check script src attributes
				const scripts = document.querySelectorAll('script[src]');
				for (const script of Array.from(scripts)) {
					const src = (script as HTMLScriptElement).src;
					if (src.includes('lemonlearning') || src.includes('lemon-learning')) {
						return { detected: true, method: 'script-src' };
					}
				}
				return { detected: false };
			}
		});
		return result?.result as { detected: boolean; method?: string } || { detected: false };
	} catch (err) {
		return { detected: false, error: err instanceof Error ? err.message : 'Cannot access tab' };
	}
}

/**
 * Scan for LL guides by reading the React Query persisted cache from
 * localStorage (key: REACT_QUERY_OFFLINE_CACHE). The player stores
 * sections containing guides in this cache after initialization.
 *
 * Falls back to traversing the player's shadow DOM for guide elements.
 */
async function scanLLGuides(tabId: number): Promise<{
	guides: Array<{ id: string; name: string; stepCount: number; sectionName?: string }>;
	error?: string;
}> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: { tabId },
			world: 'MAIN',
			func: () => {
				type ScannedGuide = { id: string; name: string; stepCount: number; sectionName?: string };
				const guides: ScannedGuide[] = [];
				const seenIds = new Set<string>();

				// Helper: recursively extract guides from sections (supports children)
				function extractFromSections(sections: unknown[]): void {
					for (const section of sections) {
						const s = section as Record<string, unknown>;
						const sectionTitle = (s.title as string) || '';
						const sectionGuides = s.guides as Array<Record<string, unknown>> | undefined;
						if (Array.isArray(sectionGuides)) {
							for (const g of sectionGuides) {
								const gId = String(g.id);
								if (!seenIds.has(gId)) {
									seenIds.add(gId);
									guides.push({
										id: gId,
										name: (g.title as string) || 'Guide sans nom',
										stepCount: 0,
										sectionName: sectionTitle
									});
								}
							}
						}
						const children = s.children as unknown[] | undefined;
						if (Array.isArray(children) && children.length > 0) {
							extractFromSections(children);
						}
					}
				}

				// Strategy 1: React Query persisted cache in localStorage
				try {
					const cacheStr = localStorage.getItem('REACT_QUERY_OFFLINE_CACHE');
					if (cacheStr) {
						const cache = JSON.parse(cacheStr);
						const queries = cache?.clientState?.queries;
						if (Array.isArray(queries)) {
							for (const query of queries) {
								const key = query.queryKey;
								// Section queries have key ["sections", userId, lang, contentTargetIds]
								if (Array.isArray(key) && key[0] === 'sections' && query.state?.data) {
									const data = query.state.data;
									if (Array.isArray(data)) {
										extractFromSections(data);
									}
								}
							}
						}
					}
				} catch {
					// Cache not available or malformed
				}

				// Strategy 2: Traverse the player's shadow DOM for guide elements
				if (guides.length === 0) {
					try {
						const shadowHost = document.getElementById('lemon-learning-player');
						const root = shadowHost?.shadowRoot;
						if (root) {
							// Look for elements that look like guide items
							// The player renders guides as clickable elements with guide names
							const allElements = root.querySelectorAll('[class*="guide"], [data-guide-id], [role="button"], [role="listitem"]');
							let idx = 0;
							for (const el of Array.from(allElements)) {
								const text = el.textContent?.trim();
								if (text && text.length > 2 && text.length < 200) {
									const existing = guides.find((g) => g.name === text);
									if (!existing) {
										guides.push({
											id: `dom-${idx}`,
											name: text,
											stepCount: 0
										});
										idx++;
									}
								}
							}
						}
					} catch {
						// Shadow DOM not accessible
					}
				}

				// Strategy 3: Check if LemonPlayer exposes any data
				if (guides.length === 0) {
					try {
						const win = window as unknown as Record<string, unknown>;
						const player = win.LemonPlayer as Record<string, unknown> | undefined;
						if (player && typeof player === 'object') {
							// Try to access config for debugging
							const config = player.config as Record<string, unknown> | undefined;
							if (config) {
								return {
									guides,
									debug: {
										playerFound: true,
										configKeys: Object.keys(config),
										projectKey: config.projectKey,
										companyKey: config.companyKey
									}
								};
							}
						}
					} catch {
						// Player not accessible
					}
				}

				return { guides };
			}
		});
		return result?.result as {
			guides: Array<{ id: string; name: string; stepCount: number; sectionName?: string }>;
			error?: string;
		} || { guides: [] };
	} catch (err) {
		return { guides: [], error: err instanceof Error ? err.message : 'Cannot access tab' };
	}
}
