/**
 * Modal detection heuristics — runs in page context via content script.
 * Detects visible modals/overlays in the current DOM.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedModal {
	selector: string;
	detectionMethod: 'role_dialog' | 'aria_modal' | 'z_index' | 'position_fixed' | 'css_class';
	title: string;
	triggerSelector?: string;
	triggerText?: string;
}

// ---------------------------------------------------------------------------
// Visibility check
// ---------------------------------------------------------------------------

function isElementVisible(el: Element): boolean {
	const style = window.getComputedStyle(el);
	if (style.display === 'none') return false;
	if (style.visibility === 'hidden') return false;
	if (parseFloat(style.opacity) === 0) return false;

	const rect = el.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) return false;

	return true;
}

// ---------------------------------------------------------------------------
// Selector generation
// ---------------------------------------------------------------------------

/**
 * Generate the shortest unique CSS selector for an element.
 * Priority: id > data attributes > nth-child path.
 */
function generateSelector(el: Element): string {
	// 1. Use id if available and unique
	if (el.id) {
		const escaped = CSS.escape(el.id);
		if (document.querySelectorAll(`#${escaped}`).length === 1) {
			return `#${escaped}`;
		}
	}

	// 2. Use data attributes
	for (const attr of Array.from(el.attributes)) {
		if (attr.name.startsWith('data-') && attr.value) {
			const selector = `${el.tagName.toLowerCase()}[${attr.name}="${CSS.escape(attr.value)}"]`;
			try {
				if (document.querySelectorAll(selector).length === 1) {
					return selector;
				}
			} catch { /* invalid selector */ }
		}
	}

	// 3. Use role + aria attributes
	const role = el.getAttribute('role');
	if (role) {
		const ariaLabel = el.getAttribute('aria-label');
		if (ariaLabel) {
			const selector = `[role="${role}"][aria-label="${CSS.escape(ariaLabel)}"]`;
			try {
				if (document.querySelectorAll(selector).length === 1) {
					return selector;
				}
			} catch { /* invalid selector */ }
		}
	}

	// 4. Build nth-child path (shortest possible)
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
			const siblings = Array.from(parent.children).filter(
				(c) => c.tagName === current!.tagName
			);
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

		// Try the partial selector — stop if it's already unique
		const partial = parts.join(' > ');
		try {
			if (document.querySelectorAll(partial).length === 1) {
				return partial;
			}
		} catch { /* keep building */ }
	}

	return parts.join(' > ');
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable title from a modal element.
 * Checks: aria-label, aria-labelledby, first heading, first text content.
 */
function extractTitle(el: Element): string {
	// 1. aria-label
	const ariaLabel = el.getAttribute('aria-label');
	if (ariaLabel?.trim()) {
		return ariaLabel.trim().substring(0, 100);
	}

	// 2. aria-labelledby
	const labelledBy = el.getAttribute('aria-labelledby');
	if (labelledBy) {
		const labelEl = document.getElementById(labelledBy);
		if (labelEl?.textContent?.trim()) {
			return labelEl.textContent.trim().substring(0, 100);
		}
	}

	// 3. First heading (h1, h2, h3)
	const heading = el.querySelector('h1, h2, h3');
	if (heading?.textContent?.trim()) {
		return heading.textContent.trim().substring(0, 100);
	}

	// 4. First meaningful text content
	const text = el.textContent?.trim() || '';
	if (text.length > 0) {
		return text.substring(0, 50) + (text.length > 50 ? '...' : '');
	}

	return 'Modal';
}

// ---------------------------------------------------------------------------
// Viewport coverage check
// ---------------------------------------------------------------------------

function getViewportCoverage(el: Element): number {
	const rect = el.getBoundingClientRect();
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const viewportArea = viewportWidth * viewportHeight;

	if (viewportArea === 0) return 0;

	const overlapWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
	const overlapHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
	const overlapArea = overlapWidth * overlapHeight;

	return overlapArea / viewportArea;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Check if an element is already included (or is a child of an already-detected modal).
 */
function isAlreadyDetected(el: Element, detected: Element[]): boolean {
	for (const existing of detected) {
		if (existing === el || existing.contains(el) || el.contains(existing)) {
			return true;
		}
	}
	return false;
}

// ---------------------------------------------------------------------------
// Main detection function
// ---------------------------------------------------------------------------

/**
 * Detect visible modals/overlays in the current DOM.
 * Returns an array of detected modals with their CSS selectors.
 */
export function detectVisibleModals(): DetectedModal[] {
	const results: DetectedModal[] = [];
	const detectedElements: Element[] = [];

	// 1. [role="dialog"] or [role="alertdialog"] that is visible
	const dialogRoleEls = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
	for (const el of Array.from(dialogRoleEls)) {
		if (!isElementVisible(el)) continue;
		if (isAlreadyDetected(el, detectedElements)) continue;

		detectedElements.push(el);
		results.push({
			selector: generateSelector(el),
			detectionMethod: 'role_dialog',
			title: extractTitle(el),
		});
	}

	// 2. [aria-modal="true"] that is visible
	const ariaModalEls = document.querySelectorAll('[aria-modal="true"]');
	for (const el of Array.from(ariaModalEls)) {
		if (!isElementVisible(el)) continue;
		if (isAlreadyDetected(el, detectedElements)) continue;

		detectedElements.push(el);
		results.push({
			selector: generateSelector(el),
			detectionMethod: 'aria_modal',
			title: extractTitle(el),
		});
	}

	// 3. Elements with position: fixed/absolute AND z-index >= 1000 AND >30% viewport coverage
	const allElements = document.querySelectorAll('*');
	for (const el of Array.from(allElements)) {
		if (isAlreadyDetected(el, detectedElements)) continue;

		const style = window.getComputedStyle(el);
		const position = style.position;
		if (position !== 'fixed' && position !== 'absolute') continue;

		const zIndex = parseInt(style.zIndex, 10);
		if (isNaN(zIndex) || zIndex < 1000) continue;

		if (!isElementVisible(el)) continue;
		if (getViewportCoverage(el) < 0.3) continue;

		// Skip likely backdrops/overlays (single div with no real content)
		const childCount = el.children.length;
		const textLength = (el.textContent?.trim() || '').length;
		if (childCount === 0 && textLength < 5) continue;

		detectedElements.push(el);
		results.push({
			selector: generateSelector(el),
			detectionMethod: 'z_index',
			title: extractTitle(el),
		});
	}

	// 4. Common CSS class patterns: .modal, .dialog, [class*="modal"], [class*="dialog"]
	const classPatternEls = document.querySelectorAll(
		'.modal, .dialog, .popup, .overlay-content, ' +
		'[class*="modal"]:not([class*="modal-backdrop"]):not([class*="modal-overlay"]), ' +
		'[class*="dialog"], [class*="Dialog"]'
	);
	for (const el of Array.from(classPatternEls)) {
		if (!isElementVisible(el)) continue;
		if (isAlreadyDetected(el, detectedElements)) continue;

		// Require some minimum size to avoid tiny elements
		const rect = el.getBoundingClientRect();
		if (rect.width < 100 || rect.height < 50) continue;

		// Require a z-index or position to be overlay-like
		const style = window.getComputedStyle(el);
		const position = style.position;
		const zIndex = parseInt(style.zIndex, 10);
		if (position !== 'fixed' && position !== 'absolute' && !(zIndex >= 1)) continue;

		detectedElements.push(el);
		results.push({
			selector: generateSelector(el),
			detectionMethod: 'css_class',
			title: extractTitle(el),
		});
	}

	return results;
}
