import { PAGE_STATUS, STORAGE_KEYS, type CapturedPage, type CaptureState } from './constants';
import {
	captureCurrentPage,
	uploadCapturedPage,
	addCapturedPageToState,
	updatePageStatus,
	getCaptureState,
	updateCaptureState
} from './capture';
import { buildSelfContainedPage, getLastFaviconDataUri } from './resource-fetcher';
import api from './api';
import { v4 as uuidv4 } from './uuid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoCaptureConfig {
	targetPageCount: number;
	maxDepth: number;
	delayBetweenPages: number; // ms
	pageTimeout: number; // ms — max time per page before skipping with error
	interestZones: InterestZone[];
	blacklist: string[];
}

export interface InterestZone {
	urlPattern: string;
	depth: number;
}

interface CrawlQueueItem {
	url: string;
	depth: number;
	parentUrl?: string;
}

const DEFAULT_CONFIG: AutoCaptureConfig = {
	targetPageCount: 20,
	maxDepth: 12,
	delayBetweenPages: 500,
	pageTimeout: 60000,
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
let visitedPaths: Set<string> = new Set(); // Deduplicate by pathname (ignore query params)
let isRunning = false;
let currentTabId: number | null = null;
let consecutiveErrors = 0;

const MAX_CONSECUTIVE_ERRORS = 3;

// URL patterns that are NOT navigable pages (API endpoints, resources, etc.)
const SKIP_URL_PATTERNS = [
	'/api/', '/services/', '/aura/', '/_ui/', '/apexremote',
	'/servlet/', '/.well-known/', '/siteassets/',
	'.json', '.xml', '.js', '.css', '.png', '.jpg', '.gif', '.svg',
	'.woff', '.woff2', '.ttf', '.pdf', '.zip', '.csv',
	'oauth', 'login.', 'logout', 'secur/frontdoor',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get saved auto-capture config or defaults.
 */
export async function getAutoConfig(): Promise<AutoCaptureConfig> {
	const result = await chrome.storage.local.get(STORAGE_KEY_AUTO_CONFIG);
	const saved = result[STORAGE_KEY_AUTO_CONFIG];
	if (!saved) return { ...DEFAULT_CONFIG };
	// Merge with defaults so new fields always have a value
	return { ...DEFAULT_CONFIG, ...saved };
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
	visitedPaths = new Set();
	isRunning = true;
	currentTabId = tabId;
	consecutiveErrors = 0;

	// Update capture state
	await updateCaptureState({
		mode: 'auto',
		isRunning: true,
		isPaused: false,
		targetPageCount: config.targetPageCount
	});

	// Get active version
	const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
	const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
	if (!version?.id) {
		throw new Error('Aucune version sélectionnée');
	}

	// Create capture job on backend
	try {
		const jobResult = await api.post<{ data: { id: string } }>(
			`/versions/${version.id}/capture-jobs`,
			{
				mode: 'auto',
				targetPageCount: config.targetPageCount,
				startUrl: tab.url
			}
		);
		if (jobResult?.data?.id) {
			await updateCaptureState({ jobId: jobResult.data.id });
		}
	} catch (err) {
		console.error('[Auto Capture] Failed to create capture job:', err);
		// Non-critical: continue crawling even if job creation fails
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

	// Finalize capture job on backend
	const state = await getCaptureState();
	if (state.jobId) {
		const doneCount = state.pages.filter((p) => p.status === PAGE_STATUS.DONE).length;
		await api.put(`/capture-jobs/${state.jobId}`, {
			status: 'done',
			pagesCaptured: doneCount
		}).catch(() => {
			// Non-critical
		});
	}

	await updateCaptureState({ isRunning: false, isPaused: false, jobId: undefined });
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
			// Finalize capture job
			if (state.jobId) {
				await api.put(`/capture-jobs/${state.jobId}`, {
					status: 'done',
					pagesCaptured: doneCount
				}).catch(() => {});
			}
			await updateCaptureState({ isRunning: false, jobId: undefined });
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

		// Skip already visited (full URL)
		if (visitedUrls.has(normalizedUrl)) continue;
		visitedUrls.add(normalizedUrl);

		// Skip if we already captured a page with the same pathname (ignore query params)
		const urlPathname = extractPathname(item.url);
		if (visitedPaths.has(urlPathname)) {
			console.log(`[Auto Capture] Skip duplicate path: ${urlPathname}`);
			continue;
		}

		// Skip non-page URLs (API endpoints, resources, files)
		if (isNonPageUrl(item.url)) {
			console.log(`[Auto Capture] Skip non-page URL: ${item.url}`);
			continue;
		}

		// Check depth limit (with interest zone multipliers)
		const effectiveMaxDepth = getEffectiveDepth(config, item.url);
		if (item.depth > effectiveMaxDepth) continue;

		try {
			// Wrap the entire page processing in a timeout
			await withTimeout(config.pageTimeout, item.url, async () => {
				// Navigate to the page
				if (currentTabId !== null) {
					await navigateAndWait(currentTabId, item.url);
				}

				// Wait for initial DOM load
				await sleep(500);

				// Check for HTTP errors (431, 429, 5xx, etc.)
				if (currentTabId !== null) {
					const httpError = await detectHttpError(currentTabId);
					if (httpError) {
						console.error(`[Auto Capture] HTTP ${httpError.code} on ${item.url}: ${httpError.message}`);
						throw new HttpPageError(item.url, httpError.code, httpError.message);
					}
				}

				// Verify the page is actual HTML (not JSON/API/resource)
				if (currentTabId !== null) {
					const isHtml = await verifyPageIsHtml(currentTabId);
					if (!isHtml) {
						console.log(`[Auto Capture] Skipping non-HTML page: ${item.url}`);
						return;
					}
				}

				// Scroll to trigger lazy loading
				if (currentTabId !== null) {
					try {
						await chrome.tabs.sendMessage(currentTabId, { type: 'SCROLL_PAGE' });
					} catch {
						// Content script might not be injected yet
					}
				}

				// Wait for DOM stabilization (MutationObserver + image tracking)
				if (currentTabId !== null) {
					try {
						await chrome.tabs.sendMessage(currentTabId, { type: 'WAIT_FOR_STABLE_DOM', timeout: 6000 });
					} catch {
						// Fallback: simple delay if content script not available
						await sleep(1500);
					}
				}

				// Mark this pathname as captured
				visitedPaths.add(urlPathname);

				// Capture the page
				if (currentTabId !== null) {
					await captureAndUploadPage(currentTabId, versionId, config);

					// Update capture job progress on backend
					const postCaptureState = await getCaptureState();
					if (postCaptureState.jobId) {
						const capturedCount = postCaptureState.pages.filter(
							(p) => p.status === PAGE_STATUS.DONE
						).length;
						await api.put(`/capture-jobs/${postCaptureState.jobId}`, {
							pagesCaptured: capturedCount,
							status: capturedCount >= config.targetPageCount ? 'done' : 'running'
						}).catch(() => {});
					}
				}

				// Extract links for BFS
				if (currentTabId !== null && item.depth < effectiveMaxDepth) {
					const links = await extractPageLinks(currentTabId, config.blacklist);
					for (const link of links) {
						const normalized = normalizeUrl(link);
						const linkPath = extractPathname(link);
						// Skip if already visited by full URL, pathname, or non-page URL
						if (!visitedUrls.has(normalized) && !visitedPaths.has(linkPath) && !isNonPageUrl(link)) {
							crawlQueue.push({
								url: link,
								depth: item.depth + 1,
								parentUrl: item.url
							});
						}
					}
				}
			});

			// Success — reset consecutive error counter
			consecutiveErrors = 0;

			// Delay between pages
			await sleep(config.delayBetweenPages);
		} catch (err) {
			consecutiveErrors++;
			console.error(`[Auto Capture] Error processing ${item.url} (${consecutiveErrors} consecutive):`, err);

			// Too many consecutive errors: rotate queue to explore other branches
			if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && crawlQueue.length > 1) {
				rotateQueueToNewBranch(item);
			}

			// Add an error page entry so the user sees it in the list
			if (err instanceof PageTimeoutError) {
				const localId = uuidv4();
				const errorPage: CapturedPage = {
					id: '',
					localId,
					title: `Timeout — ${item.url}`,
					url: item.url,
					fileSize: 0,
					status: PAGE_STATUS.ERROR,
					error: `Timeout après ${Math.round(config.pageTimeout / 1000)}s`,
					capturedAt: new Date().toISOString()
				};
				await addCapturedPageToState(errorPage);
			} else if (err instanceof HttpPageError) {
				const localId = uuidv4();
				const errorPage: CapturedPage = {
					id: '',
					localId,
					title: `HTTP ${err.httpCode} — ${item.url}`,
					url: item.url,
					fileSize: 0,
					status: PAGE_STATUS.ERROR,
					error: `HTTP ${err.httpCode}: ${err.httpMessage}`,
					capturedAt: new Date().toISOString()
				};
				await addCapturedPageToState(errorPage);
			}
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
		// Phase 1: Collect DOM + resource manifest
		const collected = await captureCurrentPage(tabId);

		// Safety net: reject pages whose title looks like an HTTP error page
		const httpErrorMatch = collected.title.match(/^(?:Error\s+)?(\d{3})\b/i);
		if (httpErrorMatch) {
			const code = parseInt(httpErrorMatch[1], 10);
			if (code >= 400 && code < 600) {
				throw new Error(`Page is an HTTP error page (${code}): ${collected.title}`);
			}
		}

		await updatePageStatus(localId, PAGE_STATUS.UPLOADING, {
			title: collected.title,
			url: collected.url
		});

		// Phase 2: Fetch resources and build self-contained HTML
		let selfContainedHtml = await buildSelfContainedPage(
			collected.html,
			collected.resources,
			collected.url
		);

		// Check file size > 10 MB — simplify if needed
		const sizeBytes = new Blob([selfContainedHtml]).size;
		if (sizeBytes > 10 * 1024 * 1024) {
			selfContainedHtml = simplifyHtml(selfContainedHtml);
		}

		const result = await uploadCapturedPage(
			versionId,
			{ html: selfContainedHtml, title: collected.title, url: collected.url },
			'auto',
			null,
			getLastFaviconDataUri()
		);

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

/**
 * After too many consecutive errors, rotate the queue so the next item
 * comes from a different branch (different parent or different depth).
 * This avoids getting stuck on a cluster of broken sibling pages.
 */
function rotateQueueToNewBranch(failedItem: CrawlQueueItem): void {
	const idx = crawlQueue.findIndex(
		(q) => q.depth !== failedItem.depth || q.parentUrl !== failedItem.parentUrl
	);
	if (idx > 0) {
		// Move items from a different branch to the front
		const rotated = crawlQueue.splice(idx);
		crawlQueue = [...rotated, ...crawlQueue];
		console.log(
			`[Auto Capture] ${consecutiveErrors} erreurs consécutives — rotation de la queue ` +
			`(${rotated.length} URLs d'une autre branche passent devant)`
		);
	}
}

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
				maxDepth = Math.max(maxDepth, zone.depth);
			}
		} catch {
			// Invalid regex — try simple includes
			if (url.includes(zone.urlPattern)) {
				maxDepth = Math.max(maxDepth, zone.depth);
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

class PageTimeoutError extends Error {
	constructor(url: string, timeoutMs: number) {
		super(`Page timeout après ${Math.round(timeoutMs / 1000)}s : ${url}`);
		this.name = 'PageTimeoutError';
	}
}

class HttpPageError extends Error {
	constructor(
		public readonly url: string,
		public readonly httpCode: number,
		public readonly httpMessage: string
	) {
		super(`HTTP ${httpCode} sur ${url} : ${httpMessage}`);
		this.name = 'HttpPageError';
	}
}

async function withTimeout(timeoutMs: number, url: string, fn: () => Promise<void>): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (!settled) {
				settled = true;
				reject(new PageTimeoutError(url, timeoutMs));
			}
		}, timeoutMs);

		fn()
			.then(() => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve();
				}
			})
			.catch((err) => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					reject(err);
				}
			});
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract just the pathname from a URL (no origin, no query, no hash).
 */
