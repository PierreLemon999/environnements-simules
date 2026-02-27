import { PAGE_STATUS, STORAGE_KEYS, type CapturedPage, type CaptureState } from './constants';
import api, { uploadPage } from './api';
import { v4 as uuidv4 } from './uuid';
import type { ResourceManifest } from './resource-fetcher';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollectedPageData {
	html: string;
	title: string;
	url: string;
	resources: ResourceManifest;
}

// ---------------------------------------------------------------------------
// Phase 1: Collect page data (DOM clone + resource manifest)
// ---------------------------------------------------------------------------

/**
 * Collect the current page's DOM and resource URLs.
 * The DOM is cloned and cleaned (scripts removed, base href added).
 * Resource URLs are collected for the service worker to fetch separately.
 */
export async function captureCurrentPage(tabId: number): Promise<CollectedPageData> {
	const LOG = '[LL Capture]';
	let results;
	try {
		results = await chrome.scripting.executeScript({
			target: { tabId },
			func: collectPageData
		});
	} catch (err) {
		const msg = `chrome.scripting.executeScript failed: ${err instanceof Error ? err.message : String(err)}`;
		console.error(`${LOG} ${msg}`);
		throw new Error(msg);
	}

	if (!results || results.length === 0) {
		console.error(`${LOG} executeScript returned no results`);
		throw new Error('executeScript returned no results');
	}

	const frame = results[0];
	if ('error' in frame && frame.error) {
		console.error(`${LOG} Capture script error:`, frame.error);
		throw new Error(`Capture script error: ${JSON.stringify(frame.error)}`);
	}

	if (!frame.result) {
		console.error(`${LOG} Capture returned empty result (function may have thrown)`);
		throw new Error('Capture returned empty result (function may have thrown)');
	}

	const data = frame.result as CollectedPageData;
	console.log(`${LOG} collectPageData OK — HTML: ${(data.html.length / 1024).toFixed(0)}KB`);
	return data;
}

/**
 * Runs in the page context (injected via chrome.scripting.executeScript).
 * Clones the DOM, removes scripts, collects all resource URLs, and returns
 * the raw HTML + resource manifest for the service worker to process.
 */
