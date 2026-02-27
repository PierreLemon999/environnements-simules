/**
 * Content script — injected into every page.
 *
 * Listens for messages from the popup / background to:
 * - Scroll the page to trigger lazy loading
 * - Capture the DOM
 * - Highlight elements for guided capture
 * - Compute DOM fingerprint for SPA state identification
 */

import { computeStateIdentity } from '../lib/dom-fingerprint';

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

		case 'DETECT_MODALS':
			sendResponse({ modals: detectVisibleModalsInPage() });
			return false;

		case 'CAPTURE_MODAL':
			captureModalSubtree(message.modalSelector as string)
				.then((data) => sendResponse(data))
				.catch((err) => sendResponse({ error: err.message }));
			return true;

		case 'GET_LAST_TRANSITION': {
			let transitionData: unknown = null;
			const transitionHandler = (e: Event) => {
				transitionData = (e as CustomEvent).detail ?? null;
			};
			window.addEventListener('__ES_LAST_TRANSITION_RESULT__', transitionHandler, { once: true });
			window.dispatchEvent(new Event('__ES_GET_LAST_TRANSITION__'));
			window.removeEventListener('__ES_LAST_TRANSITION_RESULT__', transitionHandler);
			sendResponse({ transition: transitionData });
			return false;
		}

		case 'CLEAR_LAST_TRANSITION':
			window.dispatchEvent(new Event('__ES_CLEAR_LAST_TRANSITION__'));
			sendResponse({ success: true });
			return false;

		case 'DETECT_LOADING_INDICATOR': {
			const detection = detectLoadingIndicatorFromDOM();
			sendResponse(detection);
			return false;
		}

		case 'COMPUTE_DOM_FINGERPRINT':
			sendResponse(computeStateIdentity());
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
// Loading indicator detection (DOM query from isolated world)
// ---------------------------------------------------------------------------

function detectLoadingIndicatorFromDOM(): { detected: boolean; type: string | null; selector: string | null } {
	// 1. Check for ARIA progressbar
	const progressbar = document.querySelector('[role="progressbar"]');
	if (progressbar) {
		return { detected: true, type: 'progress', selector: buildMinimalSelector(progressbar) };
	}

	// 2. Check for aria-busy="true"
	const ariaBusy = document.querySelector('[aria-busy="true"]');
	if (ariaBusy) {
		return { detected: true, type: 'spinner', selector: buildMinimalSelector(ariaBusy) };
	}

	// 3. Check for classes containing spinner/loader/loading/skeleton
	const loadingPatterns = ['spinner', 'loader', 'loading', 'skeleton'];
	for (const pattern of loadingPatterns) {
		const match = document.querySelector(`[class*="${pattern}"]`);
		if (match && isElementVisible(match)) {
			const type = pattern === 'skeleton' ? 'skeleton' : 'spinner';
			return { detected: true, type, selector: buildMinimalSelector(match) };
		}
	}

	// 4. Check for animated elements inside overlay/fixed containers
	const allElements = document.querySelectorAll('*');
	for (const el of allElements) {
		const style = window.getComputedStyle(el);
		const isAnimated = style.animationName !== 'none' && style.animationName !== '';
		if (!isAnimated) continue;

		let parent: Element | null = el;
		while (parent && parent !== document.documentElement) {
			const parentStyle = window.getComputedStyle(parent);
			if (parentStyle.position === 'fixed' || parentStyle.position === 'absolute') {
				return { detected: true, type: 'spinner', selector: buildMinimalSelector(el) };
			}
			parent = parent.parentElement;
		}
	}

	return { detected: false, type: null, selector: null };
}

function buildMinimalSelector(el: Element): string {
	if (el.id) return `#${el.id}`;
	const testId = el.getAttribute('data-testid');
	if (testId) return `[data-testid="${testId}"]`;
	let selector = el.tagName.toLowerCase();
	if (el.className && typeof el.className === 'string') {
		const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
		if (cls) selector += `.${cls}`;
	}
	return selector;
}