function extractPathname(url: string): string {
	try {
		const u = new URL(url);
		return u.pathname.replace(/\/+$/, '') || '/';
	} catch {
		return url;
	}
}

/**
 * Check if a URL is likely a non-page resource (API, file, etc.).
 */
function isNonPageUrl(url: string): boolean {
	const lower = url.toLowerCase();
	return SKIP_URL_PATTERNS.some(pattern => lower.includes(pattern));
}

/**
 * After navigating, check if the page hit an HTTP error (431, 429, etc.).
 * Chrome renders error pages that look like HTML, so we detect them by content.
 * Returns the HTTP error code if detected, or null if the page is fine.
 */
async function detectHttpError(tabId: number): Promise<{ code: number; message: string } | null> {
	try {
		const results = await chrome.scripting.executeScript({
			target: { tabId },
			func: () => {
				const body = document.body?.innerText || '';
				// Chrome's built-in error page format: "HTTP ERROR NNN"
				const match = body.match(/HTTP\s+ERROR\s+(\d{3})/i);
				if (match) {
					const code = parseInt(match[1], 10);
					// Extract the status message (e.g. "Request Header Fields Too Large")
					const msgMatch = body.match(/MESSAGE:\s*(.+)/i);
					const message = msgMatch?.[1]?.trim() || `HTTP ${code}`;
					return { code, message };
				}
				// Also check page title for error indicators
				const title = document.title || '';
				if (/^\d{3}\s/.test(title) || title.includes('Error')) {
					const titleCode = parseInt(title, 10);
					if (titleCode >= 400 && titleCode < 600) {
						return { code: titleCode, message: title };
					}
				}
				return null;
			}
		});
		return results?.[0]?.result ?? null;
	} catch {
		return null;
	}
}

/**
 * After navigating, verify the page is actual HTML (not JSON, plain text, etc.).
 * Checks the document content type via the content script.
 */
async function verifyPageIsHtml(tabId: number): Promise<boolean> {
	try {
		const results = await chrome.scripting.executeScript({
			target: { tabId },
			func: () => {
				// Check if the page looks like rendered HTML vs raw code
				const body = document.body;
				if (!body) return false;

				// If the body only contains a <pre> tag, it's likely raw text/JSON
				const children = body.children;
				if (children.length === 1 && children[0].tagName === 'PRE') {
					return false;
				}

				// Check content type from document
				const ct = document.contentType;
				if (ct && !ct.includes('html')) {
					return false;
				}

				return true;
			}
		});
		return results?.[0]?.result ?? true;
	} catch {
		// If we can't check, assume it's OK
		return true;
	}
}
