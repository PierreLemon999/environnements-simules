/**
 * Capture Quality Diagnostic Tool
 *
 * Tests the capture pipeline on real websites by:
 * 1. Opening a URL in Playwright
 * 2. Running collectPageData() in the page context (same logic as the extension)
 * 3. Fetching resources from Node.js (simulating the service worker)
 * 4. Building the self-contained HTML
 * 5. Opening the result and taking screenshots of both
 * 6. Reporting what was captured vs what failed
 *
 * Usage:
 *   cd tests && npx tsx capture-quality.ts [url]
 *   cd tests && npx tsx capture-quality.ts  (runs all test sites)
 */

import { chromium, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TEST_SITES = [
	{ name: 'github', url: 'https://github.com/features' },
	{ name: 'notion', url: 'https://www.notion.com/' },
	{ name: 'linear', url: 'https://linear.app/features' },
	{ name: 'stripe-docs', url: 'https://docs.stripe.com/' },
	{ name: 'figma', url: 'https://www.figma.com/' },
	{ name: 'airtable', url: 'https://airtable.com/' },
	{ name: 'monday', url: 'https://monday.com/' },
	{ name: 'intercom', url: 'https://www.intercom.com/' },
	{ name: 'gitlab', url: 'https://gitlab.com/explore' },
	{ name: 'hubspot-login', url: 'https://app.hubspot.com/login' },
];

const OUTPUT_DIR = path.join(import.meta.dirname || __dirname, 'capture-results');
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESOURCE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_FETCHES = 500;

// ---------------------------------------------------------------------------
// collectPageData — extracted from extension (runs in browser context)
// ---------------------------------------------------------------------------

function collectPageData(): {
	html: string;
	title: string;
	url: string;
	resources: { stylesheetUrls: string[]; imageUrls: string[]; faviconUrls: string[] };
	stats: { scriptCount: number; styleLinkCount: number; inlineStyleCount: number; imgCount: number; iframeCount: number };
} {
	try {
		const title = document.title || 'Untitled Page';
		const url = window.location.href;
		const origin = window.location.origin;

		const docClone = document.documentElement.cloneNode(true) as HTMLElement;

		// Stats
		const scriptCount = docClone.querySelectorAll('script').length;

		// Remove scripts & noscript
		docClone.querySelectorAll('script').forEach((s) => s.remove());
		docClone.querySelectorAll('noscript').forEach((s) => s.remove());

		// 1. Stylesheet URLs
		const stylesheetUrls: string[] = [];
		docClone.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
			const href = link.getAttribute('href');
			if (href) {
				stylesheetUrls.push(toAbsolute(href, url, origin));
			}
			link.remove();
		});

		// Also capture adopted stylesheets and CSSStyleSheet objects not from <link>
		const inlineStyleSheets: string[] = [];
		try {
			for (const sheet of Array.from(document.styleSheets)) {
				if (!sheet.href) {
					// This is an inline <style> tag or constructed stylesheet
					try {
						const rules = Array.from(sheet.cssRules || []);
						if (rules.length > 0) {
							inlineStyleSheets.push(rules.map((r) => r.cssText).join('\n'));
						}
					} catch {
						// Cross-origin stylesheet
					}
				}
			}
		} catch { /* ignore */ }

		// Count inline <style> tags remaining in clone
		const inlineStyleCount = docClone.querySelectorAll('style').length + inlineStyleSheets.length;

		// If we found constructed/adopted stylesheets not in the DOM, inject them
		if (inlineStyleSheets.length > 0) {
			const head = docClone.querySelector('head');
			for (const css of inlineStyleSheets) {
				const styleEl = document.createElement('style');
				styleEl.setAttribute('data-captured-inline', 'true');
				styleEl.textContent = css;
				if (head) head.appendChild(styleEl);
				else docClone.insertBefore(styleEl, docClone.firstChild);
			}
		}

		// Also capture document.adoptedStyleSheets
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
					} catch { /* ignore */ }
				}
			}
		} catch { /* ignore */ }

		// 2. Image URLs
		const imageUrls: string[] = [];
		const seenImages = new Set<string>();

		const imgCount = docClone.querySelectorAll('img[src]').length;
		docClone.querySelectorAll('img[src]').forEach((img) => {
			const src = img.getAttribute('src');
			if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
				const abs = toAbsolute(src, url, origin);
				if (!seenImages.has(abs)) {
					seenImages.add(abs);
					imageUrls.push(abs);
				}
				img.setAttribute('src', abs);
			}
		});

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
						if (rawUrl && !rawUrl.startsWith('data:') && !rawUrl.startsWith('blob:') && !rawUrl.startsWith('#')) {
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

		// Iframes
		const iframeCount = docClone.querySelectorAll('iframe').length;
		docClone.querySelectorAll('iframe').forEach((iframe) => {
			try {
				const src = iframe.getAttribute('src') || '';
				const liveIframe = document.querySelector(`iframe[src="${src}"]`) as HTMLIFrameElement | null;
				if (!liveIframe) return;
				try {
					const iframeDoc = liveIframe.contentDocument;
					if (iframeDoc) {
						iframe.setAttribute('srcdoc', iframeDoc.documentElement.outerHTML);
						iframe.removeAttribute('src');
					}
				} catch {
					if (src && !src.startsWith('http') && !src.startsWith('//')) {
						iframe.setAttribute('src', toAbsolute(src, url, origin));
					}
				}
			} catch { /* skip */ }
		});

		// Force-reveal elements hidden by JS animations
		docClone.querySelectorAll('[style]').forEach((el) => {
			let style = el.getAttribute('style') || '';
			if (/opacity\s*:\s*0(\s|;|$)/.test(style)) {
				style = style.replace(/opacity\s*:\s*0(\s|;|$)/g, 'opacity:1$1');
			}
			if (/visibility\s*:\s*hidden/.test(style)) {
				style = style.replace(/visibility\s*:\s*hidden/g, 'visibility:visible');
			}
			if (/transform\s*:\s*translate[^;]*(-\d{3,}|100)/.test(style)) {
				style = style.replace(/transform\s*:[^;]+;?/g, '');
			}
			el.setAttribute('style', style);
		});

		// data-src lazy loading fallback
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

		// Make anchor hrefs absolute
		docClone.querySelectorAll('a[href]').forEach((a) => {
			const href = a.getAttribute('href');
			if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('data:')) {
				a.setAttribute('href', toAbsolute(href, url, origin));
			}
		});

		// Remove <base> tags
		docClone.querySelectorAll('base').forEach((b) => b.remove());

		const doctype = '<!DOCTYPE html>';
		const html = `${doctype}\n<html${copyAttributes(document.documentElement)}>${docClone.innerHTML}</html>`;

		return {
			html,
			title,
			url,
			resources: { stylesheetUrls, imageUrls, faviconUrls },
			stats: { scriptCount, styleLinkCount: stylesheetUrls.length, inlineStyleCount, imgCount, iframeCount }
		};
	} catch (err) {
		return {
			html: `<!DOCTYPE html><html><body><p>Capture error: ${err instanceof Error ? err.message : String(err)}</p></body></html>`,
			title: document.title || 'Capture Error',
			url: window.location.href,
			resources: { stylesheetUrls: [], imageUrls: [], faviconUrls: [] },
			stats: { scriptCount: 0, styleLinkCount: 0, inlineStyleCount: 0, imgCount: 0, iframeCount: 0 }
		};
	}

	function toAbsolute(href: string, base: string, origin: string): string {
		try {
			if (href.startsWith('http') || href.startsWith('//')) return href.startsWith('//') ? `https:${href}` : href;
			if (href.startsWith('/')) return `${origin}${href}`;
			return new URL(href, base).href;
		} catch { return href; }
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
// Resource fetching (Node.js — simulates extension service worker)
// ---------------------------------------------------------------------------

const SKIP_URL_PREFIXES = ['data:', 'blob:', 'javascript:', 'about:', '#', 'mailto:', 'tel:'];

function shouldSkipUrl(url: string): boolean {
	if (!url || !url.trim()) return true;
	const trimmed = url.trim();
	if (SKIP_URL_PREFIXES.some((p) => trimmed.startsWith(p))) return true;
	if (trimmed.startsWith('%23')) return true;
	return false;
}

function resolveUrl(relative: string, base: string): string {
	try {
		const trimmed = relative.trim();
		if (trimmed.startsWith('//')) return `https:${trimmed}`;
		return new URL(trimmed, base).href;
	} catch { return relative; }
}

const EXT_MIME: Record<string, string> = {
	png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
	svg: 'image/svg+xml', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
	woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
	css: 'text/css',
};

function getMimeType(url: string, ct?: string | null): string {
	if (ct && !ct.includes('octet-stream') && !ct.includes('text/plain')) return ct.split(';')[0].trim();
	try {
		const ext = new URL(url).pathname.split('.').pop()?.toLowerCase() || '';
		if (EXT_MIME[ext]) return EXT_MIME[ext];
	} catch { /* */ }
	return ct?.split(';')[0].trim() || 'application/octet-stream';
}

class ResourceFetcher {
	private cache = new Map<string, string>();
	private fetchCount = 0;
	private stats = { cssOk: 0, cssFail: 0, imgOk: 0, imgFail: 0, fontOk: 0, fontFail: 0, other: 0 };
	private failures: string[] = [];

	async fetchAsDataUri(url: string): Promise<string> {
		if (shouldSkipUrl(url)) return url;
		if (this.cache.has(url)) return this.cache.get(url)!;
		if (this.fetchCount >= MAX_TOTAL_FETCHES) return '';
		this.fetchCount++;

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
			const response = await fetch(url, { signal: controller.signal });
			clearTimeout(timeout);

			if (!response.ok) {
				this.failures.push(`${response.status} ${url}`);
				return '';
			}

			const buffer = await response.arrayBuffer();
			if (buffer.byteLength > MAX_RESOURCE_SIZE) {
				this.failures.push(`TOO_LARGE (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB) ${url}`);
				return '';
			}

			const mime = getMimeType(url, response.headers.get('content-type'));
			const base64 = Buffer.from(buffer).toString('base64');
			const dataUri = `data:${mime};base64,${base64}`;
			this.cache.set(url, dataUri);

			// Track stats
			if (mime.startsWith('image')) this.stats.imgOk++;
			else if (mime.includes('font')) this.stats.fontOk++;
			else if (mime.includes('css')) this.stats.cssOk++;
			else this.stats.other++;

			return dataUri;
		} catch (err) {
			this.failures.push(`FETCH_ERROR ${err instanceof Error ? err.message : 'unknown'} ${url}`);
			if (url.includes('font')) this.stats.fontFail++;
			else if (url.includes('css')) this.stats.cssFail++;
			else this.stats.imgFail++;
			return '';
		}
	}

	async fetchAndResolveStylesheet(url: string, depth = 0, visited = new Set<string>()): Promise<string> {
		if (depth > 15 || visited.has(url)) return '';
		visited.add(url);
		if (this.fetchCount >= MAX_TOTAL_FETCHES) return '';
		this.fetchCount++;

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
			const response = await fetch(url, { signal: controller.signal });
			clearTimeout(timeout);

			if (!response.ok) {
				this.failures.push(`CSS ${response.status} ${url}`);
				this.stats.cssFail++;
				return '';
			}

			let css = await response.text();
			this.stats.cssOk++;

			// Resolve @import
			const importRegex = /@import\s+(?:url\(\s*(['"]?)([^'")\s]+)\1\s*\)|(['"])([^'"]+)\3)\s*[^;]*;/g;
			let m;
			const imports: Array<{ match: string; url: string }> = [];
			while ((m = importRegex.exec(css)) !== null) {
				imports.push({ match: m[0], url: m[2] || m[4] });
			}
			for (const imp of imports) {
				const importUrl = resolveUrl(imp.url, url);
				const importedCss = await this.fetchAndResolveStylesheet(importUrl, depth + 1, visited);
				css = css.replace(imp.match, importedCss);
			}

			// Resolve url() references
			const urlRegex = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g;
			const refs: Array<{ match: string; url: string }> = [];
			while ((m = urlRegex.exec(css)) !== null) {
				if (!shouldSkipUrl(m[2])) refs.push({ match: m[0], url: m[2] });
			}
			for (const ref of refs) {
				const resolvedUrl = resolveUrl(ref.url, url);
				const dataUri = await this.fetchAsDataUri(resolvedUrl);
				css = css.split(ref.match).join(dataUri ? `url("${dataUri}")` : `url("")`);
			}

			return css;
		} catch (err) {
			this.failures.push(`CSS_FETCH_ERROR ${err instanceof Error ? err.message : ''} ${url}`);
			this.stats.cssFail++;
			return '';
		}
	}

	async buildSelfContainedPage(
		html: string,
		resources: { stylesheetUrls: string[]; imageUrls: string[]; faviconUrls: string[] },
		baseUrl: string
	): Promise<string> {
		// Decode &amp; in URL attributes (innerHTML encodes & as &amp;)
		let result = html
			.replace(
				/(src|href|srcset|poster|action)\s*=\s*"([^"]*?)"/gi,
				(_match, attr, value) => `${attr}="${value.replace(/&amp;/g, '&')}"`
			)
			.replace(
				/(src|href|srcset|poster|action)\s*=\s*'([^']*?)'/gi,
				(_match, attr, value) => `${attr}='${value.replace(/&amp;/g, '&')}'`
			);

		// 1. CSS
		const styleBlocks: string[] = [];
		for (const sheetUrl of resources.stylesheetUrls) {
			const resolved = resolveUrl(sheetUrl, baseUrl);
			const css = await this.fetchAndResolveStylesheet(resolved);
			if (css.trim()) {
				styleBlocks.push(`<style data-source="${escapeHtml(resolved)}">\n${css}\n</style>`);
			}
		}
		if (styleBlocks.length > 0) {
			const insert = styleBlocks.join('\n');
			if (result.includes('</head>')) {
				result = result.replace('</head>', `${insert}\n</head>`);
			} else {
				result = insert + '\n' + result;
			}
		}

		// 2. Images
		const imgUrls = new Set<string>();
		for (const imgUrl of resources.imageUrls) {
			if (!shouldSkipUrl(imgUrl)) imgUrls.add(resolveUrl(imgUrl, baseUrl));
		}
		// Also from HTML (use decoded result, not original html)
		const imgSrcRegex = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
		let m;
		while ((m = imgSrcRegex.exec(result)) !== null) {
			if (!shouldSkipUrl(m[1])) imgUrls.add(resolveUrl(m[1], baseUrl));
		}

		// Batch fetch images
		const urlArray = Array.from(imgUrls);
		const dataUris = new Map<string, string>();
		const BATCH = 10;
		for (let i = 0; i < urlArray.length; i += BATCH) {
			const batch = urlArray.slice(i, i + BATCH);
			const results = await Promise.all(batch.map(async (u) => ({ url: u, dataUri: await this.fetchAsDataUri(u) })));
			for (const { url, dataUri } of results) dataUris.set(url, dataUri);
		}

		for (const [absUrl, dataUri] of dataUris) {
			const replacement = dataUri || '';
			result = result.split(`src="${absUrl}"`).join(`src="${replacement}"`);
			result = result.split(`src='${absUrl}'`).join(`src='${replacement}'`);
		}

		// 3. Favicons
		for (const favUrl of resources.faviconUrls) {
			if (shouldSkipUrl(favUrl)) continue;
			const resolved = resolveUrl(favUrl, baseUrl);
			const dataUri = await this.fetchAsDataUri(resolved);
			result = result.split(`href="${favUrl}"`).join(`href="${dataUri || ''}"`);
		}

		return result;
	}

	getReport() {
		return {
			totalFetches: this.fetchCount,
			cacheHits: this.cache.size,
			stats: this.stats,
			failures: this.failures,
		};
	}
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function testCapture(page: Page, site: { name: string; url: string }) {
	console.log(`\n${'='.repeat(60)}`);
	console.log(`Testing: ${site.name} (${site.url})`);
	console.log('='.repeat(60));

	const siteDir = path.join(OUTPUT_DIR, site.name);
	fs.mkdirSync(siteDir, { recursive: true });

	// Navigate and wait for load
	try {
		await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30_000 });
	} catch {
		console.log('  ⚠ Timeout on networkidle, continuing...');
	}

	// Wait a bit for dynamic content
	await page.waitForTimeout(2000);

	// Screenshot original
	await page.screenshot({ path: path.join(siteDir, 'original.png'), fullPage: false });
	console.log('  ✓ Original screenshot saved');

	// Run collectPageData in browser context
	const collected = await page.evaluate(collectPageData);
	console.log(`  ✓ DOM collected: ${collected.title}`);
	console.log(`    Stats: ${JSON.stringify(collected.stats)}`);
	console.log(`    Resources: ${collected.resources.stylesheetUrls.length} CSS, ${collected.resources.imageUrls.length} images, ${collected.resources.faviconUrls.length} favicons`);

	// Save raw HTML (before resource inlining)
	fs.writeFileSync(path.join(siteDir, 'raw.html'), collected.html, 'utf-8');
	console.log(`    Raw HTML: ${(collected.html.length / 1024).toFixed(0)} KB`);

	// Fetch resources and build self-contained HTML
	const fetcher = new ResourceFetcher();
	console.log('  ⏳ Fetching resources...');
	const selfContained = await fetcher.buildSelfContainedPage(
		collected.html,
		collected.resources,
		collected.url
	);

	// Save self-contained HTML
	fs.writeFileSync(path.join(siteDir, 'captured.html'), selfContained, 'utf-8');
	console.log(`  ✓ Self-contained HTML: ${(selfContained.length / 1024).toFixed(0)} KB`);

	// Report
	const report = fetcher.getReport();
	console.log(`  📊 Fetch report:`);
	console.log(`     Total fetches: ${report.totalFetches}`);
	console.log(`     CSS: ${report.stats.cssOk} ok, ${report.stats.cssFail} failed`);
	console.log(`     Images: ${report.stats.imgOk} ok, ${report.stats.imgFail} failed`);
	console.log(`     Fonts: ${report.stats.fontOk} ok, ${report.stats.fontFail} failed`);
	if (report.failures.length > 0) {
		console.log(`  ❌ Failures (${report.failures.length}):`);
		for (const f of report.failures.slice(0, 15)) {
			console.log(`     ${f.substring(0, 120)}`);
		}
		if (report.failures.length > 15) {
			console.log(`     ... and ${report.failures.length - 15} more`);
		}
	}

	// Open captured HTML and screenshot
	const capturedPage = await page.context().newPage();
	await capturedPage.setContent(selfContained, { waitUntil: 'load', timeout: 15_000 }).catch(() => {});
	await capturedPage.waitForTimeout(1000);
	await capturedPage.screenshot({ path: path.join(siteDir, 'captured.png'), fullPage: false });
	await capturedPage.close();
	console.log('  ✓ Captured screenshot saved');

	// Save report
	fs.writeFileSync(path.join(siteDir, 'report.json'), JSON.stringify({
		site,
		stats: collected.stats,
		resources: {
			stylesheetUrls: collected.resources.stylesheetUrls,
			imageCount: collected.resources.imageUrls.length,
			faviconCount: collected.resources.faviconUrls.length,
		},
		fetchReport: report,
		sizes: {
			rawHtml: collected.html.length,
			selfContainedHtml: selfContained.length,
		}
	}, null, 2), 'utf-8');

	console.log(`  ✓ Report saved to ${siteDir}/`);
	console.log(`  📁 Compare: open ${siteDir}/original.png vs ${siteDir}/captured.png`);
}

async function main() {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });

	const targetUrl = process.argv[2];
	const sites = targetUrl
		? [{ name: targetUrl.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-'), url: targetUrl }]
		: TEST_SITES;

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	});
	const page = await context.newPage();

	for (const site of sites) {
		try {
			await testCapture(page, site);
		} catch (err) {
			console.error(`  ❌ Error testing ${site.name}:`, err instanceof Error ? err.message : err);
		}
	}

	await browser.close();
	console.log(`\n✅ Done. Results in ${OUTPUT_DIR}/`);
}

main().catch(console.error);