function isElementVisible(el: Element): boolean {
	const style = window.getComputedStyle(el);
	if (style.display === 'none' || style.visibility === 'hidden') return false;
	const rect = el.getBoundingClientRect();
	return rect.width > 0 || rect.height > 0;
}

// ---------------------------------------------------------------------------
// Modal detection (DOM-only, runs in content script isolated world)
// ---------------------------------------------------------------------------

interface DetectedModalResult {
	selector: string;
	detectionMethod: 'role_dialog' | 'aria_modal' | 'z_index' | 'position_fixed' | 'css_class';
	title: string;
	triggerSelector?: string;
	triggerText?: string;
}

function generateModalSelector(el: Element): string {
	if (el.id) {
		const escaped = CSS.escape(el.id);
		if (document.querySelectorAll(`#${escaped}`).length === 1) {
			return `#${escaped}`;
		}
	}
	for (const attr of Array.from(el.attributes)) {
		if (attr.name.startsWith('data-') && attr.value) {
			const selector = `${el.tagName.toLowerCase()}[${attr.name}="${CSS.escape(attr.value)}"]`;
			try {
				if (document.querySelectorAll(selector).length === 1) return selector;
			} catch { /* skip */ }
		}
	}
	const role = el.getAttribute('role');
	if (role) {
		const ariaLabel = el.getAttribute('aria-label');
		if (ariaLabel) {
			const selector = `[role="${role}"][aria-label="${CSS.escape(ariaLabel)}"]`;
			try {
				if (document.querySelectorAll(selector).length === 1) return selector;
			} catch { /* skip */ }
		}
	}
	const parts: string[] = [];
	let current: Element | null = el;
	while (current && current !== document.documentElement) {
		const tag = current.tagName.toLowerCase();
		const parent = current.parentElement;
		if (current.id) {
			parts.unshift(`#${CSS.escape(current.id)}`);
			break;
		}
		if (parent) {
			const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName);
			if (siblings.length === 1) {
				parts.unshift(tag);
			} else {
				const index = siblings.indexOf(current) + 1;
				parts.unshift(`${tag}:nth-child(${index})`);
			}
		} else {
			parts.unshift(tag);
		}
		current = parent;
		const partial = parts.join(' > ');
		try {
			if (document.querySelectorAll(partial).length === 1) return partial;
		} catch { /* keep building */ }
	}
	return parts.join(' > ');
}

function extractModalTitle(el: Element): string {
	const ariaLabel = el.getAttribute('aria-label');
	if (ariaLabel?.trim()) return ariaLabel.trim().substring(0, 100);
	const labelledBy = el.getAttribute('aria-labelledby');
	if (labelledBy) {
		const labelEl = document.getElementById(labelledBy);
		if (labelEl?.textContent?.trim()) return labelEl.textContent.trim().substring(0, 100);
	}
	const heading = el.querySelector('h1, h2, h3');
	if (heading?.textContent?.trim()) return heading.textContent.trim().substring(0, 100);
	const text = el.textContent?.trim() || '';
	if (text.length > 0) return text.substring(0, 50) + (text.length > 50 ? '...' : '');
	return 'Modal';
}

function getModalViewportCoverage(el: Element): number {
	const rect = el.getBoundingClientRect();
	const vpArea = window.innerWidth * window.innerHeight;
	if (vpArea === 0) return 0;
	const overlapW = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
	const overlapH = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
	return (overlapW * overlapH) / vpArea;
}

function isModalAlreadyDetected(el: Element, detected: Element[]): boolean {
	for (const existing of detected) {
		if (existing === el || existing.contains(el) || el.contains(existing)) return true;
	}
	return false;
}

