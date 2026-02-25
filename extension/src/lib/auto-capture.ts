import { PAGE_STATUS, STORAGE_KEYS, type CapturedPage, type CaptureState } from './constants';
import {
	captureCurrentPage,
	uploadCapturedPage,
	addCapturedPageToState,
	updatePageStatus,
	getCaptureState,
	updateCaptureState
} from './capture';
import { v4 as uuidv4 } from './uuid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoCaptureConfig {
	targetPageCount: number;
	maxDepth: number;
	delayBetweenPages: number; // ms
	interestZones: InterestZone[];
	blacklist: string[];
}

export interface InterestZone {
	urlPattern: string;
	depthMultiplier: number;
}

interface CrawlQueueItem {
	url: string;
	depth: number;
	parentUrl?: string;
}

const DEFAULT_CONFIG: AutoCaptureConfig = {
	targetPageCount: 20,
	maxDepth: 3,
	delayBetweenPages: 2000,
	interestZones: [],
	blacklist: [
		'Supprimer',
		'Delete',
		'Remove',
		'Résilier',
		'Annuler le compte',
		'Déconnexion',
		'Logout',
		'Sign out',
		'Se déconnecter'
	]
};

const STORAGE_KEY_AUTO_CONFIG = 'auto_capture_config';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let crawlQueue: CrawlQueueItem[] = [];
let visitedUrls: Set<string> = new Set();
let isRunning = false;
let currentTabId: number | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get saved auto-capture config or defaults.
 */
export async function getAutoConfig(): Promise<AutoCaptureConfig> {
	const result = await chrome.storage.local.get(STORAGE_KEY_AUTO_CONFIG);
	return result[STORAGE_KEY_AUTO_CONFIG] || { ...DEFAULT_CONFIG };
}

/**
 * Save auto-capture config.
 */
export async function saveAutoConfig(config: AutoCaptureConfig): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEY_AUTO_CONFIG]: config });
}

/**
 * Start the auto-capture crawl from the current tab's URL.
 */
export async function startAutoCrawl(tabId: number, config: AutoCaptureConfig): Promise<void> {
	if (isRunning) {
		throw new Error('Un crawl est déjà en cours');
	}

	// Save config
	await saveAutoConfig(config);

	// Get current page URL
	const tab = await chrome.tabs.get(tabId);
	if (!tab.url) {
		throw new Error('Impossible de déterminer l\'URL de l\'onglet');
	}

	// Reset state
	crawlQueue = [{ url: tab.url, depth: 0 }];
	visitedUrls = new Set();
	isRunning = true;
	currentTabId = tabId;

	// Update capture state
	await updateCaptureState({
		mode: 'auto',
		isRunning: true,
		isPaused: false,
		targetPageCount: config.targetPageCount
	});

	// Create capture job on backend
	const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
	const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
	if (!version?.id) {
		throw new Error('Aucune version sélectionnée');
	}

	// Start crawl loop
	crawlLoop(config, version.id).catch(async (err) => {
		console.error('[Auto Capture] Crawl error:', err);
		await updateCaptureState({ isRunning: false });
		isRunning = false;
	});
}

/**
 * Stop the auto-capture crawl.
 */
export async function stopAutoCrawl(): Promise<void> {
	isRunning = false;
	crawlQueue = [];
	currentTabId = null;
	await updateCaptureState({ isRunning: false, isPaused: false });
}

/**
 * Pause the auto-capture crawl.
 */
export async function pauseAutoCrawl(): Promise<void> {
	await updateCaptureState({ isPaused: true });
}

/**
 * Resume the auto-capture crawl.
 */
export async function resumeAutoCrawl(): Promise<void> {
	await updateCaptureState({ isPaused: false });
}

/**
 * Check if auto-capture is running.
 */
export function isAutoCrawlRunning(): boolean {
	return isRunning;
}

// ---------------------------------------------------------------------------
// Crawl loop
// ---------------------------------------------------------------------------

async function crawlLoop(config: AutoCaptureConfig, versionId: string): Promise<void> {
	while (crawlQueue.length > 0 && isRunning) {
		const state = await getCaptureState();

		// Check if we reached target
		const doneCount = state.pages.filter((p) => p.status === PAGE_STATUS.DONE).length;
		if (doneCount >= config.targetPageCount) {
			await updateCaptureState({ isRunning: false });
			isRunning = false;
			break;
		}

		// Wait while paused
		if (state.isPaused) {
			await sleep(500);
			continue;
		}

		const item = crawlQueue.shift();
		if (!item) break;

		const normalizedUrl = normalizeUrl(item.url);

		// Skip already visited
		if (visitedUrls.has(normalizedUrl)) continue;
		visitedUrls.add(normalizedUrl);

		// Check depth limit (with interest zone multipliers)
		const effectiveMaxDepth = getEffectiveDepth(config, item.url);
		if (item.depth > effectiveMaxDepth) continue;

		try {
			// Navigate to the page
			if (currentTabId !== null) {
				await navigateAndWait(currentTabId, item.url);
			}

			// Wait for DOM stabilization
			await sleep(1500);

			// Scroll to trigger lazy loading
			if (currentTabId !== null) {
				try {
					await chrome.tabs.sendMessage(currentTabId, { type: 'SCROLL_PAGE' });
				} catch {
					// Content script might not be injected yet
				}
			}
			await sleep(500);

			// Capture the page
			if (currentTabId !== null) {
				await captureAndUploadPage(currentTabId, versionId, config);
			}

			// Extract links for BFS
			if (currentTabId !== null && item.depth < effectiveMaxDepth) {
				const links = await extractPageLinks(currentTabId, config.blacklist);
				for (const link of links) {
					const normalized = normalizeUrl(link);
					if (!visitedUrls.has(normalized)) {
						crawlQueue.push({
							url: link,
							depth: item.depth + 1,
							parentUrl: item.url
						});
					}
				}
			}

			// Delay between pages
			await sleep(config.delayBetweenPages);
		} catch (err) {
			console.error(`[Auto Capture] Error processing ${item.url}:`, err);
			// Continue with next URL
		}
	}

	// Finished
	isRunning = false;
	await updateCaptureState({ isRunning: false });
}

