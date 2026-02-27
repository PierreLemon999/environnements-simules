/**
 * Resource Fetcher — runs in the service worker context.
 *
 * Fetches all external resources (CSS, images, fonts) using the extension's
 * host_permissions (no CORS restrictions) and inlines them into the HTML
 * as base64 data URIs, producing a self-contained HTML file.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResourceManifest {
	stylesheetUrls: string[];
	imageUrls: string[];
	faviconUrls: string[];
}

// ---------------------------------------------------------------------------
// Constants / Guards
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESOURCE_SIZE = 5 * 1024 * 1024; // 5 MB — beyond this, resource is dropped (not kept as URL)
const MAX_IMPORT_DEPTH = 15;
const MAX_TOTAL_FETCHES = 500;

const SKIP_URL_PREFIXES = ['data:', 'blob:', 'javascript:', 'about:', '#', 'mailto:', 'tel:'];

// ---------------------------------------------------------------------------
// Cache (per capture, lives only during one buildSelfContainedPage call)
// ---------------------------------------------------------------------------

let dataUriCache: Map<string, string>;
let fetchCount: number;

// ---------------------------------------------------------------------------
// MIME type helpers
// ---------------------------------------------------------------------------

const EXT_MIME_MAP: Record<string, string> = {
	// Images
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	webp: 'image/webp',
	avif: 'image/avif',
	ico: 'image/x-icon',
	bmp: 'image/bmp',
	// Fonts
	woff: 'font/woff',
	woff2: 'font/woff2',
	ttf: 'font/ttf',
	otf: 'font/otf',
	eot: 'application/vnd.ms-fontobject',
	// CSS
	css: 'text/css',
};

function getMimeType(url: string, contentType?: string | null): string {
	// Prefer Content-Type from response if it's specific
	if (contentType && !contentType.includes('octet-stream') && !contentType.includes('text/plain')) {
		return contentType.split(';')[0].trim();
	}
	// Fallback to extension
	try {
		const pathname = new URL(url).pathname;
		const ext = pathname.split('.').pop()?.toLowerCase() || '';
		if (EXT_MIME_MAP[ext]) return EXT_MIME_MAP[ext];
	} catch {
		// ignore
	}
	return contentType?.split(';')[0].trim() || 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// Core fetch helpers
// ---------------------------------------------------------------------------

function shouldSkipUrl(url: string): boolean {
	if (!url || !url.trim()) return true;
	const trimmed = url.trim();
	// Skip data:, blob:, #fragment, etc.
	if (SKIP_URL_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return true;
	// Skip URL-encoded hash fragments (e.g. %23grain — SVG filter refs in CSS)
	if (trimmed.startsWith('%23')) return true;
	return false;
}

function resolveUrl(relative: string, base: string): string {
	try {
		const trimmed = relative.trim();
		if (trimmed.startsWith('//')) {
			return `https:${trimmed}`;
		}
		return new URL(trimmed, base).href;
	} catch {
		return relative;
	}
}

async function fetchWithTimeout(url: string): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			credentials: 'omit',
		});
		return response;
	} finally {
		clearTimeout(timeout);
	}
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/** Sentinel value: resource could not be fetched — caller should drop the reference. */
const FETCH_FAILED = '';

/**
 * Fetch a resource and return it as a data URI.
 * Returns empty string if fetch fails or resource is too large — the caller
 * must drop the reference entirely (no outbound URL kept in the HTML).
 */
async function fetchAsDataUri(url: string): Promise<string> {
	if (shouldSkipUrl(url)) return url;

	// Check cache first
	if (dataUriCache.has(url)) return dataUriCache.get(url)!;

	// Guard: max total fetches
	if (fetchCount >= MAX_TOTAL_FETCHES) return FETCH_FAILED;
	fetchCount++;

	try {
		const response = await fetchWithTimeout(url);
		if (!response.ok) return FETCH_FAILED;

		// Check size via Content-Length header (if available)
		const contentLength = response.headers.get('content-length');
		if (contentLength && parseInt(contentLength, 10) > MAX_RESOURCE_SIZE) {
			return FETCH_FAILED;
		}

		const buffer = await response.arrayBuffer();
		if (buffer.byteLength > MAX_RESOURCE_SIZE) return FETCH_FAILED;

		const mime = getMimeType(url, response.headers.get('content-type'));
		const base64 = arrayBufferToBase64(buffer);
		const dataUri = `data:${mime};base64,${base64}`;

		dataUriCache.set(url, dataUri);
		return dataUri;
	} catch {
		// Network error, timeout, etc. — drop the reference
		return FETCH_FAILED;
	}
}