function detectVisibleModalsInPage(): DetectedModalResult[] {
	const results: DetectedModalResult[] = [];
	const detectedElements: Element[] = [];

	// 1. role="dialog" / role="alertdialog"
	for (const el of Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'))) {
		if (!isElementVisible(el) || isModalAlreadyDetected(el, detectedElements)) continue;
		detectedElements.push(el);
		results.push({ selector: generateModalSelector(el), detectionMethod: 'role_dialog', title: extractModalTitle(el) });
	}

	// 2. aria-modal="true"
	for (const el of Array.from(document.querySelectorAll('[aria-modal="true"]'))) {
		if (!isElementVisible(el) || isModalAlreadyDetected(el, detectedElements)) continue;
		detectedElements.push(el);
		results.push({ selector: generateModalSelector(el), detectionMethod: 'aria_modal', title: extractModalTitle(el) });
	}

	// 3. position fixed/absolute + z-index >= 1000 + >30% viewport
	for (const el of Array.from(document.querySelectorAll('*'))) {
		if (isModalAlreadyDetected(el, detectedElements)) continue;
		const style = window.getComputedStyle(el);
		if (style.position !== 'fixed' && style.position !== 'absolute') continue;
		const zIndex = parseInt(style.zIndex, 10);
		if (isNaN(zIndex) || zIndex < 1000) continue;
		if (!isElementVisible(el) || getModalViewportCoverage(el) < 0.3) continue;
		if (el.children.length === 0 && (el.textContent?.trim() || '').length < 5) continue;
		detectedElements.push(el);
		results.push({ selector: generateModalSelector(el), detectionMethod: 'z_index', title: extractModalTitle(el) });
	}

	// 4. CSS class patterns
	for (const el of Array.from(document.querySelectorAll(
		'.modal, .dialog, .popup, .overlay-content, ' +
		'[class*="modal"]:not([class*="modal-backdrop"]):not([class*="modal-overlay"]), ' +
		'[class*="dialog"], [class*="Dialog"]'
	))) {
		if (!isElementVisible(el) || isModalAlreadyDetected(el, detectedElements)) continue;
		const rect = el.getBoundingClientRect();
		if (rect.width < 100 || rect.height < 50) continue;
		const style = window.getComputedStyle(el);
		const zIndex = parseInt(style.zIndex, 10);
		if (style.position !== 'fixed' && style.position !== 'absolute' && !(zIndex >= 1)) continue;
		detectedElements.push(el);
		results.push({ selector: generateModalSelector(el), detectionMethod: 'css_class', title: extractModalTitle(el) });
	}

	return results;
}

// ---------------------------------------------------------------------------
// Modal capture — extract a modal subtree as a self-contained HTML page
// ---------------------------------------------------------------------------

