/**
 * DOM fingerprinting for URL-less SPA state identification.
 *
 * These functions run in page context (content script isolated world)
 * to identify SPA states that share the same URL.
 */

export interface DOMFingerprint {
	hash: string; // Short hex hash (8 chars)
	textSample: string; // First 200 chars of visible text
}

/**
 * djb2 hash — simple and fast string hashing.
 * seed = 5381, hash = ((hash << 5) + hash) + charCode
 */
function djb2(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash) + str.charCodeAt(i);
		hash = hash >>> 0; // Convert to unsigned 32-bit integer
	}
	return hash;
}

/**
 * Walk the DOM tree up to a max depth, collecting structural info.
 * For each element: tagName, id, first 3 CSS classes, role, aria-label.
 */
function walkDOM(element: Element, depth: number, maxDepth: number): string {
	if (depth > maxDepth) return '';

	const parts: string[] = [];

	// Collect structural info for this element
	const tag = element.tagName;
	const id = element.id ? `#${element.id}` : '';
	const classes = Array.from(element.classList)
		.slice(0, 3)
		.map((c) => `.${c}`)
		.join('');
	const role = element.getAttribute('role') || '';
	const ariaLabel = element.getAttribute('aria-label') || '';

	parts.push(`${tag}${id}${classes}${role ? `[${role}]` : ''}${ariaLabel ? `(${ariaLabel})` : ''}`);

	// Recurse into children
	const children = element.children;
	for (let i = 0; i < children.length; i++) {
		parts.push(walkDOM(children[i], depth + 1, maxDepth));
	}

	return parts.join('|');
}

/**
 * Slugify a string for use in a synthetic URL.
 * Lowercase, replace non-alphanumeric with '-', truncate to 30 chars.
 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 30)
		.replace(/-+$/, '');
}

/**
 * Compute a structural fingerprint of the current DOM.
 * Uses tag structure + key attributes at limited depth for performance.
 */
export function computeDOMFingerprint(): DOMFingerprint {
	// 1. Walk DOM tree (max depth 4), collect structural string
	const structuralString = walkDOM(document.body || document.documentElement, 0, 4);

	// 2. Get first 200 chars of visible text
	const textSample = (document.body?.innerText || '').slice(0, 200).trim();

	// 3. Hash structural string
	const structuralHash = djb2(structuralString);

	// 4. Hash text sample
	const textHash = djb2(textSample);

	// 5. Combine both hashes
	const combinedHash = djb2(`${structuralHash.toString(16)}:${textHash.toString(16)}`);

	// 6. Convert to hex, take first 8 characters
	const hash = combinedHash.toString(16).padStart(8, '0').slice(0, 8);

	return { hash, textSample };
}

/**
 * Generate a synthetic URL from a fingerprint.
 * Format: /{basePath}/__state/{shortHash}-{titleSlug}
 */
export function generateSyntheticUrl(fingerprint: DOMFingerprint, baseUrl: string): string {
	// Derive basePath from baseUrl's pathname
	let basePath = '';
	try {
		const url = new URL(baseUrl);
		basePath = url.pathname.replace(/^\/+|\/+$/g, '');
	} catch {
		// If URL parsing fails, use empty base path
	}

	// Get title from document.title or first h1
	const title = document.title || document.querySelector('h1')?.textContent || 'page';
	const slug = slugify(title) || 'page';

	// Build synthetic URL
	const prefix = basePath ? `${basePath}/` : '';
	return `${prefix}__state/${fingerprint.hash}-${slug}`;
}

/**
 * Compute both the DOM fingerprint and a synthetic URL for the current page state.
 * Combines computeDOMFingerprint() and generateSyntheticUrl() into a single call.
 */
export function computeStateIdentity(): { hash: string; syntheticUrl: string; textSample: string } {
	const fp = computeDOMFingerprint();
	const syntheticUrl = generateSyntheticUrl(fp, window.location.href);
	return { hash: fp.hash, syntheticUrl, textSample: fp.textSample };
}