// ---------------------------------------------------------------------------
// CSS processing
// ---------------------------------------------------------------------------

/**
 * Extract all url() references from CSS text.
 * Returns array of { match, url } where match is the full url(...) string.
 */
function parseCssUrls(css: string): Array<{ match: string; url: string }> {
	const results: Array<{ match: string; url: string }> = [];
	// Match url(...) with optional quotes — careful not to match data: URIs
	const urlRegex = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g;
	let m;
	while ((m = urlRegex.exec(css)) !== null) {
		const rawUrl = m[2];
		if (!shouldSkipUrl(rawUrl)) {
			results.push({ match: m[0], url: rawUrl });
		}
	}
	return results;
}

/**
 * Extract @import directives from CSS text.
 * Handles both @import url("...") and @import "..." syntaxes.
 */
function parseCssImports(css: string): Array<{ match: string; url: string }> {
	const results: Array<{ match: string; url: string }> = [];
	// @import url("...") or @import url('...') or @import url(...)
	const importUrlRegex = /@import\s+url\(\s*(['"]?)([^'")\s]+)\1\s*\)\s*[^;]*;/g;
	let m;
	while ((m = importUrlRegex.exec(css)) !== null) {
		results.push({ match: m[0], url: m[2] });
	}
	// @import "..." or @import '...'
	const importStringRegex = /@import\s+(['"])([^'"]+)\1\s*[^;]*;/g;
	while ((m = importStringRegex.exec(css)) !== null) {
		results.push({ match: m[0], url: m[2] });
	}
	return results;
}

/**
 * Fetch a CSS stylesheet, recursively resolve @imports, and inline all url() resources.
 */
async function fetchAndResolveStylesheet(
	url: string,
	depth: number = 0,
	visited: Set<string> = new Set()
): Promise<string> {
	if (depth > MAX_IMPORT_DEPTH) return '';
	if (visited.has(url)) return '';
	visited.add(url);

	if (fetchCount >= MAX_TOTAL_FETCHES) return '';
	fetchCount++;

	try {
		const response = await fetchWithTimeout(url);
		if (!response.ok) return '';

		let css = await response.text();

		// 1. Resolve @import directives (recursive)
		const imports = parseCssImports(css);
		for (const imp of imports) {
			const importUrl = resolveUrl(imp.url, url);
			const importedCss = await fetchAndResolveStylesheet(importUrl, depth + 1, visited);
			css = css.replace(imp.match, importedCss);
		}

		// 2. Resolve url() references (fonts, images, etc.)
		const urls = parseCssUrls(css);
		for (const ref of urls) {
			const resolvedUrl = resolveUrl(ref.url, url);
			const dataUri = await fetchAsDataUri(resolvedUrl);
			if (dataUri) {
				// Successfully fetched — inline as data URI
				css = css.split(ref.match).join(`url("${dataUri}")`);
			} else {
				// Fetch failed — drop the reference entirely (no outbound URL)
				css = css.split(ref.match).join(`url("")`);
			}
		}

		return css;
	} catch {
		return '';
	}
}

// ---------------------------------------------------------------------------
// HTML processing
// ---------------------------------------------------------------------------

/**
 * Replace image src attributes in HTML with base64 data URIs.
 */
async function inlineHtmlImages(html: string, imageUrls: string[], baseUrl: string): Promise<string> {
	let result = html;

	// Build a map of URLs to fetch
	const urlsToFetch = new Set<string>();
	for (const imgUrl of imageUrls) {
		if (!shouldSkipUrl(imgUrl)) {
			urlsToFetch.add(resolveUrl(imgUrl, baseUrl));
		}
	}

	// Also find img src in the HTML directly (belt and suspenders)
	const imgSrcRegex = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
	let m;
	while ((m = imgSrcRegex.exec(html)) !== null) {
		const src = m[1];
		if (!shouldSkipUrl(src)) {
			urlsToFetch.add(resolveUrl(src, baseUrl));
		}
	}

	// Fetch all images in parallel (batched)
	const urlArray = Array.from(urlsToFetch);
	const BATCH_SIZE = 10;
	const dataUris = new Map<string, string>();

	for (let i = 0; i < urlArray.length; i += BATCH_SIZE) {
		const batch = urlArray.slice(i, i + BATCH_SIZE);
		const results = await Promise.all(
			batch.map(async (url) => {
				const dataUri = await fetchAsDataUri(url);
				return { url, dataUri };
			})
		);
		for (const { url, dataUri } of results) {
			// dataUri is empty string on failure, data URI on success
			dataUris.set(url, dataUri);
		}
	}

	// Replace in HTML: img src, source srcset, video poster
	for (const [absoluteUrl, dataUri] of dataUris) {
		if (dataUri) {
			// Success — replace with data URI
			result = result.split(`src="${absoluteUrl}"`).join(`src="${dataUri}"`);
			result = result.split(`src='${absoluteUrl}'`).join(`src='${dataUri}'`);
		} else {
			// Fetch failed — drop the src (no outbound URL)
			result = result.split(`src="${absoluteUrl}"`).join(`src=""`);
			result = result.split(`src='${absoluteUrl}'`).join(`src=''`);
		}

		// Also try to replace the original (non-resolved) form
		for (const imgUrl of imageUrls) {
			if (resolveUrl(imgUrl, baseUrl) === absoluteUrl) {
				if (dataUri) {
					result = result.split(`src="${imgUrl}"`).join(`src="${dataUri}"`);
					result = result.split(`src='${imgUrl}'`).join(`src='${dataUri}'`);
				} else {
					result = result.split(`src="${imgUrl}"`).join(`src=""`);
					result = result.split(`src='${imgUrl}'`).join(`src=''`);
				}
			}
		}
	}

	// Replace srcset entries — use smart splitting that handles commas inside URL query params
	result = result.replace(
		/srcset\s*=\s*["']([^"']+)["']/gi,
		(_fullMatch, srcsetValue: string) => {
			const entries = parseSrcset(srcsetValue).map(({ url: srcUrl, descriptor }) => {
				const resolved = resolveUrl(srcUrl, baseUrl);
				const dataUri = dataUris.get(resolved);
				if (dataUri) {
					return descriptor ? `${dataUri} ${descriptor}` : dataUri;
				}
				return descriptor ? `${srcUrl} ${descriptor}` : srcUrl;
			});
			return `srcset="${entries.join(', ')}"`;
		}
	);

	return result;
}

/**
 * Resolve url() references inside inline style attributes and existing <style> tags.
 */
async function resolveInlineUrls(html: string, baseUrl: string): Promise<string> {
	let result = html;

	// Collect all url() refs in style="" attributes and <style> tags
	const urlRegex = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g;
	const urlsToResolve = new Set<string>();
	let m;
	while ((m = urlRegex.exec(html)) !== null) {
		const rawUrl = m[2];
		if (!shouldSkipUrl(rawUrl)) {
			urlsToResolve.add(resolveUrl(rawUrl, baseUrl));
		}
	}

	// Fetch all
	for (const resolvedUrl of urlsToResolve) {
		const dataUri = await fetchAsDataUri(resolvedUrl);
		// Replace all url() pointing to this resource
		const replacement = dataUri ? `url("${dataUri}")` : `url("")`;
		result = result.replace(
			new RegExp(
				`url\\(\\s*(['"]?)${escapeRegex(resolvedUrl)}\\1\\s*\\)`,
				'g'
			),
			replacement
		);
	}

	// Also resolve relative url() refs that weren't caught above
	result = result.replace(
		/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g,
		(_match, _quote, rawUrl) => {
			if (shouldSkipUrl(rawUrl)) return _match;
			const resolved = resolveUrl(rawUrl, baseUrl);
			if (dataUriCache.has(resolved)) {
				const cached = dataUriCache.get(resolved)!;
				return cached ? `url("${cached}")` : `url("")`;
			}
			// Not in cache and not fetched — drop the reference
			return `url("")`;
		}
	);

	return result;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse srcset attribute correctly — handles commas inside URL query params.
 * Standard srcset entries are "URL descriptor" separated by commas, but URLs
 * with query params (e.g. ?rect=1,0,511&w=24) contain commas too.
 * We split on ", " followed by a descriptor pattern (Nw or Nx) or URL start.
 */
function parseSrcset(srcset: string): Array<{ url: string; descriptor: string }> {
	const results: Array<{ url: string; descriptor: string }> = [];
	// Split on commas that are followed by whitespace and then a URL or descriptor pattern
	// A srcset entry is: URL [descriptor]
	// Descriptors are like "2x", "300w", "1.5x"
	const regex = /\s*([^,\s][^\s]*(?:\s+\d+(?:\.\d+)?[wx])?)(?:\s*,\s*|$)/g;
	let m;
	while ((m = regex.exec(srcset)) !== null) {
		if (!m[1]) continue;
		const entry = m[1].trim();
		// Split into URL and descriptor — descriptor is the last token matching Nw or Nx
		const lastSpace = entry.lastIndexOf(' ');
		if (lastSpace > 0) {
			const possibleDesc = entry.substring(lastSpace + 1);
			if (/^\d+(?:\.\d+)?[wx]$/.test(possibleDesc)) {
				results.push({ url: entry.substring(0, lastSpace).trim(), descriptor: possibleDesc });
				continue;
			}
		}
		results.push({ url: entry, descriptor: '' });
	}
	return results;
}

/**
 * Replace favicon link href with data URIs.
 */
async function inlineFavicons(html: string, faviconUrls: string[], baseUrl: string): Promise<string> {
	let result = html;
	for (const favUrl of faviconUrls) {
		if (shouldSkipUrl(favUrl)) continue;
		const resolved = resolveUrl(favUrl, baseUrl);
		const dataUri = await fetchAsDataUri(resolved);
		const replacement = dataUri || '';
		result = result.split(`href="${favUrl}"`).join(`href="${replacement}"`);
		result = result.split(`href='${favUrl}'`).join(`href='${replacement}'`);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Build a self-contained HTML page by fetching and inlining all external resources.
 *
 * @param html - Raw HTML from DOM clone (no CSS inlined, no images converted)
 * @param resources - Manifest of resource URLs collected from the page
 * @param baseUrl - The original page URL (for resolving relative URLs)
 * @returns Self-contained HTML with all resources inlined as base64
 */
export async function buildSelfContainedPage(
	html: string,
	resources: ResourceManifest,
	baseUrl: string
): Promise<string> {
	const LOG = '[LL Resources]';
	// Reset per-capture state
	dataUriCache = new Map();
	fetchCount = 0;

	console.log(`${LOG} Building self-contained page from ${baseUrl}`);
	console.log(`${LOG} Input: ${(html.length / 1024).toFixed(0)}KB HTML, ${resources.stylesheetUrls.length} CSS, ${resources.imageUrls.length} images, ${resources.faviconUrls.length} favicons`);

	// Normalize HTML entities in URL attributes — innerHTML serializes & as &amp;
	// which breaks URLs with query params (e.g. Next.js _next/image?w=96&q=75)
	let result = html
		.replace(
			/(src|href|srcset|poster|action)\s*=\s*"([^"]*?)"/gi,
			(_match, attr, value) => `${attr}="${value.replace(/&amp;/g, '&')}"`
		)
		.replace(
			/(src|href|srcset|poster|action)\s*=\s*'([^']*?)'/gi,
			(_match, attr, value) => `${attr}='${value.replace(/&amp;/g, '&')}'`
		);

	// 1. Fetch and inline all CSS stylesheets
	const styleBlocks: string[] = [];
	let cssOk = 0, cssFail = 0;
	for (const sheetUrl of resources.stylesheetUrls) {
		const resolvedUrl = resolveUrl(sheetUrl, baseUrl);
		const css = await fetchAndResolveStylesheet(resolvedUrl);
		if (css.trim()) {
			styleBlocks.push(`<style data-source="${escapeHtml(resolvedUrl)}">\n${css}\n</style>`);
			cssOk++;
		} else {
			cssFail++;
		}
	}
	console.log(`${LOG} CSS: ${cssOk} inlined, ${cssFail} failed`);

	// Insert all fetched CSS into <head>
	if (styleBlocks.length > 0) {
		const styleInsert = styleBlocks.join('\n');
		if (result.includes('</head>')) {
			result = result.replace('</head>', `${styleInsert}\n</head>`);
		} else if (result.includes('<body')) {
			result = result.replace('<body', `${styleInsert}\n<body`);
		} else {
			// Prepend if no head/body structure
			result = styleInsert + '\n' + result;
		}
	}

	// 2. Inline images (img src, srcset, video poster)
	result = await inlineHtmlImages(result, resources.imageUrls, baseUrl);

	// 3. Inline favicons
	result = await inlineFavicons(result, resources.faviconUrls, baseUrl);

	// 4. Resolve any remaining url() references in inline styles and <style> tags
	result = await resolveInlineUrls(result, baseUrl);

	console.log(`${LOG} Done — Output: ${(result.length / 1024).toFixed(0)}KB, total fetches: ${fetchCount}, cache hits: ${dataUriCache.size}`);
	return result;
}

function escapeHtml(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
