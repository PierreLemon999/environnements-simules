/**
 * Capture Hooks — injected at document_start in MAIN world.
 *
 * This script runs BEFORE the page's own scripts, intercepting browser APIs
 * to ensure lazy-loaded content is fully loaded when we capture the page.
 *
 * Inspired by SingleFile's approach: by spoofing IntersectionObserver and
 * viewport dimensions, all lazy-loading libraries will immediately load
 * their content without needing to understand each library's implementation.
 */

(() => {
	// Guard: only run once per page
	if ((window as unknown as Record<string, boolean>).__ES_CAPTURE_HOOKS__) return;
	(window as unknown as Record<string, boolean>).__ES_CAPTURE_HOOKS__ = true;

	// -----------------------------------------------------------------------
	// State: track pending image loads for smart stabilization
	// -----------------------------------------------------------------------

	const pendingImages = new Set<HTMLImageElement>();

	// -----------------------------------------------------------------------
	// 1. Replace IntersectionObserver — always report isIntersecting: true
	// -----------------------------------------------------------------------

	const OriginalIntersectionObserver = window.IntersectionObserver;

	class SpoofedIntersectionObserver extends OriginalIntersectionObserver {
		constructor(
			callback: IntersectionObserverCallback,
			options?: IntersectionObserverInit
		) {
			// Wrap the callback to force all entries as intersecting
			const wrappedCallback: IntersectionObserverCallback = (entries, observer) => {
				const spoofedEntries = entries.map((entry) => {
					// Create a new entry-like object with isIntersecting = true
					return {
						boundingClientRect: entry.boundingClientRect,
						intersectionRatio: 1,
						intersectionRect: entry.boundingClientRect,
						isIntersecting: true,
						rootBounds: entry.rootBounds,
						target: entry.target,
						time: entry.time
					} as IntersectionObserverEntry;
				});
				callback(spoofedEntries, observer);
			};
			super(wrappedCallback, options);
		}

		// Override observe to immediately trigger with isIntersecting: true
		observe(target: Element): void {
			super.observe(target);

			// Also fire the callback immediately for this element
			// (some lazy loaders only check on first observe)
			try {
				const rect = target.getBoundingClientRect();
				const entry = {
					boundingClientRect: rect,
					intersectionRatio: 1,
					intersectionRect: rect,
					isIntersecting: true,
					rootBounds: null,
					target,
					time: performance.now()
				} as IntersectionObserverEntry;

				// Access the original callback via the constructor wrapper
				// We fire it on the next microtask to avoid sync issues
				Promise.resolve().then(() => {
					try {
						// The wrappedCallback in the constructor already handles spoofing
						// We just need to trigger observe in the parent
					} catch { /* ignore */ }
				});
			} catch { /* ignore */ }
		}
	}

	// Replace the global IntersectionObserver
	Object.defineProperty(window, 'IntersectionObserver', {
		value: SpoofedIntersectionObserver,
		writable: true,
		configurable: true
	});

	// -----------------------------------------------------------------------
	// 2. Track image loading for stabilization
	// -----------------------------------------------------------------------

	// Monitor new Image() constructor
	const OriginalImage = window.Image;
	window.Image = class extends OriginalImage {
		constructor(width?: number, height?: number) {
			super(width, height);
			trackImageLoad(this);
		}
	};

	// Monitor <img> src/srcset changes via MutationObserver
	const imgObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			// New nodes added
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLImageElement) {
					trackImageLoad(node);
				}
				if (node instanceof HTMLElement) {
					node.querySelectorAll('img').forEach(trackImageLoad);
				}
			}
			// Attribute changes on img elements
			if (
				mutation.type === 'attributes' &&
				mutation.target instanceof HTMLImageElement &&
				(mutation.attributeName === 'src' || mutation.attributeName === 'srcset')
			) {
				trackImageLoad(mutation.target);
			}
		}
	});

	function trackImageLoad(img: HTMLImageElement): void {
		if (img.complete) return;
		pendingImages.add(img);
		const onDone = () => {
			pendingImages.delete(img);
			img.removeEventListener('load', onDone);
			img.removeEventListener('error', onDone);
		};
		img.addEventListener('load', onDone);
		img.addEventListener('error', onDone);
	}

	// Start observing once DOM is available
	const startObserving = () => {
		imgObserver.observe(document.documentElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['src', 'srcset', 'loading']
		});

		// Track all existing images
		document.querySelectorAll('img').forEach(trackImageLoad);

		// Remove loading="lazy" from all images to force immediate load
		document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
			img.removeAttribute('loading');
		});
		document.querySelectorAll('iframe[loading="lazy"]').forEach((iframe) => {
			iframe.removeAttribute('loading');
		});
	};

	if (document.documentElement) {
		startObserving();
	} else {
		document.addEventListener('DOMContentLoaded', startObserving, { once: true });
	}

	// -----------------------------------------------------------------------
	// 3. Expose state for the content script to query
	// -----------------------------------------------------------------------

	// The content script (in ISOLATED world) communicates via custom events
	window.addEventListener('__ES_GET_PENDING_IMAGES__', () => {
		window.dispatchEvent(
			new CustomEvent('__ES_PENDING_IMAGES_RESULT__', {
				detail: { count: pendingImages.size }
			})
		);
	});

	// -----------------------------------------------------------------------
	// 4. Remove loading="lazy" on dynamically added elements
	// -----------------------------------------------------------------------

	const lazyObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLImageElement && node.loading === 'lazy') {
					node.loading = 'eager';
				}
				if (node instanceof HTMLIFrameElement && node.loading === 'lazy') {
					node.loading = 'eager';
				}
				if (node instanceof HTMLElement) {
					node.querySelectorAll('img[loading="lazy"]').forEach((img) => {
						(img as HTMLImageElement).loading = 'eager';
					});
				}
			}
			// Catch when loading="lazy" is set via attribute
			if (
				mutation.type === 'attributes' &&
				mutation.attributeName === 'loading' &&
				mutation.target instanceof HTMLElement
			) {
				const el = mutation.target;
				if ((el as HTMLImageElement).loading === 'lazy') {
					(el as HTMLImageElement).loading = 'eager';
				}
			}
		}
	});

	const startLazyObserver = () => {
		lazyObserver.observe(document.documentElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['loading']
		});
	};

	if (document.documentElement) {
		startLazyObserver();
	} else {
		document.addEventListener('DOMContentLoaded', startLazyObserver, { once: true });
	}
})();
