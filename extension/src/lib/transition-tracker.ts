/**
 * Transition Tracker — types and utilities for tracking SPA navigation
 * transitions and detecting loading indicators in the DOM.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransitionEvent {
	type: 'click' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange';
	triggerSelector?: string;
	triggerText?: string;
	sourceUrl: string;
	targetUrl?: string;
	timestamp: number;
}

export interface LoadingDetection {
	detected: boolean;
	type: 'spinner' | 'skeleton' | 'progress' | null;
	selector?: string;
	durationMs?: number;
}

// ---------------------------------------------------------------------------
// Loading indicator detection
// ---------------------------------------------------------------------------

/**
 * Scans the DOM for common loading indicators.
 * Checks for ARIA attributes, class names, and CSS animations.
 * Runs in page context (content script has DOM access).
 */
export function detectLoadingIndicator(): LoadingDetection {
	// 1. Check for ARIA progressbar
	const progressbar = document.querySelector('[role="progressbar"]');
	if (progressbar) {
		return {
			detected: true,
			type: 'progress',
			selector: buildSelector(progressbar),
		};
	}

	// 2. Check for aria-busy="true"
	const ariaBusy = document.querySelector('[aria-busy="true"]');
	if (ariaBusy) {
		return {
			detected: true,
			type: 'spinner',
			selector: buildSelector(ariaBusy),
		};
	}

	// 3. Check for classes containing spinner/loader/loading/skeleton
	const loadingPatterns = ['spinner', 'loader', 'loading', 'skeleton'];
	for (const pattern of loadingPatterns) {
		const match = document.querySelector(`[class*="${pattern}"]`);
		if (match && isVisible(match)) {
			const type = pattern === 'skeleton' ? 'skeleton' : 'spinner';
			return {
				detected: true,
				type,
				selector: buildSelector(match),
			};
		}
	}

	// 4. Check for animated elements inside overlay/fixed containers
	const allElements = document.querySelectorAll('*');
	for (const el of allElements) {
		const style = window.getComputedStyle(el);
		const isAnimated =
			style.animationName !== 'none' && style.animationName !== '';
		if (!isAnimated) continue;

		// Check if this element or an ancestor has fixed/absolute positioning (overlay)
		let parent: Element | null = el;
		while (parent && parent !== document.documentElement) {
			const parentStyle = window.getComputedStyle(parent);
			if (
				parentStyle.position === 'fixed' ||
				parentStyle.position === 'absolute'
			) {
				return {
					detected: true,
					type: 'spinner',
					selector: buildSelector(el),
				};
			}
			parent = parent.parentElement;
		}
	}

	return { detected: false, type: null };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a minimal CSS selector for an element.
 */
function buildSelector(el: Element): string {
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

/**
 * Check if an element is visible (not display:none, not zero-size).
 */
function isVisible(el: Element): boolean {
	const style = window.getComputedStyle(el);
	if (style.display === 'none' || style.visibility === 'hidden') return false;
	const rect = el.getBoundingClientRect();
	return rect.width > 0 || rect.height > 0;
}
