/**
 * Content script — injected into every page.
 *
 * Listens for messages from the popup / background to:
 * - Scroll the page to trigger lazy loading
 * - Capture the DOM
 * - Highlight elements for guided capture
 */

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	switch (message.type) {
		case 'SCROLL_PAGE':
			scrollEntirePage()
				.then(() => sendResponse({ success: true }))
				.catch((err) => sendResponse({ error: err.message }));
			return true;

		case 'GET_PAGE_INFO':
			sendResponse({
				title: document.title,
				url: window.location.href,
				readyState: document.readyState
			});
			return false;

		case 'HIGHLIGHT_ELEMENT':
			highlightElement(message.selector as string);
			sendResponse({ success: true });
			return false;

		case 'REMOVE_HIGHLIGHTS':
			removeHighlights();
			sendResponse({ success: true });
			return false;

		case 'GET_LINKS': {
			const links = extractInternalLinks(message.blacklist || []);
			sendResponse({ links });
			return false;
		}

		case 'DETECT_LL_PLAYER':
			sendResponse(detectLLPlayer());
			return false;

		case 'SCAN_LL_GUIDES':
			sendResponse(scanLLGuides());
			return false;

		case 'WAIT_FOR_STABLE_DOM':
			waitForStableDOM(message.timeout as number | undefined)
				.then((result) => sendResponse(result))
				.catch((err) => sendResponse({ stable: false, error: err.message }));
			return true;

		case 'PING':
			sendResponse({ pong: true });
			return false;
	}
});

// ---------------------------------------------------------------------------
// Page scrolling (triggers lazy-loaded content)
// ---------------------------------------------------------------------------

async function scrollEntirePage(): Promise<void> {
	const totalHeight = document.body.scrollHeight;
	const viewportHeight = window.innerHeight;
	const steps = Math.ceil(totalHeight / viewportHeight);

	for (let i = 0; i <= steps; i++) {
		window.scrollTo(0, i * viewportHeight);
		await sleep(300);
	}

	// Scroll back to top
	window.scrollTo(0, 0);
	// Wait for any remaining lazy loads
	await sleep(1000);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Smart DOM stabilization (MutationObserver + image load tracking)
// ---------------------------------------------------------------------------

async function waitForStableDOM(timeoutMs: number = 8000): Promise<{ stable: boolean; pendingImages: number }> {
	const startTime = Date.now();
	const IDLE_THRESHOLD_MS = 500; // Consider stable after 500ms of no mutations

	return new Promise((resolve) => {
		let lastMutationTime = Date.now();
		let checkInterval: ReturnType<typeof setInterval>;

		// Watch for DOM mutations
		const observer = new MutationObserver(() => {
			lastMutationTime = Date.now();
		});

		observer.observe(document.documentElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['src', 'srcset', 'style', 'class']
		});

		// Query pending images from the hooks script (MAIN world)
		function getPendingImageCount(): number {
			let count = 0;
			const handler = (e: Event) => {
				count = (e as CustomEvent).detail?.count ?? 0;
			};
			window.addEventListener('__ES_PENDING_IMAGES_RESULT__', handler, { once: true });
			window.dispatchEvent(new Event('__ES_GET_PENDING_IMAGES__'));
			window.removeEventListener('__ES_PENDING_IMAGES_RESULT__', handler);
			return count;
		}

		// Also count images directly (fallback if hooks not loaded)
		function countLoadingImages(): number {
			const imgs = document.querySelectorAll('img');
			let loading = 0;
			imgs.forEach((img) => {
				if (!img.complete && img.src && !img.src.startsWith('data:')) {
					loading++;
				}
			});
			return loading;
		}

		checkInterval = setInterval(() => {
			const elapsed = Date.now() - startTime;
			const timeSinceLastMutation = Date.now() - lastMutationTime;
			const pendingFromHooks = getPendingImageCount();
			const pendingDirect = countLoadingImages();
			const pendingImages = Math.max(pendingFromHooks, pendingDirect);

			// Stable if: no mutations for IDLE_THRESHOLD_MS and no pending images
			const isIdle = timeSinceLastMutation >= IDLE_THRESHOLD_MS;
			const imagesReady = pendingImages === 0;

			if ((isIdle && imagesReady) || elapsed >= timeoutMs) {
				observer.disconnect();
				clearInterval(checkInterval);
				resolve({ stable: isIdle && imagesReady, pendingImages });
			}
		}, 200);
	});
}

