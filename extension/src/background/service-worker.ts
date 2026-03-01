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
import { buildSelfContainedPage, getLastFaviconDataUri } from '$lib/resource-fetcher';
import {
	startAutoCrawl,
	stopAutoCrawl,
	pauseAutoCrawl,
	resumeAutoCrawl,
	getAutoConfig,
	saveAutoConfig,
	type AutoCaptureConfig
} from '$lib/auto-capture';
import {
	startGuidedCapture as startGuided,
	stopGuidedCapture as stopGuided,
	onBubbleChanged as guidedBubbleChanged,
	isGuidedCaptureRunning
} from '$lib/guided-orchestrator';
import {
	showPlayer as llShowPlayer,
	playGuide as llPlayGuide,
	getStepActionInfo as llGetStepActionInfo,
	executeStepAction as llExecuteStepAction,
	inspectPlayer as llInspectPlayer
} from '$lib/ll-player-bridge';
import { v4 as uuidv4 } from '$lib/uuid';
import { getAuthState, verifyToken } from '$lib/auth';
import api, { uploadPage } from '$lib/api';

console.log(`[Lemon Lab] Service Worker loaded — v${__APP_VERSION__} (build ${__BUILD_HASH__})`);

// LL Player frame tracking — the player may live in an iframe (e.g. Salesforce)
let llPlayerFrameId: number = 0;