async function captureModalSubtree(modalSelector: string): Promise<{
	html: string;
	title: string;
	url: string;
}> {
	const modalEl = document.querySelector(modalSelector);
	if (!modalEl) {
		throw new Error(`Modal element not found: ${modalSelector}`);
	}

	const title = extractModalTitle(modalEl);
	const url = window.location.href;
	const origin = window.location.origin;

	// Find backdrop/overlay behind the modal
	let backdropEl: Element | null = null;
	const candidates = [
		modalEl.previousElementSibling,
		modalEl.parentElement,
	];
	for (const candidate of candidates) {
		if (!candidate || candidate === document.documentElement || candidate === document.body) continue;
		const style = window.getComputedStyle(candidate);
		const isOverlay = (
			(style.position === 'fixed' || style.position === 'absolute') &&
			(parseFloat(style.opacity) < 1 || style.backgroundColor.includes('rgba'))
		);
		if (isOverlay) {
			backdropEl = candidate;
			break;
		}
	}
	// Check common backdrop selectors as fallback
	if (!backdropEl) {
		const backdropSelectors = [
			'.modal-backdrop', '.modal-overlay', '.overlay',
			'[class*="backdrop"]', '[class*="overlay"]',
			'[data-backdrop]'
		];
		for (const sel of backdropSelectors) {
			const el = document.querySelector(sel);
			if (el && isElementVisible(el)) {
				backdropEl = el;
				break;
			}
		}
	}

	// Clone modal and backdrop
	const modalClone = modalEl.cloneNode(true) as HTMLElement;
	const backdropClone = backdropEl ? backdropEl.cloneNode(true) as HTMLElement : null;

	// Collect all stylesheets from the page
	const stylesheetUrls: string[] = [];
	const inlineStyles: string[] = [];

	document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
		const href = link.getAttribute('href');
		if (href) {
			stylesheetUrls.push(modalToAbsoluteUrl(href, url, origin));
		}
	});

	document.querySelectorAll('style').forEach((style) => {
		if (style.textContent?.trim()) {
			inlineStyles.push(style.textContent);
		}
	});

	// Capture adopted stylesheets
	try {
		const adopted = (document as unknown as { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets;
		if (adopted && adopted.length > 0) {
			for (const sheet of adopted) {
				try {
					const rules = Array.from(sheet.cssRules || []);
					if (rules.length > 0) {
						inlineStyles.push(rules.map((r) => r.cssText).join('\n'));
					}
				} catch { /* cross-origin */ }
			}
		}
	} catch { /* ignore */ }

	// Capture runtime styles from document.styleSheets
	try {
		for (const sheet of Array.from(document.styleSheets)) {
			try {
				if (sheet.href) continue;
				if (sheet.ownerNode && document.documentElement.contains(sheet.ownerNode)) continue;
				const rules = Array.from(sheet.cssRules || []);
				if (rules.length > 0) {
					inlineStyles.push(rules.map((r) => r.cssText).join('\n'));
				}
			} catch { /* cross-origin */ }
		}
	} catch { /* ignore */ }

	// Build stylesheet links and inline style tags
	const stylesheetLinks = stylesheetUrls
		.map((href) => `<link rel="stylesheet" href="${modalEscapeAttr(href)}">`)
		.join('\n    ');

	const inlineStyleTags = inlineStyles
		.map((css) => `<style>${css}</style>`)
		.join('\n    ');

	// Build body content with absolute URLs
	let bodyContent = '';
	if (backdropClone) {
		bodyContent += backdropClone.outerHTML + '\n';
	}
	bodyContent += modalClone.outerHTML;

	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = bodyContent;

	tempDiv.querySelectorAll('img[src]').forEach((img) => {
		const src = img.getAttribute('src');
		if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
			img.setAttribute('src', modalToAbsoluteUrl(src, url, origin));
		}
	});

	tempDiv.querySelectorAll('a[href]').forEach((a) => {
		const href = a.getAttribute('href');
		if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('data:')) {
			a.setAttribute('href', modalToAbsoluteUrl(href, url, origin));
		}
	});

	tempDiv.querySelectorAll('[srcset]').forEach((el) => {
		const srcset = el.getAttribute('srcset');
		if (!srcset) return;
		const entries = srcset.split(',').map((entry) => {
			const parts = entry.trim().split(/\s+/);
			const entryUrl = parts[0];
			if (entryUrl && !entryUrl.startsWith('data:') && !entryUrl.startsWith('blob:')) {
				parts[0] = modalToAbsoluteUrl(entryUrl, url, origin);
			}
			return parts.join(' ');
		});
		el.setAttribute('srcset', entries.join(', '));
	});

	bodyContent = tempDiv.innerHTML;

	const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${modalEscapeHtml(title)}</title>
    ${stylesheetLinks}
    ${inlineStyleTags}
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    </style>
</head>
<body>
${bodyContent}
</body>
</html>`;

	return { html, title, url };
}

function modalToAbsoluteUrl(href: string, base: string, origin: string): string {
	try {
		if (href.startsWith('http') || href.startsWith('//')) return href.startsWith('//') ? `https:${href}` : href;
		if (href.startsWith('/')) return `${origin}${href}`;
		return new URL(href, base).href;
	} catch {
		return href;
	}
}

function modalEscapeAttr(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function modalEscapeHtml(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