function collectPageData(): {
	html: string;
	title: string;
	url: string;
	resources: { stylesheetUrls: string[]; imageUrls: string[]; faviconUrls: string[] };
} {
	try {
		const title = document.title || 'Untitled Page';
		const url = window.location.href;
		const origin = window.location.origin;

		// -------------------------------------------------------------------
		// Pre-clone: capture live DOM state that cloneNode doesn't preserve
		// -------------------------------------------------------------------

		// Canvas → data URL (must happen on live DOM before cloning)
		const canvasDataMap = new Map<HTMLCanvasElement, string>();
		document.querySelectorAll('canvas').forEach((canvas) => {
			try {
				if (canvas.width > 0 && canvas.height > 0) {
					canvasDataMap.set(canvas, canvas.toDataURL('image/png'));
				}
			} catch { /* tainted canvas (cross-origin content) */ }
		});

		// Form state: read values from live DOM
		const inputValues = new Map<number, { value: string; checked?: boolean; type: string }>();
		document.querySelectorAll('input').forEach((input, idx) => {
			inputValues.set(idx, {
				value: input.value,
				checked: input.checked,
				type: input.type
			});
		});

		const textareaValues = new Map<number, string>();
		document.querySelectorAll('textarea').forEach((textarea, idx) => {
			textareaValues.set(idx, textarea.value);
		});

		const selectValues = new Map<number, number>();
		document.querySelectorAll('select').forEach((select, idx) => {
			selectValues.set(idx, select.selectedIndex);
		});

		// Runtime styles: capture <style> tags injected by JS (CSS-in-JS)
		// These are already in the DOM, but also capture from document.styleSheets
		// for sheets that might not have a corresponding DOM element
		const runtimeStyleTexts: string[] = [];
		try {
			for (const sheet of Array.from(document.styleSheets)) {
				try {
					// Skip external stylesheets (they'll be fetched by resource-fetcher)
					if (sheet.href) continue;
					// Skip sheets that have a corresponding DOM element
					// (they'll be captured naturally via cloneNode)
					if (sheet.ownerNode && document.documentElement.contains(sheet.ownerNode)) continue;
					// This is an orphan stylesheet — capture its rules
					const rules = Array.from(sheet.cssRules || []);
					if (rules.length > 0) {
						runtimeStyleTexts.push(rules.map((r) => r.cssText).join('\n'));
					}
				} catch { /* cross-origin stylesheet access denied */ }
			}
		} catch { /* ignore */ }

		// -------------------------------------------------------------------
		// Clone the document
		// -------------------------------------------------------------------

		const docClone = document.documentElement.cloneNode(true) as HTMLElement;

		// Remove scripts (they shouldn't execute in the demo)
		docClone.querySelectorAll('script').forEach((s) => s.remove());

		// Remove noscript tags (they contain fallback content not needed)
		docClone.querySelectorAll('noscript').forEach((s) => s.remove());

		// -------------------------------------------------------------------
		// Apply pre-clone state to the clone
		// -------------------------------------------------------------------

		// Canvas → replace with <img> in the clone
		const cloneCanvases = docClone.querySelectorAll('canvas');
		const liveCanvases = document.querySelectorAll('canvas');
		cloneCanvases.forEach((cloneCanvas, idx) => {
			const liveCanvas = liveCanvases[idx];
			if (liveCanvas && canvasDataMap.has(liveCanvas)) {
				const img = document.createElement('img');
				img.src = canvasDataMap.get(liveCanvas)!;
				img.setAttribute('width', String(liveCanvas.width));
				img.setAttribute('height', String(liveCanvas.height));
				img.style.cssText = cloneCanvas.style.cssText;
				// Copy class and id
				if (cloneCanvas.className) img.className = cloneCanvas.className;
				if (cloneCanvas.id) img.id = cloneCanvas.id;
				cloneCanvas.replaceWith(img);
			}
		});

		// Form state → apply to clone
		docClone.querySelectorAll('input').forEach((input, idx) => {
			const state = inputValues.get(idx);
			if (!state) return;
			if (state.type === 'checkbox' || state.type === 'radio') {
				if (state.checked) {
					input.setAttribute('checked', 'checked');
				} else {
					input.removeAttribute('checked');
				}
			} else if (state.type !== 'file') {
				input.setAttribute('value', state.value);
			}
		});

		docClone.querySelectorAll('textarea').forEach((textarea, idx) => {
			const value = textareaValues.get(idx);
			if (value !== undefined) {
				textarea.textContent = value;
			}
		});

		docClone.querySelectorAll('select').forEach((select, idx) => {
			const selectedIdx = selectValues.get(idx);
			if (selectedIdx !== undefined && selectedIdx >= 0) {
				select.querySelectorAll('option').forEach((opt, optIdx) => {
					if (optIdx === selectedIdx) {
						opt.setAttribute('selected', 'selected');
					} else {
						opt.removeAttribute('selected');
					}
				});
			}
		});

		// -------------------------------------------------------------------
		// Shadow DOM: serialize shadow root contents inline
		// -------------------------------------------------------------------

		function serializeShadowRoots(root: Element): void {
			// Process the element itself
			const shadowRoot = (root as HTMLElement).shadowRoot;
			if (shadowRoot) {
				// Create a container for shadow DOM content
				const shadowContainer = document.createElement('div');
				shadowContainer.setAttribute('data-shadow-root', 'true');
				shadowContainer.style.cssText = 'display:contents';

				// Capture adopted stylesheets from shadow root
				try {
					const shadowAdopted = (shadowRoot as unknown as { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets;
					if (shadowAdopted && shadowAdopted.length > 0) {
						for (const sheet of shadowAdopted) {
							try {
								const rules = Array.from(sheet.cssRules || []);
								if (rules.length > 0) {
									const styleEl = document.createElement('style');
									styleEl.setAttribute('data-shadow-adopted', 'true');
									styleEl.textContent = rules.map((r) => r.cssText).join('\n');
									shadowContainer.appendChild(styleEl);
								}
							} catch { /* cross-origin */ }
						}
					}
				} catch { /* ignore */ }

				// Copy shadow DOM <style> tags
				shadowRoot.querySelectorAll('style').forEach((style) => {
					const clonedStyle = style.cloneNode(true) as HTMLStyleElement;
					shadowContainer.appendChild(clonedStyle);
				});

				// Copy shadow DOM content (non-style elements)
				for (const child of Array.from(shadowRoot.children)) {
					if (child.tagName !== 'STYLE') {
						shadowContainer.appendChild(child.cloneNode(true));
					}
				}

				// Append shadow content after the host element's existing children
				root.appendChild(shadowContainer);
			}

			// Recurse into children
			for (const child of Array.from(root.children)) {
				serializeShadowRoots(child);
			}
		}

		try {
			serializeShadowRoots(docClone);
		} catch { /* ignore shadow DOM errors */ }

		// -------------------------------------------------------------------
		// Collect resource URLs
		// -------------------------------------------------------------------

		// 1. Stylesheet URLs
		const stylesheetUrls: string[] = [];
		docClone.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
			const href = link.getAttribute('href');
			if (href) {
				const abs = toAbsolute(href, url, origin);
				stylesheetUrls.push(abs);
			}
			// Remove the <link> tag — it will be replaced by inlined <style>
			link.remove();
		});

		// 2. Image URLs (img src, img srcset, source srcset, video poster)
		const imageUrls: string[] = [];
		const seenImages = new Set<string>();

		docClone.querySelectorAll('img[src]').forEach((img) => {
			const src = img.getAttribute('src');
			if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
				const abs = toAbsolute(src, url, origin);
				if (!seenImages.has(abs)) {
					seenImages.add(abs);
					imageUrls.push(abs);
				}
				// Normalize src to absolute in the DOM so the service worker can match it
				img.setAttribute('src', abs);
			}
		});

		// srcset on img and source elements
		docClone.querySelectorAll('[srcset]').forEach((el) => {
			const srcset = el.getAttribute('srcset');
			if (!srcset) return;
			const entries = srcset.split(',').map((entry) => {
				const parts = entry.trim().split(/\s+/);
				const entryUrl = parts[0];
				if (entryUrl && !entryUrl.startsWith('data:') && !entryUrl.startsWith('blob:')) {
					const abs = toAbsolute(entryUrl, url, origin);
					if (!seenImages.has(abs)) {
						seenImages.add(abs);
						imageUrls.push(abs);
					}
					parts[0] = abs;
				}
				return parts.join(' ');
			});
			el.setAttribute('srcset', entries.join(', '));
		});

		// video poster
		docClone.querySelectorAll('video[poster]').forEach((video) => {
			const poster = video.getAttribute('poster');
			if (poster && !poster.startsWith('data:')) {
				const abs = toAbsolute(poster, url, origin);
				if (!seenImages.has(abs)) {
					seenImages.add(abs);
					imageUrls.push(abs);
				}
				video.setAttribute('poster', abs);
			}
		});

		// CSS background images in inline styles
		docClone.querySelectorAll('[style]').forEach((el) => {
			const style = el.getAttribute('style') || '';
			const bgMatch = style.match(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g);
			if (bgMatch) {
				for (const m of bgMatch) {
					const urlMatch = m.match(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/);
					if (urlMatch) {
						const rawUrl = urlMatch[2];
						if (rawUrl && !rawUrl.startsWith('data:') && !rawUrl.startsWith('blob:')) {
							const abs = toAbsolute(rawUrl, url, origin);
							if (!seenImages.has(abs)) {
								seenImages.add(abs);
								imageUrls.push(abs);
							}
						}
					}
				}
			}
		});

		// 3. Favicon URLs
		const faviconUrls: string[] = [];
		docClone.querySelectorAll('link[rel*="icon"]').forEach((link) => {
			const href = link.getAttribute('href');
			if (href && !href.startsWith('data:')) {
				const abs = toAbsolute(href, url, origin);
				faviconUrls.push(abs);
				link.setAttribute('href', abs);
			}
		});

		// Inline same-origin iframes via srcdoc
		docClone.querySelectorAll('iframe').forEach((iframe) => {
			try {
				const src = iframe.getAttribute('src') || '';
				const liveIframe = document.querySelector(
					`iframe[src="${src}"]`
				) as HTMLIFrameElement | null;
				if (!liveIframe) return;
				try {
					const iframeDoc = liveIframe.contentDocument;
					if (iframeDoc) {
						iframe.setAttribute('srcdoc', iframeDoc.documentElement.outerHTML);
						iframe.removeAttribute('src');
					}
				} catch {
					// Cross-origin iframe — convert to absolute URL
					if (src && !src.startsWith('http') && !src.startsWith('//')) {
						iframe.setAttribute('src', toAbsolute(src, url, origin));
					}
				}
			} catch {
				// Skip problematic iframes
			}
		});

		// Make all remaining href/src attributes absolute
		// (for elements not already processed: <a>, <link>, <source>, etc.)
		docClone.querySelectorAll('a[href]').forEach((a) => {
			const href = a.getAttribute('href');
			if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('data:')) {
				a.setAttribute('href', toAbsolute(href, url, origin));
			}
		});

		// Capture adopted stylesheets (CSS-in-JS, constructed stylesheets)
		try {
			const adopted = (document as unknown as { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets;
			if (adopted && adopted.length > 0) {
				const head = docClone.querySelector('head');
				for (const sheet of adopted) {
					try {
						const rules = Array.from(sheet.cssRules || []);
						if (rules.length > 0) {
							const styleEl = document.createElement('style');
							styleEl.setAttribute('data-adopted-stylesheet', 'true');
							styleEl.textContent = rules.map((r) => r.cssText).join('\n');
							if (head) head.appendChild(styleEl);
							else docClone.insertBefore(styleEl, docClone.firstChild);
						}
					} catch { /* cross-origin stylesheet */ }
				}
			}
		} catch { /* ignore */ }

		// Inject orphan runtime stylesheets (not linked to any DOM node)
		if (runtimeStyleTexts.length > 0) {
			const head = docClone.querySelector('head');
			for (const cssText of runtimeStyleTexts) {
				const styleEl = document.createElement('style');
				styleEl.setAttribute('data-runtime-stylesheet', 'true');
				styleEl.textContent = cssText;
				if (head) head.appendChild(styleEl);
				else docClone.insertBefore(styleEl, docClone.firstChild);
			}
		}

		// Force-reveal elements hidden by JS animations (IntersectionObserver, scroll-triggered)
		// Only override opacity on elements where JS set it to a low value via inline style
		docClone.querySelectorAll('[style]').forEach((el) => {
			const style = el.getAttribute('style') || '';
			if (/opacity\s*:\s*0(\s|;|$)/.test(style)) {
				el.setAttribute('style', style.replace(/opacity\s*:\s*0(\s|;|$)/g, 'opacity:1$1'));
			}
		});

		// Also reveal elements hidden with visibility: hidden or transform translate off-screen
		docClone.querySelectorAll('[style]').forEach((el) => {
			const style = el.getAttribute('style') || '';
			// Reveal visibility:hidden that was likely set by JS animations
			if (/visibility\s*:\s*hidden/.test(style)) {
				el.setAttribute('style', style.replace(/visibility\s*:\s*hidden/g, 'visibility:visible'));
			}
			// Reveal elements translated off-screen by animation libraries
			if (/transform\s*:\s*translate[^;]*(-\d{3,}|100)/.test(style)) {
				el.setAttribute('style', style.replace(/transform\s*:[^;]+;?/g, ''));
			}
		});

		// Remove data-src / data-srcset attributes that lazy loaders leave behind
		// (the real src should already be set by the hooks script)
		docClone.querySelectorAll('img[data-src]').forEach((img) => {
			const dataSrc = img.getAttribute('data-src');
			const currentSrc = img.getAttribute('src');
			if (dataSrc && (!currentSrc || currentSrc === '' || currentSrc.includes('placeholder') || currentSrc.includes('blank'))) {
				const abs = toAbsolute(dataSrc, url, origin);
				img.setAttribute('src', abs);
				if (!seenImages.has(abs)) {
					seenImages.add(abs);
					imageUrls.push(abs);
				}
			}
		});

		// Inject global style to disable CSS animations and force-reveal animated elements
		// Many sites use CSS classes with opacity:0/transform for scroll animations
		const revealStyle = document.createElement('style');
		revealStyle.setAttribute('data-capture-reveal', 'true');
		revealStyle.textContent = [
			'*, *::before, *::after {',
			'  animation-play-state: paused !important;',
			'  animation-delay: -1ms !important;',
			'  animation-duration: 1ms !important;',
			'  transition-duration: 0s !important;',
			'  transition-delay: 0s !important;',
			'}',
		].join('\n');
		const head = docClone.querySelector('head');
		if (head) head.appendChild(revealStyle);
		else docClone.insertBefore(revealStyle, docClone.firstChild);

		// Remove any existing <base> tags — all URLs are now absolute,
		// and <base> would break link rewriting in the demo player.
		docClone.querySelectorAll('base').forEach((b) => b.remove());

		// Build final HTML
		const doctype = '<!DOCTYPE html>';
		const html = `${doctype}\n<html${copyAttributes(document.documentElement)}>${docClone.innerHTML}</html>`;

		return {
			html,
			title,
			url,
			resources: {
				stylesheetUrls,
				imageUrls,
				faviconUrls
			}
		};
	} catch (err) {
		return {
			html: `<!DOCTYPE html><html><body><p>Capture error: ${err instanceof Error ? err.message : String(err)}</p></body></html>`,
			title: document.title || 'Capture Error',
			url: window.location.href,
			resources: { stylesheetUrls: [], imageUrls: [], faviconUrls: [] }
		};
	}

	function toAbsolute(href: string, base: string, origin: string): string {
		try {
			if (href.startsWith('http') || href.startsWith('//')) return href.startsWith('//') ? `https:${href}` : href;
			if (href.startsWith('/')) return `${origin}${href}`;
			return new URL(href, base).href;
		} catch {
			return href;
		}
	}

	function copyAttributes(el: Element): string {
		let attrs = '';
		for (const attr of Array.from(el.attributes)) {
			attrs += ` ${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`;
		}
		return attrs;
	}
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a captured page to the backend.
 */
export async function uploadCapturedPage(
	versionId: string,
	page: { html: string; title: string; url: string },
	captureMode: string,
	screenshotBlob?: Blob | null
): Promise<{ id: string; fileSize: number }> {
	const LOG = '[LL Capture]';
	const blob = new Blob([page.html], { type: 'text/html' });

	// Derive URL path from the full URL (strip leading/trailing slashes, no query string)
	const urlObj = new URL(page.url);
	const urlPath = urlObj.pathname.replace(/^\/+|\/+$/g, '') || 'index';

	const parts = ['HTML'];
	if (screenshotBlob) parts.push(`Screenshot(${(screenshotBlob.size / 1024).toFixed(0)}KB)`);
	console.log(`${LOG} Uploading: ${parts.join(' + ')} → /versions/${versionId}/pages`);

	try {
		const response = await uploadPage(versionId, blob, {
			urlSource: page.url,
			urlPath,
			title: page.title,
			captureMode
		}, screenshotBlob);
		return response.data;
	} catch (err) {
		console.error(`${LOG} Upload failed:`, err instanceof Error ? err.message : err);
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Modal capture
// ---------------------------------------------------------------------------

/**
 * Capture a modal element as a self-contained page via the content script.
 * Sends CAPTURE_MODAL to the content script which extracts the modal subtree.
 */
export async function captureModalAsPage(
	tabId: number,
	modalSelector: string
): Promise<CollectedPageData> {
	const LOG = '[LL Modal Capture]';
	console.log(`${LOG} Capturing modal: ${modalSelector}`);

	let response;
	try {
		response = await chrome.tabs.sendMessage(tabId, {
			type: 'CAPTURE_MODAL',
			modalSelector,
		});
	} catch (err) {
		const msg = `Content script CAPTURE_MODAL failed: ${err instanceof Error ? err.message : String(err)}`;
		console.error(`${LOG} ${msg}`);
		throw new Error(msg);
	}

	if (response?.error) {
		console.error(`${LOG} Modal capture error:`, response.error);
		throw new Error(response.error);
	}

	if (!response?.html) {
		throw new Error('Modal capture returned empty result');
	}

	console.log(`${LOG} Modal captured: "${response.title}" (${(response.html.length / 1024).toFixed(0)}KB)`);

	return {
		html: response.html,
		title: response.title,
		url: response.url,
		resources: { stylesheetUrls: [], imageUrls: [], faviconUrls: [] },
	};
}

// ---------------------------------------------------------------------------
// Capture state management — per-version isolation
// ---------------------------------------------------------------------------

const DEFAULT_CAPTURE_STATE: CaptureState = {
	mode: 'free',
	isRunning: false,
	isPaused: false,
	pages: [],
	targetPageCount: 0
};

/** Get the active version ID from storage. */
async function getActiveVersionId(): Promise<string | null> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
	return result[STORAGE_KEYS.ACTIVE_VERSION]?.id || null;
}

/** Version-scoped storage key for capture state. */
function captureStateKey(versionId: string): string {
	return `${STORAGE_KEYS.CAPTURE_STATE}:${versionId}`;
}

/**
 * Get or initialize the capture state for the active version.
 */
export async function getCaptureState(): Promise<CaptureState> {
	const versionId = await getActiveVersionId();
	if (!versionId) return { ...DEFAULT_CAPTURE_STATE };

	const key = captureStateKey(versionId);
	const result = await chrome.storage.local.get(key);
	return result[key] || { ...DEFAULT_CAPTURE_STATE };
}

/**
 * Update capture state in storage and notify popup.
 * Writes to the active version's scoped key.
 */
export async function updateCaptureState(
	state: Partial<CaptureState>
): Promise<CaptureState> {
	const versionId = await getActiveVersionId();
	if (!versionId) return { ...DEFAULT_CAPTURE_STATE };

	const key = captureStateKey(versionId);
	const currentResult = await chrome.storage.local.get(key);
	const current = currentResult[key] || { ...DEFAULT_CAPTURE_STATE };
	const updated = { ...current, ...state };
	await chrome.storage.local.set({ [key]: updated });

	// Notify popup of state change
	try {
		await chrome.runtime.sendMessage({
			type: 'CAPTURE_STATE_UPDATED',
			state: updated
		});
	} catch {
		// Popup might not be open
	}

	return updated;
}

/**
 * Add a page to the capture state.
 */
export async function addCapturedPageToState(page: CapturedPage): Promise<void> {
	const state = await getCaptureState();
	state.pages.push(page);
	await updateCaptureState({ pages: state.pages });
}

/**
 * Update a page's status in capture state.
 */
export async function updatePageStatus(
	localId: string,
	status: CapturedPage['status'],
	extra?: Partial<CapturedPage>
): Promise<void> {
	const state = await getCaptureState();
	const page = state.pages.find((p) => p.localId === localId);
	if (page) {
		page.status = status;
		if (extra) {
			Object.assign(page, extra);
		}
		await updateCaptureState({ pages: state.pages });
	}
}

/**
 * Remove a page from capture state.
 */
export async function removePageFromState(localId: string): Promise<void> {
	const state = await getCaptureState();
	state.pages = state.pages.filter((p) => p.localId !== localId);
	await updateCaptureState({ pages: state.pages });
}

export { uuidv4 };