// ---------------------------------------------------------------------------
// Register MAIN world content script programmatically
// (static manifest declaration of world: "MAIN" is unreliable)
// ---------------------------------------------------------------------------
(async () => {
	try {
		// Unregister first to avoid "already registered" errors across SW restarts
		await chrome.scripting.unregisterContentScripts({ ids: ['capture-hooks-main'] }).catch(() => {});
		await chrome.scripting.registerContentScripts([{
			id: 'capture-hooks-main',
			matches: ['<all_urls>'],
			js: ['content/capture-hooks.js'],
			runAt: 'document_start',
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
		}]);
	} catch {
		// Ignore — may fail on restricted pages
	}
})();

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

		case 'SET_CAPTURE_STRATEGY':
			return updateCaptureState({ captureStrategy: message.strategy as 'url_based' | 'fingerprint_based' });

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

		case 'START_GUIDED_CAPTURE': {
			const tabId = message.tabId as number;
			const guides = message.guides as Array<{ id: string; name: string; stepCount: number; selected: boolean; steps?: unknown[]; sectionName?: string }>;
			const executionMode = message.executionMode as 'manual' | 'auto';
			await startGuided(tabId, guides, executionMode, llPlayerFrameId);
			return { success: true };
		}

		case 'STOP_GUIDED_CAPTURE':
			await stopGuided();
			return { success: true };

		case 'BUBBLE_CHANGED':
			await guidedBubbleChanged({
				bubblePresent: message.bubblePresent as boolean,
				contentHash: message.contentHash as string,
				hasNextButton: message.hasNextButton as boolean | undefined,
				stepIndicator: message.stepIndicator as string | undefined,
				title: message.title as string | undefined
			});
			return { success: true };

		case 'DETECT_LL_PLAYER': {
			const tabId = message.tabId as number;
			const detection = await detectLLPlayer(tabId);
			if (detection.detected && detection.frameId !== undefined) {
				llPlayerFrameId = detection.frameId;
			}
			return detection;
		}

		case 'SCAN_LL_GUIDES': {
			const tabId = message.tabId as number;
			return scanLLGuides(tabId);
		}

		// LL Player Bridge — POC guide manipulation
		case 'LL_INSPECT_PLAYER': {
			const tabId = message.tabId as number;
			return llInspectPlayer(tabId, llPlayerFrameId);
		}

		case 'LL_SHOW_PLAYER': {
			const tabId = message.tabId as number;
			return llShowPlayer(tabId, llPlayerFrameId);
		}

		case 'LL_PLAY_GUIDE': {
			const tabId = message.tabId as number;
			const guideId = message.guideId as string | number;
			return llPlayGuide(tabId, guideId, undefined, llPlayerFrameId);
		}

		case 'LL_GET_STEP_ACTION': {
			const tabId = message.tabId as number;
			return llGetStepActionInfo(tabId, llPlayerFrameId);
		}

		case 'LL_EXECUTE_STEP_ACTION': {
			const tabId = message.tabId as number;
			const actionInfo = message.actionInfo as { actionType: string; targetSelector?: string; targetTagName?: string; hasNextButton: boolean };
			return llExecuteStepAction(tabId, actionInfo, llPlayerFrameId);
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

		case 'CHECK_AUTH': {
			// Fast path: check storage only (no backend call) for instant popup load
			const authState = await getAuthState();
			// Lazily verify token with backend in background (updates user, reports version)
			if (authState.isAuthenticated) {
				verifyToken().catch((e) => console.warn('[SW] Token refresh failed:', e));
			}
			return authState;
		}

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
		const [selfContainedHtml, screenshotDataUrl, mhtmlBlob] = await Promise.all([
			buildSelfContainedPage(collected.html, collected.resources, collected.url),
			chrome.tabs.captureVisibleTab({ format: 'png' }).catch((e) => {
				console.warn(`${LOG} Screenshot capture failed:`, e instanceof Error ? e.message : e);
				return null;
			}),
			chrome.pageCapture.saveAsMHTML({ tabId }).catch((e) => {
				console.warn(`${LOG} MHTML capture failed:`, e instanceof Error ? e.message : e);
				return null;
			})
		]);
		console.log(`${LOG} Build complete in ${Date.now() - buildStart}ms — HTML: ${(selfContainedHtml.length / 1024).toFixed(0)}KB, Screenshot: ${screenshotDataUrl ? 'yes' : 'no'}, MHTML: ${mhtmlBlob ? `${(mhtmlBlob.size / 1024).toFixed(0)}KB` : 'no'}`);

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
		const faviconDataUri = getLastFaviconDataUri();
		const uploadStart = Date.now();
		const result = await uploadCapturedPage(
			version.id,
			{ html: selfContainedHtml, title: collected.title, url: collected.url },
			state.mode,
			screenshotBlob,
			faviconDataUri,
			undefined,
			mhtmlBlob
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

chrome.runtime.onInstalled.addListener((details) => {
	console.log(`[Lemon Lab] Extension ${details.reason} — v${__APP_VERSION__} (build ${__BUILD_HASH__})`);
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
// Dev auto-reload — DO NOT REMOVE, DO NOT MODIFY PORT
// ---------------------------------------------------------------------------
// Part of the 3-piece auto-reload system (see vite.config.ts top comment):
//   1. Vite plugin (scripts/reload-plugin.ts) → HTTP server on port 38587
//   2. THIS code → polls that server, reloads extension on timestamp change
//   3. vite.config.ts → stable chunk names + no emptyOutDir in dev
//
// This block is compiled OUT in production builds (Vite replaces
// import.meta.env.MODE with "production", dead-code eliminated).
// In dev builds, it becomes: if ("development" === "development") → true.
//
// Usage: run `npm run dev` (= vite build --watch --mode development),
// load dist/ as unpacked extension in chrome://extensions.
// Every file save triggers rebuild → SW detects new timestamp → reload.
// ---------------------------------------------------------------------------

if (import.meta.env.MODE === 'development') {
	let lastReloadTs = '';

	const checkForReload = async () => {
		try {
			const res = await fetch('http://127.0.0.1:38587', { cache: 'no-store' });
			const { ts } = await res.json();
			if (lastReloadTs && ts !== lastReloadTs) {
				console.log('[Dev] Rebuild detected, reloading extension…');
				chrome.runtime.reload();
				return;
			}
			lastReloadTs = ts;
		} catch {
			// Vite not running or server not started — skip silently
		}
	};

	setInterval(checkForReload, 1500);
	checkForReload();
}


// ---------------------------------------------------------------------------
// Lemon Learning Player detection & guide scanning
// ---------------------------------------------------------------------------

/**
 * Detect the LL Player across ALL frames (top + iframes) with retry.
 * The player may live inside an iframe (e.g. Salesforce Lightning) and
 * may load asynchronously after the page appears ready.
 *
 * Strategy: 3 attempts with increasing delays, scanning frames individually
 * to avoid one failing frame blocking detection in others.
 */
async function detectLLPlayer(tabId: number): Promise<{
	detected: boolean;
	method?: string;
	frameId?: number;
	error?: string;
	diagnostics?: Record<string, unknown>;
}> {
	const MAX_ATTEMPTS = 3;
	const DELAYS = [0, 1500, 3000]; // ms before each attempt
	const diagnostics: Record<string, unknown> = { attempts: [] };

	// Detection function injected into each frame's MAIN world
	const detectFunc = () => {
		const found: string[] = [];
		// 1. WXT custom element (LL Player v2.64+ uses WXT framework)
		if (document.querySelector('lemon-learning-player')) found.push('wxt-custom-element');
		// 2. WXT shadow root attribute
		if (document.querySelector('[data-wxt-shadow-root]')) found.push('wxt-shadow-root');
		// 3. Embed script tag (legacy LL Player)
		if (document.getElementById('lemonlearning-player-embed')) found.push('script-tag');
		// 4. Global LemonPlayer (only visible if player runs in MAIN world)
		if ((window as unknown as Record<string, unknown>).LemonPlayer) found.push('LemonPlayer');
		// 5. Shadow DOM host by ID (legacy LL Player)
		if (document.querySelector('lemon-learning-player')) found.push('shadow-dom-host');
		// 6. LemonLearningReady callback
		if ((window as unknown as Record<string, unknown>).LemonLearningReady) found.push('LemonLearningReady');
		// 7. Script src containing lemonlearning
		const scripts = document.querySelectorAll('script[src]');
		for (const script of Array.from(scripts)) {
			const src = (script as HTMLScriptElement).src;
			if (src.includes('lemonlearning') || src.includes('lemon-learning')) {
				found.push('script-src');
				break;
			}
		}
		// 8. Body dataset set by LL salesforce.js content script
		if (document.body?.dataset?.llUserEmail) found.push('ll-user-email');
		// 9. Any element with lemon-learning in id/class (broad sweep)
		if (document.querySelector('[id*="lemon-learning"], [id*="lemonlearning"], [class*="lemon-learning"], [class*="lemonlearning"]')) {
			found.push('dom-element');
		}

		return {
			detected: found.length > 0,
			method: found[0] || undefined,
			methods: found,
			url: location.href.substring(0, 120),
			docReady: document.readyState
		};
	};

	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		if (DELAYS[attempt] > 0) {
			await new Promise(r => setTimeout(r, DELAYS[attempt]));
		}
		if (attempt > 0) {
			console.log(`[LL Detect] Retry attempt ${attempt + 1}/${MAX_ATTEMPTS}...`);
		}

		const attemptLog: Record<string, unknown> = { attempt, frames: [] };

		// Strategy A: allFrames (fast path — works when no cross-origin issues)
		try {
			const results = await chrome.scripting.executeScript({
				target: { tabId, allFrames: true },
				world: 'MAIN',
				func: detectFunc
			});

			for (const r of results) {
				const res = r.result as { detected: boolean; method?: string; methods?: string[]; url?: string } | null;
				(attemptLog.frames as unknown[]).push({
					frameId: r.frameId,
					detected: res?.detected,
					methods: res?.methods,
					url: res?.url
				});
				if (res?.detected) {
					console.log(`[LL Detect] ✅ Player found in frame ${r.frameId} via ${res.method} (attempt ${attempt + 1})`);
					diagnostics.attempts = [...(diagnostics.attempts as unknown[]), attemptLog];
					return { detected: true, method: res.method, frameId: r.frameId, diagnostics };
				}
			}

			(diagnostics.attempts as unknown[]).push(attemptLog);
			continue; // Not found, try again after delay
		} catch (allFramesErr) {
			attemptLog.allFramesError = allFramesErr instanceof Error ? allFramesErr.message : String(allFramesErr);
		}

		// Strategy B: enumerate frames individually (handles cross-origin frames)
		try {
			const frames = await chrome.webNavigation.getAllFrames({ tabId });
			if (frames) {
				attemptLog.totalFrames = frames.length;
				for (const frame of frames) {
					try {
						const [result] = await chrome.scripting.executeScript({
							target: { tabId, frameIds: [frame.frameId] },
							world: 'MAIN',
							func: detectFunc
						});
						const res = result?.result as { detected: boolean; method?: string; methods?: string[]; url?: string } | null;
						(attemptLog.frames as unknown[]).push({
							frameId: frame.frameId,
							url: frame.url?.substring(0, 80),
							detected: res?.detected,
							methods: res?.methods
						});
						if (res?.detected) {
							console.log(`[LL Detect] ✅ Player found in frame ${frame.frameId} (${frame.url?.substring(0, 60)}) via ${res.method} (attempt ${attempt + 1}, per-frame)`);
							diagnostics.attempts = [...(diagnostics.attempts as unknown[]), attemptLog];
							return { detected: true, method: res.method, frameId: frame.frameId, diagnostics };
						}
					} catch {
						(attemptLog.frames as unknown[]).push({
							frameId: frame.frameId,
							url: frame.url?.substring(0, 80),
							error: 'injection failed'
						});
					}
				}
			}
		} catch (navErr) {
			attemptLog.webNavError = navErr instanceof Error ? navErr.message : String(navErr);
		}

		// Strategy C: top frame only (final fallback)
		try {
			const [result] = await chrome.scripting.executeScript({
				target: { tabId },
				world: 'MAIN',
				func: detectFunc
			});
			const res = result?.result as { detected: boolean; method?: string; methods?: string[] } | null;
			if (res?.detected) {
				console.log(`[LL Detect] ✅ Player found in top frame via ${res.method} (attempt ${attempt + 1}, fallback)`);
				diagnostics.attempts = [...(diagnostics.attempts as unknown[]), attemptLog];
				return { detected: true, method: res.method, frameId: 0, diagnostics };
			}
		} catch (topErr) {
			attemptLog.topFrameError = topErr instanceof Error ? topErr.message : String(topErr);
		}

		(diagnostics.attempts as unknown[]).push(attemptLog);
	}

	console.warn(`[LL Detect] ❌ Player NOT found after ${MAX_ATTEMPTS} attempts`);
	return { detected: false, diagnostics };
}

/**
 * Scan for LL guides by reading the React Query persisted cache from
 * localStorage (key: REACT_QUERY_OFFLINE_CACHE). The player stores
 * sections containing guides in this cache after initialization.
 *
 * Extracts FULL guide data including steps, triggers, and target paths
 * so the orchestrator can execute actions intelligently.
 *
 * Falls back to traversing the player's shadow DOM for guide elements.
 */
async function scanLLGuides(tabId: number): Promise<{
	guides: Array<{
		id: string;
		name: string;
		stepCount: number;
		sectionName?: string;
		steps?: Array<{
			id: number;
			stepType: string;
			triggers: Array<{ type: string; option?: string }>;
			targetPaths?: unknown;
			nextStep: number | null;
			isFirst: boolean;
			previousEnabled: boolean;
			title?: string;
			content?: string;
			stepKey?: string;
			question?: { id: number; answers: Array<{ id: number; title: string }> };
			conditions?: Array<{ id: number; conditionType: string; conditionContent: string; nextStep: number | null; name: string | null }>;
		}>;
	}>;
	error?: string;
}> {
	const target: chrome.scripting.ScriptInjectionTarget = llPlayerFrameId
		? { tabId, frameIds: [llPlayerFrameId] }
		: { tabId };

	// Phase 1: React Query cache + quick shadow DOM scan (works on admin.lemonlearning.com)
	let phase1: { guides: Array<{ id: string; name: string; stepCount: number; sectionName?: string; steps?: unknown[] }>; debug?: Record<string, unknown>; error?: string };
	try {
		const [result] = await chrome.scripting.executeScript({
			target,
			world: 'MAIN',
			func: () => {
				type QuestionAnswerData = { id: number; title: string };
				type QuestionData = { id: number; answers: QuestionAnswerData[] };
				type ConditionBranchData = {
					id: number;
					conditionType: string;
					conditionContent: string;
					nextStep: number | null;
					name: string | null;
				};
				type StepData = {
					id: number;
					stepType: string;
					triggers: Array<{ type: string; option?: string }>;
					targetPaths?: unknown;
					nextStep: number | null;
					isFirst: boolean;
					previousEnabled: boolean;
					title?: string;
					content?: string;
					stepKey?: string;
					question?: QuestionData;
					conditions?: ConditionBranchData[];
				};
				type ScannedGuide = {
					id: string;
					name: string;
					stepCount: number;
					sectionName?: string;
					steps?: StepData[];
				};
				const guides: ScannedGuide[] = [];
				const seenIds = new Set<string>();
				const debug: Record<string, unknown> = {};

				// Map of guideId → steps data extracted from guide detail queries
				const guideStepsMap = new Map<string, StepData[]>();

				// Step type mapping from LL Player internal values
				const STEP_TYPE_MAP: Record<number | string, string> = {
					0: 'regular', 1: 'intro', 2: 'outro', 3: 'question',
					4: 'condition', 5: 'variable', 6: 'auto', 7: 'subguide',
					'regular': 'regular', 'intro': 'intro', 'outro': 'outro',
					'question': 'question', 'condition': 'condition',
					'variable': 'variable', 'auto': 'auto', 'subguide': 'subguide'
				};

				// Trigger type mapping
				const TRIGGER_TYPE_MAP: Record<number | string, string> = {
					0: 'NEXT', 1: 'CLICK', 2: 'INPUT', 3: 'CHANGE',
					4: 'APPEAR', 5: 'DISAPPEAR', 6: 'WAIT', 7: 'MULTIPAGE',
					8: 'HOVER', 9: 'MOUSEDOWN',
					'NEXT': 'NEXT', 'CLICK': 'CLICK', 'INPUT': 'INPUT',
					'CHANGE': 'CHANGE', 'APPEAR': 'APPEAR', 'DISAPPEAR': 'DISAPPEAR',
					'WAIT': 'WAIT', 'MULTIPAGE': 'MULTIPAGE', 'HOVER': 'HOVER',
					'MOUSEDOWN': 'MOUSEDOWN',
					'next': 'NEXT', 'click': 'CLICK', 'input': 'INPUT',
					'change': 'CHANGE', 'appear': 'APPEAR', 'disappear': 'DISAPPEAR',
					'wait': 'WAIT', 'multipage': 'MULTIPAGE', 'hover': 'HOVER',
					'mousedown': 'MOUSEDOWN'
				};

				function normalizeStepType(raw: unknown): string {
					if (raw === null || raw === undefined) return 'regular';
					const mapped = STEP_TYPE_MAP[raw as string | number];
					return mapped || String(raw).toLowerCase();
				}

				function normalizeTriggerType(raw: unknown): string {
					if (raw === null || raw === undefined) return 'NEXT';
					const mapped = TRIGGER_TYPE_MAP[raw as string | number];
					return mapped || String(raw).toUpperCase();
				}

				// Extract step data from a guide's step object
				function extractStepData(step: Record<string, unknown>): StepData {
					const triggers: Array<{ type: string; option?: string }> = [];

					// Triggers can be in step.triggers (array) or step.trigger (single)
					const rawTriggers = step.triggers as unknown[] | undefined;
					if (Array.isArray(rawTriggers)) {
						for (const t of rawTriggers) {
							if (typeof t === 'object' && t !== null) {
								const tObj = t as Record<string, unknown>;
								triggers.push({
									type: normalizeTriggerType(tObj.type ?? tObj.trigger_type ?? tObj.triggerType),
									option: tObj.option as string | undefined
								});
							} else {
								triggers.push({ type: normalizeTriggerType(t) });
							}
						}
					} else if (step.trigger !== undefined) {
						triggers.push({ type: normalizeTriggerType(step.trigger) });
					} else if (step.trigger_type !== undefined) {
						triggers.push({ type: normalizeTriggerType(step.trigger_type) });
					}

					// If no triggers found, default based on step type
					if (triggers.length === 0) {
						const st = normalizeStepType(step.step_type ?? step.stepType ?? step.type);
						if (st === 'intro' || st === 'outro') {
							triggers.push({ type: 'NEXT' });
						}
					}

					// Extract question data (answers)
					let question: QuestionData | undefined;
					const rawQuestion = step.question as Record<string, unknown> | null | undefined;
					if (rawQuestion && typeof rawQuestion === 'object') {
						const rawAnswers = rawQuestion.answers as Array<Record<string, unknown>> | undefined;
						if (Array.isArray(rawAnswers) && rawAnswers.length > 0) {
							question = {
								id: Number(rawQuestion.id) || 0,
								answers: rawAnswers.map(a => {
									// Title can be directly on the answer or in translations
									let title = (a.title as string) || '';
									if (!title && Array.isArray(a.translations)) {
										const trans = a.translations as Array<Record<string, unknown>>;
										if (trans.length > 0) {
											title = (trans[0].content as string) || '';
										}
									}
									return { id: Number(a.id) || 0, title };
								})
							};
						}
					}

					// Extract conditions (branches)
					let conditions: ConditionBranchData[] | undefined;
					const rawConditions = step.conditions as Array<Record<string, unknown>> | undefined;
					if (Array.isArray(rawConditions) && rawConditions.length > 0) {
						conditions = rawConditions.map(c => ({
							id: Number(c.id) || 0,
							conditionType: String(c.condition_type ?? c.conditionType ?? '').toLowerCase(),
							conditionContent: String(c.condition_content ?? c.conditionContent ?? ''),
							nextStep: c.next_step != null ? Number(c.next_step) :
								c.nextStep != null ? Number(c.nextStep) : null,
							name: (c.name as string) || null
						}));
					}

					// Extract step_key
					const stepKey = (step.step_key ?? step.stepKey) as string | null | undefined;

					return {
						id: Number(step.id) || 0,
						stepType: normalizeStepType(step.step_type ?? step.stepType ?? step.type),
						triggers,
						targetPaths: step.paths ?? step.target ?? step.targetPaths ?? undefined,
						nextStep: step.next_step != null ? Number(step.next_step) :
							step.nextStep != null ? Number(step.nextStep) : null,
						isFirst: Boolean(step.is_first ?? step.isFirst ?? false),
						previousEnabled: Boolean(step.previous_enabled ?? step.previousEnabled ?? true),
						title: (step.title as string) || undefined,
						content: (step.content as string)?.substring(0, 200) || undefined,
						stepKey: stepKey || undefined,
						question,
						conditions
					};
				}

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

									// Extract steps if available directly on the guide
									let steps: StepData[] | undefined;
									const rawSteps = g.steps as Array<Record<string, unknown>> | undefined;
									if (Array.isArray(rawSteps) && rawSteps.length > 0) {
										steps = rawSteps.map(extractStepData);
									}

									// Also check if we found steps from a separate guide detail query
									const detailSteps = guideStepsMap.get(gId);
									if (!steps && detailSteps) {
										steps = detailSteps;
									}

									guides.push({
										id: gId,
										name: (g.title as string) || 'Guide sans nom',
										stepCount: steps?.length || (g.step_count as number) || (g.stepCount as number) || 0,
										sectionName: sectionTitle,
										steps
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

				// Diagnostic: scan localStorage for LL-related keys
				try {
					const lsKeys: string[] = [];
					const lsLemonKeys: string[] = [];
					for (let i = 0; i < localStorage.length; i++) {
						const key = localStorage.key(i);
						if (key) {
							lsKeys.push(key);
							const kl = key.toLowerCase();
							if (kl.includes('lemon') || kl.includes('react') || kl.includes('query') || kl.includes('guide') || kl.includes('section') || kl.includes('player')) {
								const val = localStorage.getItem(key);
								lsLemonKeys.push(`${key} (${val ? val.length : 0} chars)`);
							}
						}
					}
					debug.localStorageKeyCount = lsKeys.length;
					debug.localStorageRelevantKeys = lsLemonKeys;
					debug.allLocalStorageKeys = lsKeys.slice(0, 30);
					debug.pageUrl = location.href.substring(0, 120);
					debug.origin = location.origin;
				} catch (e) {
					debug.localStorageError = String(e);
				}

				// Diagnostic: check indexedDB for LL data
				try {
					debug.indexedDBAvailable = typeof indexedDB !== 'undefined';
					// Note: indexedDB.databases() is async, can't await in this context
					// We log availability only
				} catch {
					debug.indexedDBAvailable = false;
				}

				// Diagnostic: shadow DOM element count + panel open status
				try {
					const host = document.querySelector('lemon-learning-player');
					if (host?.shadowRoot) {
						const elCount = host.shadowRoot.querySelectorAll('*').length;
						debug.shadowDomElementCount = elCount;
						debug.shadowDomPanelOpen = elCount > 30;
					} else {
						debug.shadowDomElementCount = host ? 'no shadowRoot' : 'no host element';
					}
				} catch (e) {
					debug.shadowDomError = String(e);
				}

				// Diagnostic: check window globals for LL
				try {
					const win = window as unknown as Record<string, unknown>;
					debug.hasLemonPlayer = !!win.LemonPlayer;
					debug.hasLemonLearningReady = !!win.LemonLearningReady;
					debug.hasIsLemonAdmin = !!win.isLemonAdmin;
					if (win.LemonPlayer) {
						const p = win.LemonPlayer as Record<string, unknown>;
						debug.lemonPlayerKeys = Object.getOwnPropertyNames(p).slice(0, 20);
						debug.lemonPlayerVisible = p.visible;
						if (p.config && typeof p.config === 'object') {
							const c = p.config as Record<string, unknown>;
							debug.lemonPlayerConfig = {
								projectKey: c.projectKey,
								companyKey: c.companyKey,
								host: c.host,
								language: c.language,
							};
						}
					}
				} catch {
					debug.windowGlobalsError = 'access error';
				}

				// Strategy 1: React Query persisted cache in localStorage
				try {
					const cacheStr = localStorage.getItem('REACT_QUERY_OFFLINE_CACHE');
					debug.reactQueryCacheExists = !!cacheStr;
					debug.reactQueryCacheSize = cacheStr?.length ?? 0;
					if (cacheStr) {
						const cache = JSON.parse(cacheStr);
						const queries = cache?.clientState?.queries;
						debug.reactQueryCount = Array.isArray(queries) ? queries.length : 0;
						if (Array.isArray(queries)) {
							// Log all query keys for debugging
							debug.reactQueryKeys = queries.map((q: Record<string, unknown>) => {
								const key = q.queryKey as unknown[];
								const hasData = !!q.state && !!(q.state as Record<string, unknown>).data;
								return { key, hasData };
							}).slice(0, 30);

							// First pass: extract guide detail queries (steps data)
							for (const query of queries) {
								const key = query.queryKey;
								const data = query.state?.data;
								if (!data) continue;

								// Guide detail queries: ["guide", guideId] or similar patterns
								if (Array.isArray(key) && (key[0] === 'guide' || key[0] === 'guides')) {
									const guideData = data as Record<string, unknown>;
									const guideId = String(key[1] ?? guideData.id ?? '');
									const rawSteps = (guideData.steps ?? guideData.items) as Array<Record<string, unknown>> | undefined;
									if (guideId && Array.isArray(rawSteps) && rawSteps.length > 0) {
										guideStepsMap.set(guideId, rawSteps.map(extractStepData));
									}
								}

								// Step list queries: ["steps", guideId, ...]
								if (Array.isArray(key) && key[0] === 'steps') {
									const guideId = String(key[1] ?? '');
									if (guideId && Array.isArray(data)) {
										guideStepsMap.set(guideId, (data as Array<Record<string, unknown>>).map(extractStepData));
									}
								}
							}

							// Second pass: extract sections (guide lists)
							for (const query of queries) {
								const key = query.queryKey;
								if (Array.isArray(key) && key[0] === 'sections' && query.state?.data) {
									const data = query.state.data;
									if (Array.isArray(data)) {
										extractFromSections(data);
									}
								}
							}
						}
					}
				} catch (e) {
					debug.reactQueryError = String(e);
				}

				// Enrich guides that have no steps yet with data from guideStepsMap
				for (const guide of guides) {
					if (!guide.steps || guide.steps.length === 0) {
						const detailSteps = guideStepsMap.get(guide.id);
						if (detailSteps) {
							guide.steps = detailSteps;
							guide.stepCount = detailSteps.length;
						}
					}
				}

				// Strategy 2: Traverse the player's shadow DOM for guide elements
				if (guides.length === 0) {
					try {
						const shadowHost = document.querySelector('lemon-learning-player');
						const root = shadowHost?.shadowRoot;
						if (root) {
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
							const config = player.config as Record<string, unknown> | undefined;
							if (config) {
								debug.strategy3_playerConfigKeys = Object.keys(config);
							}
						}
					} catch {
						// Player not accessible
					}
				}

				debug.guidesFound = guides.length;
				return { guides, debug };
			}
		});
		phase1 = (result?.result as typeof phase1) || { guides: [] };
	} catch (err) {
		phase1 = { guides: [], error: err instanceof Error ? err.message : 'Cannot access tab' };
	}

	// Phase 1 found guides → done
	if (phase1.guides.length > 0) return phase1;

	// ======================================================================
	// Phase 2: Open LL Player panel + polling shadow DOM scan
	// On Salesforce, React Query cache lives inside the LL extension's own
	// chrome.storage.local (not the page's localStorage). We must open the
	// player panel so guides render in the shadow DOM, then read them.
	// Single async executeScript: open panel → poll for guides up to ~15s
	// ======================================================================
	console.log('[LL Scan] Phase 1: 0 guides. Opening player panel for shadow DOM scan…');

	try {
		const [phase2Result] = await chrome.scripting.executeScript({
			target,
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
			func: async () => {
				type SG = { id: string; name: string; stepCount: number; sectionName?: string };
				const debug: Record<string, unknown> = { phase: 'phase2-poll' };

				const host = document.querySelector('lemon-learning-player');
				if (!host) return { guides: [] as SG[], debug: { ...debug, error: 'No lemon-learning-player element' } };
				const shadow = host.shadowRoot;
				if (!shadow) return { guides: [] as SG[], debug: { ...debug, error: 'shadowRoot is null (closed shadow root?)' } };

				// --- Helpers ---
				function getOwnText(el: HTMLElement): string {
					let own = '';
					for (const node of Array.from(el.childNodes)) {
						if (node.nodeType === Node.TEXT_NODE) own += node.textContent?.trim() || '';
					}
					if (own.length > 2) return own;
					if (el.children.length <= 2) return el.textContent?.trim() || '';
					return own;
				}

				function simulateClick(el: HTMLElement): void {
					const rect = el.getBoundingClientRect();
					const x = Math.round(rect.left + rect.width / 2);
					const y = Math.round(rect.top + rect.height / 2);
					const opts: MouseEventInit = {
						bubbles: true, cancelable: true, composed: true,
						view: window, clientX: x, clientY: y, button: 0, buttons: 1,
					};
					el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse' }));
					el.dispatchEvent(new MouseEvent('mousedown', opts));
					el.focus?.();
					el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse', buttons: 0 }));
					el.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
					el.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
				}

				const SKIP_WORDS = ['rechercher', 'search', 'paramètre', 'setting', 'fermer', 'close',
					'connexion', 'login', 'déconnexion', 'logout', 'aide', 'help', 'retour', 'back',
					'lemon learning', 'propulsé par', 'powered by', 'mentions', 'conditions'];

				// --- Scan all shadow roots recursively for guide-like elements ---
				function scanForGuides(root: ShadowRoot): SG[] {
					const guides: SG[] = [];
					const seenNames = new Set<string>();

					// Collect all roots (including nested shadow roots)
					const roots: (ShadowRoot | HTMLElement)[] = [root];
					for (const el of Array.from(root.querySelectorAll('*'))) {
						if ((el as HTMLElement).shadowRoot) roots.push((el as HTMLElement).shadowRoot!);
					}

					for (const scanRoot of roots) {
						// Strategy A: CSS module class patterns (LL Player specific)
						const titleEls = scanRoot.querySelectorAll(
							'[class*="_guide-title_"], [class*="_guide-name_"], [class*="guide-title"], [class*="guideName"]'
						);
						for (const el of Array.from(titleEls)) {
							const name = el.textContent?.trim();
							if (!name || name.length < 2 || name.length > 200 || seenNames.has(name)) continue;
							seenNames.add(name);
							let stepCount = 0;
							const container = el.closest('[class*="_guide_"]') || el.parentElement;
							if (container) {
								const m = container.textContent?.match(/(\d+)\s*(?:étape|step|pas)/i);
								if (m) stepCount = parseInt(m[1], 10);
							}
							let sectionName: string | undefined;
							let parent = el.parentElement;
							for (let d = 0; d < 10 && parent; d++) {
								const cls = typeof parent.className === 'string' ? parent.className : '';
								if (cls.includes('_section_') || cls.includes('section-container')) {
									const stEl = parent.querySelector('[class*="_section-title_"], [class*="_section-name_"]');
									if (stEl) sectionName = stEl.textContent?.trim();
									break;
								}
								parent = parent.parentElement;
							}
							guides.push({ id: `shadow-${guides.length}`, name, stepCount, sectionName });
						}
						if (guides.length > 0) continue;

						// Strategy B: Guide item containers
						const guideEls = scanRoot.querySelectorAll(
							'[class*="_guide_"]:not([class*="_guide-list_"]):not([class*="_guide-title_"])'
						);
						for (const el of Array.from(guideEls)) {
							const h = el as HTMLElement;
							const rect = h.getBoundingClientRect();
							if (rect.width < 50 || rect.height < 15) continue;
							const titleChild = h.querySelector('[class*="title"], [class*="name"]');
							const name = (titleChild?.textContent?.trim() || h.textContent?.trim() || '');
							if (name.length < 2 || name.length > 200 || seenNames.has(name)) continue;
							seenNames.add(name);
							guides.push({ id: `shadow-${guides.length}`, name, stepCount: 0 });
						}
						if (guides.length > 0) continue;

						// Strategy C: Clickable items (role, class, tabindex)
						const clickableEls = scanRoot.querySelectorAll(
							'[role="button"], [role="listitem"], [class*="item"], [tabindex], a[href]'
						);
						for (const el of Array.from(clickableEls)) {
							const h = el as HTMLElement;
							const rect = h.getBoundingClientRect();
							const style = window.getComputedStyle(h);
							if (style.display === 'none' || rect.width < 50 || rect.height < 15) continue;
							if (style.cursor !== 'pointer' && !h.hasAttribute('tabindex') && h.tagName !== 'A') continue;
							const text = getOwnText(h);
							if (text.length < 3 || text.length > 200 || seenNames.has(text)) continue;
							if (SKIP_WORDS.some(s => text.toLowerCase().includes(s))) continue;
							seenNames.add(text);
							guides.push({ id: `click-${guides.length}`, name: text, stepCount: 0 });
						}
						if (guides.length > 0) continue;

						// Strategy D: Generic list detection — find containers with 3+ similar visible children
						for (const container of Array.from(scanRoot.querySelectorAll('*'))) {
							const children = Array.from(container.children) as HTMLElement[];
							if (children.length < 3) continue;
							// Group by tag
							const byTag = new Map<string, HTMLElement[]>();
							for (const c of children) {
								const arr = byTag.get(c.tagName) || [];
								arr.push(c);
								byTag.set(c.tagName, arr);
							}
							for (const [, group] of byTag) {
								if (group.length < 3) continue;
								const visible = group.filter(item => {
									const r = item.getBoundingClientRect();
									const s = window.getComputedStyle(item);
									return r.height > 15 && r.width > 50 && s.display !== 'none' && s.visibility !== 'hidden';
								});
								if (visible.length < 3) continue;
								const texts: string[] = [];
								for (const item of visible) {
									const t = getOwnText(item) || item.textContent?.trim() || '';
									if (t.length >= 3 && t.length <= 200 && !SKIP_WORDS.some(s => t.toLowerCase().includes(s))) {
										texts.push(t);
									}
								}
								if (texts.length >= 3) {
									for (const t of texts) {
										if (!seenNames.has(t)) {
											seenNames.add(t);
											guides.push({ id: `list-${guides.length}`, name: t, stepCount: 0 });
										}
									}
								}
							}
						}
					}

					return guides;
				}

				// --- Step 1: Open the panel if not already open ---
				let elCount = shadow.querySelectorAll('*').length;
				debug.initialElementCount = elCount;

				if (elCount <= 30) {
					// Find FAB launcher
					let fab: HTMLElement | null = shadow.querySelector('[class*="launcher"]') as HTMLElement | null;
					if (!fab) {
						for (const el of Array.from(shadow.querySelectorAll('*'))) {
							const h = el as HTMLElement;
							const r = h.getBoundingClientRect();
							const s = window.getComputedStyle(h);
							if (s.display === 'none' || r.width === 0) continue;
							if (r.width >= 40 && r.width <= 120 && r.height >= 40 && r.height <= 120 &&
								(s.cursor === 'pointer' || parseInt(s.zIndex, 10) > 1000000)) {
								fab = h;
								break;
							}
						}
					}

					if (fab) {
						simulateClick(fab);
						debug.openStrategy = 'fab-click';
					} else {
						// Fallback: LemonPlayer.show() (works when in MAIN world)
						const win = window as unknown as Record<string, unknown>;
						const player = win.LemonPlayer as { show?: () => void } | undefined;
						if (player?.show) {
							player.show();
							debug.openStrategy = 'api-show';
						} else {
							debug.openStrategy = 'failed';
							debug.error = 'No FAB found and no LemonPlayer.show() API';
						}
					}
				} else {
					debug.openStrategy = 'already-open';
				}

				// --- Step 2: Poll for guides (up to ~15 seconds) ---
				// Guides may take time to load from the LL API after panel opens
				const pollLog: Array<{ tick: number; elCount: number; guides: number }> = [];
				for (let tick = 0; tick < 10; tick++) {
					await new Promise(r => setTimeout(r, tick === 0 ? 2000 : 1500));

					elCount = shadow.querySelectorAll('*').length;
					if (elCount < 15) {
						pollLog.push({ tick, elCount, guides: 0 });
						continue;
					}

					const found = scanForGuides(shadow);
					pollLog.push({ tick, elCount, guides: found.length });

					if (found.length > 0) {
						debug.pollLog = pollLog;
						debug.foundAtTick = tick;
						return { guides: found, debug };
					}
				}
				debug.pollLog = pollLog;

				// --- Step 3: Nothing found — comprehensive diagnostics ---
				const textDump: string[] = [];
				function dumpRoot(root: ShadowRoot | HTMLElement, prefix = ''): void {
					for (const el of Array.from(root.querySelectorAll('*'))) {
						if (textDump.length >= 60) break;
						const h = el as HTMLElement;
						const rect = h.getBoundingClientRect();
						if (rect.width === 0 && rect.height === 0) continue;
						const ownText = getOwnText(h);
						if (ownText.length < 2) continue;
						const cls = (typeof h.className === 'string' ? h.className : '').substring(0, 100);
						const style = window.getComputedStyle(h);
						const tag = h.tagName.toLowerCase();
						textDump.push(
							`${prefix}<${tag}> cls="${cls}" ` +
							`${Math.round(rect.width)}x${Math.round(rect.height)} cursor=${style.cursor} ` +
							`→ "${ownText.substring(0, 120)}"`
						);
						if (h.shadowRoot) dumpRoot(h.shadowRoot, prefix + '  [nested] ');
					}
				}
				dumpRoot(shadow);
				debug.textElementDump = textDump;
				debug.finalElementCount = shadow.querySelectorAll('*').length;

				return { guides: [] as SG[], debug };
			}
		});

		const p2 = phase2Result?.result as {
			guides: SG[];
			debug: Record<string, unknown>;
		} | null;
		type SG = { id: string; name: string; stepCount: number; sectionName?: string };

		if (p2?.guides && p2.guides.length > 0) {
			console.log(`[LL Scan] Phase 2: Found ${p2.guides.length} guides from shadow DOM`);
			return {
				guides: p2.guides,
				debug: { ...(phase1.debug || {}), phase2: p2.debug }
			};
		}

		console.warn('[LL Scan] Phase 2: Still 0 guides after polling');
		return {
			...phase1,
			debug: { ...(phase1.debug || {}), phase2: p2?.debug }
		};

	} catch (err) {
		console.warn('[LL Scan] Phase 2 failed:', err);
		return phase1;
	}
}