// ---------------------------------------------------------------------------
// Element highlighting (for guided capture)
// ---------------------------------------------------------------------------

const HIGHLIGHT_CLASS = 'es-capture-highlight';

function highlightElement(selector: string): void {
	removeHighlights();

	const el = document.querySelector(selector);
	if (!el) return;

	const overlay = document.createElement('div');
	overlay.className = HIGHLIGHT_CLASS;

	const rect = el.getBoundingClientRect();
	Object.assign(overlay.style, {
		position: 'fixed',
		top: `${rect.top}px`,
		left: `${rect.left}px`,
		width: `${rect.width}px`,
		height: `${rect.height}px`,
		border: '3px solid #3B82F6',
		borderRadius: '4px',
		backgroundColor: 'rgba(59, 130, 246, 0.1)',
		zIndex: '999999',
		pointerEvents: 'none',
		transition: 'all 0.2s ease'
	});

	document.body.appendChild(overlay);
}

function removeHighlights(): void {
	document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.remove());
}

// ---------------------------------------------------------------------------
// Link extraction (for auto-capture BFS crawl)
// ---------------------------------------------------------------------------

function extractInternalLinks(blacklist: string[]): string[] {
	const currentOrigin = window.location.origin;
	const links: Set<string> = new Set();

	const anchors = document.querySelectorAll('a[href]');
	anchors.forEach((anchor) => {
		const el = anchor as HTMLAnchorElement;
		const href = el.href;
		const text = el.textContent?.trim() || '';

		// Skip if text matches blacklist
		if (blacklist.some((b: string) => text.toLowerCase().includes(b.toLowerCase()))) {
			return;
		}

		// Only same-origin links
		if (href.startsWith(currentOrigin) || href.startsWith('/')) {
			const fullUrl = href.startsWith('/') ? `${currentOrigin}${href}` : href;
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

	// SPA-style links
	const clickables = document.querySelectorAll('[role="link"], [data-href], [data-url]');
	clickables.forEach((el) => {
		const href = el.getAttribute('data-href') || el.getAttribute('data-url') || '';
		if (href && (href.startsWith(currentOrigin) || href.startsWith('/'))) {
			const fullUrl = href.startsWith('/') ? `${currentOrigin}${href}` : href;
			links.add(fullUrl);
		}
	});

	return Array.from(links);
}

// ---------------------------------------------------------------------------
// Lemon Learning Player detection (DOM-only fallback, isolated world)
// Note: Main detection runs via chrome.scripting.executeScript in MAIN world
// from the service worker. This is a fallback for DOM-based checks only.
// ---------------------------------------------------------------------------

function detectLLPlayer(): { detected: boolean; method?: string } {
	// Check the embed script tag (works from isolated world since DOM is shared)
	if (document.getElementById('lemonlearning-player-embed')) {
		return { detected: true, method: 'script-tag' };
	}
	// Check shadow DOM host
	if (document.getElementById('lemon-learning-player')) {
		return { detected: true, method: 'shadow-dom-host' };
	}
	// Check script src
	const scripts = document.querySelectorAll('script[src]');
	for (const script of Array.from(scripts)) {
		const src = (script as HTMLScriptElement).src;
		if (src.includes('lemonlearning') || src.includes('lemon-learning')) {
			return { detected: true, method: `script-src` };
		}
	}
	return { detected: false };
}

function scanLLGuides(): { guides: Array<{ id: string; name: string; stepCount: number }> } {
	// DOM-only fallback — real scanning happens in MAIN world from service worker
	return { guides: [] };
}

// ---------------------------------------------------------------------------
// Notify background that content script is ready
// ---------------------------------------------------------------------------

chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {
	// Background might not be listening — that's ok
});

// ---------------------------------------------------------------------------
// Extension detection for admin frontend
// ---------------------------------------------------------------------------

// Inject a marker element for the admin frontend to detect
const marker = document.createElement('div');
marker.id = 'es-extension-installed';
marker.setAttribute('data-version', '0.1.0');
marker.style.display = 'none';
document.documentElement.appendChild(marker);

// Listen for ping from admin frontend
window.addEventListener('message', (event) => {
	if (event.data?.type === 'ES_EXTENSION_PING') {
		window.postMessage({ type: 'ES_EXTENSION_PONG', version: '0.1.0' }, '*');
	}
});
