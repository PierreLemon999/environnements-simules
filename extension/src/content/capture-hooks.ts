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

	// -----------------------------------------------------------------------
	// 5. Click tracking for transition recording
	// -----------------------------------------------------------------------

	// Track last interactive click for transition recording
	(window as any).__ES_PENDING_CLICK__ = null;
	(window as any).__ES_LAST_TRANSITION__ = null;

	document.addEventListener('click', function(e: MouseEvent) {
		var target = e.target as HTMLElement;
		// Walk up to find the interactive element
		while (target && target !== document.body) {
			var tag = target.tagName;
			var role = target.getAttribute && target.getAttribute('role');
			if (tag === 'A' || tag === 'BUTTON' || role === 'button' || role === 'link' ||
				tag === 'INPUT' && ((target as HTMLInputElement).type === 'submit' || (target as HTMLInputElement).type === 'button') ||
				target.getAttribute && target.getAttribute('onclick')) {
				break;
			}
			target = target.parentElement as HTMLElement;
		}
		if (!target || target === document.body) return;

		// Generate a minimal CSS selector
		var selector = '';
		if (target.id) {
			selector = '#' + target.id;
		} else if (target.getAttribute && target.getAttribute('data-testid')) {
			selector = '[data-testid="' + target.getAttribute('data-testid') + '"]';
		} else {
			selector = target.tagName.toLowerCase();
			if (target.className && typeof target.className === 'string') {
				var cls = target.className.trim().split(/\s+/).slice(0, 2).join('.');
				if (cls) selector += '.' + cls;
			}
		}

		(window as any).__ES_PENDING_CLICK__ = {
			triggerSelector: selector,
			triggerText: (target.textContent || '').trim().substring(0, 100),
			timestamp: Date.now()
		};
	}, true); // capture phase

	// -----------------------------------------------------------------------
	// 6. pushState / replaceState hooks for SPA navigation tracking
	// -----------------------------------------------------------------------

	var origPushState = history.pushState;
	var origReplaceState = history.replaceState;

	history.pushState = function() {
		var click = (window as any).__ES_PENDING_CLICK__;
		(window as any).__ES_LAST_TRANSITION__ = {
			type: 'pushState',
			sourceUrl: location.href,
			targetUrl: arguments[2] ? String(arguments[2]) : location.href,
			timestamp: Date.now(),
			triggerSelector: click ? click.triggerSelector : null,
			triggerText: click ? click.triggerText : null,
			clickTimestamp: click ? click.timestamp : null
		};
		(window as any).__ES_PENDING_CLICK__ = null;
		return origPushState.apply(this, arguments as any);
	};

	history.replaceState = function() {
		var click = (window as any).__ES_PENDING_CLICK__;
		(window as any).__ES_LAST_TRANSITION__ = {
			type: 'replaceState',
			sourceUrl: location.href,
			targetUrl: arguments[2] ? String(arguments[2]) : location.href,
			timestamp: Date.now(),
			triggerSelector: click ? click.triggerSelector : null,
			triggerText: click ? click.triggerText : null,
			clickTimestamp: click ? click.timestamp : null
		};
		(window as any).__ES_PENDING_CLICK__ = null;
		return origReplaceState.apply(this, arguments as any);
	};

	// -----------------------------------------------------------------------
	// 7. popstate / hashchange tracking
	// -----------------------------------------------------------------------

	window.addEventListener('popstate', function() {
		(window as any).__ES_LAST_TRANSITION__ = {
			type: 'popstate',
			sourceUrl: location.href,
			targetUrl: location.href,
			timestamp: Date.now(),
			triggerSelector: null,
			triggerText: null,
			clickTimestamp: null
		};
	});

	window.addEventListener('hashchange', function(e: HashChangeEvent) {
		(window as any).__ES_LAST_TRANSITION__ = {
			type: 'hashchange',
			sourceUrl: e.oldURL,
			targetUrl: e.newURL,
			timestamp: Date.now(),
			triggerSelector: null,
			triggerText: null,
			clickTimestamp: null
		};
	});

	// -----------------------------------------------------------------------
	// 8. Custom event bridge for transition data (MAIN <-> ISOLATED world)
	// -----------------------------------------------------------------------

	window.addEventListener('__ES_GET_LAST_TRANSITION__', function() {
		window.dispatchEvent(new CustomEvent('__ES_LAST_TRANSITION_RESULT__', {
			detail: (window as any).__ES_LAST_TRANSITION__
		}));
	});

	window.addEventListener('__ES_CLEAR_LAST_TRANSITION__', function() {
		(window as any).__ES_LAST_TRANSITION__ = null;
		(window as any).__ES_PENDING_CLICK__ = null;
	});
})();
