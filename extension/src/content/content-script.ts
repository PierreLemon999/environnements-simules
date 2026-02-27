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
// Lemon Learning Player detection
// ---------------------------------------------------------------------------

function detectLLPlayer(): { detected: boolean; method?: string } {
	// Check known selectors
	const selectors = [
		'[class*="lemon-learning"]',
		'[class*="lemonlearning"]',
		'[class*="ll-player"]',
		'#ll-player',
		'#lemon-learning',
		'iframe[src*="lemonlearning"]',
		'iframe[src*="lemon-learning"]',
		'[data-ll-guide]',
		'[data-lemon-learning]'
	];

	for (const selector of selectors) {
		if (document.querySelector(selector)) {
			return { detected: true, method: `selector:${selector}` };
		}
	}

	// Check global variables
	const win = window as Record<string, unknown>;
	if (win.__LEMON_LEARNING__ || win.LemonLearning || win.ll) {
		return { detected: true, method: 'global_variable' };
	}

	// Check for LL-related scripts
	const scripts = document.querySelectorAll('script[src]');
	for (const script of Array.from(scripts)) {
		const src = (script as HTMLScriptElement).src;
		if (src.includes('lemonlearning') || src.includes('lemon-learning')) {
			return { detected: true, method: `script:${src}` };
		}
	}

	return { detected: false };
}

function scanLLGuides(): { guides: Array<{ id: string; name: string; stepCount: number }> } {
	const guides: Array<{ id: string; name: string; stepCount: number }> = [];

	// Strategy 1: LL Player internal state
	const win = window as Record<string, unknown>;
	const llState = win.__LEMON_LEARNING__ as Record<string, unknown> | undefined;
	if (llState && typeof llState === 'object') {
		const llGuides = (llState.guides || llState.walkthroughs || llState.flows) as Array<Record<string, unknown>> | undefined;
		if (Array.isArray(llGuides)) {
			for (const g of llGuides) {
				guides.push({
					id: String(g.id || g.guideId || Math.random().toString(36).slice(2)),
					name: String(g.name || g.title || 'Guide sans nom'),
					stepCount: Array.isArray(g.steps) ? g.steps.length : 0
				});
			}
		}
	}

	// Strategy 2: Scan DOM for guide-related elements
	if (guides.length === 0) {
		const guideElements = document.querySelectorAll(
			'[data-ll-guide], [data-guide-id], [class*="ll-guide-item"], [class*="guide-list"] li'
		);
		let idx = 0;
		guideElements.forEach((el) => {
			const name = el.getAttribute('data-guide-name') ||
				el.getAttribute('title') ||
				el.textContent?.trim().slice(0, 100) || `Guide ${idx + 1}`;
			const id = el.getAttribute('data-ll-guide') ||
				el.getAttribute('data-guide-id') || `dom-guide-${idx}`;
			const stepCountAttr = el.getAttribute('data-step-count');
			guides.push({
				id,
				name,
				stepCount: stepCountAttr ? parseInt(stepCountAttr, 10) : 0
			});
			idx++;
		});
	}

	return { guides };
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
