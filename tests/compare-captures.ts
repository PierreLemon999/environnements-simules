/**
 * Compare Chrome's "Save As" capture with our extension capture.
 * Takes screenshots of both and analyzes structural differences.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(import.meta.dirname || __dirname, 'capture-results', 'salesforce-compare');

async function main() {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
	});

	// 1. Screenshot Chrome's capture
	console.log('Opening Chrome capture...');
	const chromePage = await context.newPage();
	const chromeHtmlPath = '/Users/pierre/Downloads/Recently Viewed _ Leads _ Salesforce.html';
	await chromePage.goto(`file://${chromeHtmlPath}`, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
	await chromePage.waitForTimeout(2000);
	await chromePage.screenshot({ path: path.join(OUTPUT_DIR, 'chrome-capture.png'), fullPage: false });
	console.log('  ✓ Chrome capture screenshot saved');

	// Analyze Chrome's HTML structure
	const chromeAnalysis = await chromePage.evaluate(() => {
		return {
			styleTags: document.querySelectorAll('style').length,
			linkStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
			scripts: document.querySelectorAll('script').length,
			images: document.querySelectorAll('img').length,
			shadowHosts: document.querySelectorAll('[data-shadow-root]').length,
			lwcElements: document.querySelectorAll('[lwc-host-selector]').length,
			allLwcAttrs: document.querySelectorAll('[class*="lwc"]').length,
			iframes: document.querySelectorAll('iframe').length,
			dataSrcImages: document.querySelectorAll('img[data-src]').length,
			hasBaseTag: !!document.querySelector('base'),
			title: document.title,
			bodyClasses: document.body?.className || '',
			// Check for shadow DOM in document
			elementsWithShadow: (() => {
				let count = 0;
				document.querySelectorAll('*').forEach(el => {
					if ((el as HTMLElement).shadowRoot) count++;
				});
				return count;
			})(),
		};
	});
	console.log('  Chrome analysis:', JSON.stringify(chromeAnalysis, null, 2));
	await chromePage.close();

	// 2. Screenshot our extension capture (served directly by backend, bypassing SvelteKit wrapper)
	console.log('\nOpening our capture from backend (port 3001)...');
	const ourPage = await context.newPage();
	try {
		await ourPage.goto('http://localhost:3001/demo/testpierre/lightning/o/Lead/list', {
			waitUntil: 'load',
			timeout: 15000
		});
	} catch {
		console.log('  ⚠ Timeout on load, continuing...');
	}
	await ourPage.waitForTimeout(2000);
	await ourPage.screenshot({ path: path.join(OUTPUT_DIR, 'our-capture.png'), fullPage: false });
	console.log('  ✓ Our capture screenshot saved');

	// Analyze our HTML structure
	const ourAnalysis = await ourPage.evaluate(() => {
		return {
			styleTags: document.querySelectorAll('style').length,
			linkStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
			scripts: document.querySelectorAll('script').length,
			images: document.querySelectorAll('img').length,
			shadowHosts: document.querySelectorAll('[data-shadow-root]').length,
			lwcElements: document.querySelectorAll('[lwc-host-selector]').length,
			iframes: document.querySelectorAll('iframe').length,
			dataSrcImages: document.querySelectorAll('img[data-src]').length,
			hasBaseTag: !!document.querySelector('base'),
			title: document.title,
			bodyClasses: document.body?.className || '',
			// Count data: URI images vs external URL images
			dataUriImages: (() => {
				let count = 0;
				document.querySelectorAll('img[src]').forEach(img => {
					if (img.getAttribute('src')?.startsWith('data:')) count++;
				});
				return count;
			})(),
			emptyImages: (() => {
				let count = 0;
				document.querySelectorAll('img[src]').forEach(img => {
					const src = img.getAttribute('src');
					if (!src || src === '' || src === '""') count++;
				});
				return count;
			})(),
			elementsWithShadow: (() => {
				let count = 0;
				document.querySelectorAll('*').forEach(el => {
					if ((el as HTMLElement).shadowRoot) count++;
				});
				return count;
			})(),
			// Count inline styles with data: URIs
			inlineStyleDataUris: (() => {
				let count = 0;
				document.querySelectorAll('[style]').forEach(el => {
					if (el.getAttribute('style')?.includes('data:')) count++;
				});
				return count;
			})(),
			// Check for empty url() in styles
			emptyUrlRefs: (() => {
				let count = 0;
				document.querySelectorAll('style').forEach(style => {
					const matches = style.textContent?.match(/url\(""\)/g);
					if (matches) count += matches.length;
				});
				return count;
			})(),
			totalElements: document.querySelectorAll('*').length,
			htmlSize: document.documentElement.outerHTML.length,
		};
	});
	console.log('  Our analysis:', JSON.stringify(ourAnalysis, null, 2));

	// Check if our page returned a 404 or error
	const pageContent = await ourPage.content();
	if (pageContent.includes('Page non trouvée') || pageContent.includes('404') || pageContent.includes('not found')) {
		console.log('\n  ⚠ Our capture returned 404/error — the page may not be captured yet');
	}

	await ourPage.close();

	// Save comparison report
	const report = { chromeAnalysis, ourAnalysis };
	fs.writeFileSync(path.join(OUTPUT_DIR, 'comparison.json'), JSON.stringify(report, null, 2));

	await browser.close();
	console.log(`\n✅ Screenshots saved to ${OUTPUT_DIR}/`);
}

main().catch(console.error);