// ---------------------------------------------------------------------------
// Page capture
// ---------------------------------------------------------------------------

async function captureAndUploadPage(
	tabId: number,
	versionId: string,
	config: AutoCaptureConfig
): Promise<void> {
	const localId = uuidv4();

	const page: CapturedPage = {
		id: '',
		localId,
		title: 'Capture automatique...',
		url: '',
		fileSize: 0,
		status: PAGE_STATUS.CAPTURING,
		capturedAt: new Date().toISOString()
	};

	await addCapturedPageToState(page);

	try {
		const captured = await captureCurrentPage(tabId);

		// Check file size > 10 MB
		const sizeBytes = new Blob([captured.html]).size;
		if (sizeBytes > 10 * 1024 * 1024) {
			// Auto-simplify: remove inline images to reduce size
			const simplified = simplifyHtml(captured.html);
			captured.html = simplified;
		}

		await updatePageStatus(localId, PAGE_STATUS.UPLOADING, {
			title: captured.title,
			url: captured.url
		});

		const result = await uploadCapturedPage(versionId, captured, 'auto');

		await updatePageStatus(localId, PAGE_STATUS.DONE, {
			id: result.id,
			fileSize: result.fileSize
		});
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
		await updatePageStatus(localId, PAGE_STATUS.ERROR, { error: errorMsg });
	}
}

// ---------------------------------------------------------------------------
// Link extraction
// ---------------------------------------------------------------------------

async function extractPageLinks(tabId: number, blacklist: string[]): Promise<string[]> {
	try {
		const results = await chrome.scripting.executeScript({
			target: { tabId },
			func: extractLinksFromDOM,
			args: [blacklist]
		});

		if (results && results[0]?.result) {
			return results[0].result as string[];
		}
	} catch {
		// Page might restrict script execution
	}
	return [];
}

/**
 * Runs in page context — extracts all internal links, filtering out blacklisted buttons.
 */
function extractLinksFromDOM(blacklist: string[]): string[] {
	const currentOrigin = window.location.origin;
	const links: Set<string> = new Set();

	// Collect <a> links
	const anchors = document.querySelectorAll('a[href]');
	anchors.forEach((anchor) => {
		const el = anchor as HTMLAnchorElement;
		const href = el.href;
		const text = el.textContent?.trim() || '';

		// Skip if text matches blacklist
		if (blacklist.some((b) => text.toLowerCase().includes(b.toLowerCase()))) {
			return;
		}

		// Only same-origin links
		if (href.startsWith(currentOrigin) || href.startsWith('/')) {
			const fullUrl = href.startsWith('/') ? `${currentOrigin}${href}` : href;
			// Skip anchors, javascript, mailto, tel
			if (
				!fullUrl.includes('#') &&
				!fullUrl.startsWith('javascript:') &&
				!fullUrl.startsWith('mailto:') &&
				!fullUrl.startsWith('tel:')
			) {
				links.add(fullUrl);
			}
		}
	});

	// Collect buttons/links that trigger SPA navigation (onclick handlers with router)
	const clickables = document.querySelectorAll('[role="link"], [data-href], [data-url]');
	clickables.forEach((el) => {
		const href =
			el.getAttribute('data-href') ||
			el.getAttribute('data-url') ||
			'';
		if (href && (href.startsWith(currentOrigin) || href.startsWith('/'))) {
			const fullUrl = href.startsWith('/') ? `${currentOrigin}${href}` : href;
			links.add(fullUrl);
		}
	});

	return Array.from(links);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeUrl(url: string): string {
	try {
		const u = new URL(url);
		// Remove trailing slash, hash, and normalize
		let path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.origin}${path}${u.search}`;
	} catch {
		return url;
	}
}

function getEffectiveDepth(config: AutoCaptureConfig, url: string): number {
	let maxDepth = config.maxDepth;

	for (const zone of config.interestZones) {
		try {
			const regex = new RegExp(zone.urlPattern);
			if (regex.test(url)) {
				maxDepth = Math.round(config.maxDepth * zone.depthMultiplier);
			}
		} catch {
			// Invalid regex — try simple includes
			if (url.includes(zone.urlPattern)) {
				maxDepth = Math.round(config.maxDepth * zone.depthMultiplier);
			}
		}
	}

	return maxDepth;
}

async function navigateAndWait(tabId: number, url: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			chrome.tabs.onUpdated.removeListener(listener);
			resolve(); // Proceed even if load didn't fully complete
		}, 15000);

		function listener(
			updatedTabId: number,
			changeInfo: chrome.tabs.TabChangeInfo
		) {
			if (updatedTabId === tabId && changeInfo.status === 'complete') {
				clearTimeout(timeout);
				chrome.tabs.onUpdated.removeListener(listener);
				resolve();
			}
		}

		chrome.tabs.onUpdated.addListener(listener);
		chrome.tabs.update(tabId, { url }).catch((err) => {
			clearTimeout(timeout);
			chrome.tabs.onUpdated.removeListener(listener);
			reject(err);
		});
	});
}

function simplifyHtml(html: string): string {
	// Remove base64 data URIs (images) to reduce size
	return html.replace(/src="data:image\/[^"]+"/g, 'src=""')
		.replace(/url\(data:image\/[^)]+\)/g, 'url()');
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
