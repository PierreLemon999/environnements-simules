import { PAGE_STATUS, STORAGE_KEYS, type CapturedPage, type CaptureState } from './constants';
import api, { uploadPage } from './api';
import { v4 as uuidv4 } from './uuid';

/**
 * Capture the current page DOM and inline all CSS/images into a single HTML file.
 * This runs in the content script context via message passing.
 */
export async function captureCurrentPage(tabId: number): Promise<{
	html: string;
	title: string;
	url: string;
}> {
	const results = await chrome.scripting.executeScript({
		target: { tabId },
		func: capturePageDOM
	});

	if (!results || results.length === 0 || !results[0].result) {
		throw new Error('Failed to capture page DOM');
	}

	return results[0].result as { html: string; title: string; url: string };
}

/**
 * This function runs in the context of the web page (injected via chrome.scripting).
 * It captures the full DOM, inlines CSS, and converts images to base64.
 */
function capturePageDOM(): { html: string; title: string; url: string } {
	const title = document.title || 'Untitled Page';
	const url = window.location.href;

	// Clone the document to avoid modifying the live page
	const docClone = document.documentElement.cloneNode(true) as HTMLElement;

	// Inline all computed styles from stylesheets
	inlineStyles(docClone);

	// Convert images to base64 data URIs
	inlineImages(docClone);

	// Inline same-origin iframes
	inlineIframes(docClone);

	// Remove scripts (they shouldn't execute in the demo)
	const scripts = docClone.querySelectorAll('script');
	scripts.forEach((s) => s.remove());

	// Remove link[rel=stylesheet] since styles are inlined
	const styleLinks = docClone.querySelectorAll('link[rel="stylesheet"]');
	styleLinks.forEach((l) => l.remove());

	// Build final HTML
	const doctype = '<!DOCTYPE html>';
	const html = `${doctype}\n<html${copyAttributes(document.documentElement)}>${docClone.innerHTML}</html>`;

	return { html, title, url };

	function copyAttributes(el: Element): string {
		let attrs = '';
		for (const attr of Array.from(el.attributes)) {
			attrs += ` ${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`;
		}
		return attrs;
	}

	function inlineStyles(root: HTMLElement): void {
		try {
			const allStyles: string[] = [];

			for (const sheet of Array.from(document.styleSheets)) {
				try {
					const rules = Array.from(sheet.cssRules || []);
					for (const rule of rules) {
						allStyles.push(rule.cssText);
					}
				} catch {
					// Cross-origin stylesheet — fetch the href and include raw
					if (sheet.href) {
						allStyles.push(`/* Cross-origin stylesheet: ${sheet.href} */`);
					}
				}
			}

			if (allStyles.length > 0) {
				const styleEl = document.createElement('style');
				styleEl.setAttribute('data-captured', 'true');
				styleEl.textContent = allStyles.join('\n');

				const head = root.querySelector('head');
				if (head) {
					head.appendChild(styleEl);
				} else {
					root.insertBefore(styleEl, root.firstChild);
				}
			}
		} catch {
			// Silently fail style inlining
		}
	}

	function inlineIframes(root: HTMLElement): void {
		const iframes = root.querySelectorAll('iframe');
		iframes.forEach((iframe) => {
			try {
				const src = iframe.getAttribute('src') || '';
				// Find the corresponding live iframe
				const liveIframe = document.querySelector(
					`iframe[src="${src}"]`
				) as HTMLIFrameElement | null;
				if (!liveIframe) return;

				// Only inline same-origin iframes
				try {
					const iframeDoc = liveIframe.contentDocument;
					if (iframeDoc) {
						const iframeHtml = iframeDoc.documentElement.outerHTML;
						iframe.setAttribute('srcdoc', iframeHtml);
						iframe.removeAttribute('src');
					}
				} catch {
					// Cross-origin iframe — convert relative src to absolute
					if (src.startsWith('/')) {
						iframe.setAttribute('src', `${window.location.origin}${src}`);
					} else if (src && !src.startsWith('http')) {
						iframe.setAttribute('src', new URL(src, window.location.href).href);
					}
				}
			} catch {
				// Skip problematic iframes
			}
		});
	}

	function inlineImages(root: HTMLElement): void {
		const images = root.querySelectorAll('img');
		images.forEach((img) => {
			try {
				const src = img.getAttribute('src');
				if (!src || src.startsWith('data:')) return;

				// Try to capture from canvas
				const originalImg = document.querySelector(`img[src="${src}"]`) as HTMLImageElement | null;
				if (originalImg && originalImg.complete && originalImg.naturalWidth > 0) {
					try {
						const canvas = document.createElement('canvas');
						canvas.width = originalImg.naturalWidth;
						canvas.height = originalImg.naturalHeight;
						const ctx = canvas.getContext('2d');
						if (ctx) {
							ctx.drawImage(originalImg, 0, 0);
							const dataUrl = canvas.toDataURL('image/png');
							img.setAttribute('src', dataUrl);
							img.removeAttribute('srcset');
						}
					} catch {
						// CORS — keep original src as absolute URL
						if (src.startsWith('/')) {
							img.setAttribute('src', `${window.location.origin}${src}`);
						} else if (!src.startsWith('http')) {
							img.setAttribute('src', new URL(src, window.location.href).href);
						}
					}
				}
			} catch {
				// Skip problematic images
			}
		});
	}
}

/**
 * Upload a captured page to the backend.
 */
export async function uploadCapturedPage(
	versionId: string,
	page: { html: string; title: string; url: string },
	captureMode: string
): Promise<{ id: string; fileSize: number }> {
	const blob = new Blob([page.html], { type: 'text/html' });

	// Derive URL path from the full URL
	const urlObj = new URL(page.url);
	const urlPath = urlObj.pathname + urlObj.search;

	const response = await uploadPage(versionId, blob, {
		urlSource: page.url,
		urlPath,
		title: page.title,
		captureMode
	});

	return response.data;
}

/**
 * Get or initialize the capture state from storage.
 */
export async function getCaptureState(): Promise<CaptureState> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.CAPTURE_STATE);
	return (
		result[STORAGE_KEYS.CAPTURE_STATE] || {
			mode: 'free',
			isRunning: false,
			isPaused: false,
			pages: [],
			targetPageCount: 0
		}
	);
}

/**
 * Update capture state in storage and notify popup.
 */
export async function updateCaptureState(
	state: Partial<CaptureState>
): Promise<CaptureState> {
	const current = await getCaptureState();
	const updated = { ...current, ...state };
	await chrome.storage.local.set({
		[STORAGE_KEYS.CAPTURE_STATE]: updated
	});

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
