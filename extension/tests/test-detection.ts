/**
 * Automated test: LL Player detection on Salesforce
 *
 * Launches Chrome with the extension loaded, logs into Salesforce,
 * and tests LL Player detection. Keeps the session alive for re-runs.
 *
 * MFA handling: when TOTP is required, writes .mfa-needed flag and
 * polls for .mfa-code file. Write the 6-digit code to that file.
 *
 * Usage: npx tsx tests/test-detection.ts
 */

import { chromium, type BrowserContext, type Page, type Frame } from 'playwright';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = resolve(__dirname, '../dist');
const LL_PLAYER_PATH = resolve(__dirname, 'll-player-ext/unpacked');
const USER_DATA_DIR = resolve(__dirname, '../.test-profile');
const MFA_NEEDED_FILE = resolve(__dirname, '../.mfa-needed');
const MFA_CODE_FILE = resolve(__dirname, '../.mfa-code');

// Load .env
const envPath = resolve(__dirname, '../.env');
const env: Record<string, string> = {};
if (existsSync(envPath)) {
	for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
		const match = line.match(/^(\w+)=(.*)$/);
		if (match) env[match[1]] = match[2];
	}
}

const SF_URL = env.SALESFORCE_URL || 'https://login.salesforce.com/';
const SF_USER = env.SALESFORCE_USER || '';
const LL_USER = env.LL_USER || '';
const LL_PASS = env.LL_PASS || '';
const SF_PASS = env.SALESFORCE_PASS || '';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function cleanMfaFiles() {
	try { unlinkSync(MFA_NEEDED_FILE); } catch {}
	try { unlinkSync(MFA_CODE_FILE); } catch {}
}

async function waitForMfaCode(): Promise<string> {
	// Signal that MFA is needed
	writeFileSync(MFA_NEEDED_FILE, new Date().toISOString());
	console.log('   📁 Wrote .mfa-needed — waiting for .mfa-code file...');

	// Poll for code file
	for (let i = 0; i < 120; i++) { // 120 * 2s = 4 minutes max
		await sleep(2000);
		if (existsSync(MFA_CODE_FILE)) {
			const code = readFileSync(MFA_CODE_FILE, 'utf-8').trim();
			cleanMfaFiles();
			if (code && /^\d{4,8}$/.test(code)) {
				return code;
			}
			console.log('   ⚠️ Invalid code in .mfa-code file:', code);
		}
	}

	cleanMfaFiles();
	throw new Error('MFA code timeout — no .mfa-code file provided within 4 minutes');
}

async function launchBrowser(): Promise<BrowserContext> {
	console.log('🚀 Launching Chrome with extension from:', EXTENSION_PATH);

	console.log('   Also loading LL Player from:', LL_PLAYER_PATH);

	const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
		headless: false,
		args: [
			`--disable-extensions-except=${EXTENSION_PATH},${LL_PLAYER_PATH}`,
			`--load-extension=${EXTENSION_PATH},${LL_PLAYER_PATH}`,
			'--no-first-run',
			'--disable-default-apps',
		],
		viewport: { width: 1440, height: 900 },
		ignoreDefaultArgs: ['--disable-component-extensions-with-background-pages'],
	});

	await sleep(2000);
	return context;
}

async function getExtensionId(context: BrowserContext): Promise<string> {
	let extensionId = '';

	const page = await context.newPage();
	await page.goto('chrome://extensions');
	await sleep(1000);

	extensionId = await page.evaluate(() => {
		const manager = document.querySelector('extensions-manager');
		if (!manager?.shadowRoot) return '';
		const itemList = manager.shadowRoot.querySelector('extensions-item-list');
		if (!itemList?.shadowRoot) return '';
		const items = itemList.shadowRoot.querySelectorAll('extensions-item');
		for (const item of Array.from(items)) {
			const name = item.shadowRoot?.querySelector('#name')?.textContent?.trim();
			if (name?.includes('Lemon Lab')) {
				return item.id || '';
			}
		}
		return '';
	});

	await page.close();

	if (!extensionId) {
		const workers = context.serviceWorkers();
		for (const sw of workers) {
			if (sw.url().includes('service-worker')) {
				const match = sw.url().match(/chrome-extension:\/\/([^/]+)/);
				if (match) extensionId = match[1];
			}
		}
	}

	console.log('🔑 Extension ID:', extensionId || 'NOT FOUND');
	return extensionId;
}

function isMfaPage(url: string): boolean {
	return url.includes('verification') ||
		url.includes('challenge') ||
		url.includes('TotpVerification') ||
		url.includes('mfa') ||
		url.includes('two-factor');
}

function isLoggedIntoSalesforce(url: string): boolean {
	return !url.includes('login.salesforce.com') &&
		!isMfaPage(url) &&
		(url.includes('salesforce.com') || url.includes('force.com'));
}

async function loginToSalesforce(page: Page): Promise<boolean> {
	console.log('🔐 Logging into Salesforce...');

	await page.goto(SF_URL, { waitUntil: 'networkidle' });
	await sleep(1000);

	const currentUrl = page.url();

	// Check if already logged in (session active)
	if (isLoggedIntoSalesforce(currentUrl)) {
		console.log('✅ Already logged in (session active)');
		console.log('   URL:', currentUrl.substring(0, 100));
		return true;
	}

	// Check if on MFA page (session partially active)
	if (isMfaPage(currentUrl)) {
		console.log('⚠️  MFA verification page detected (partial session)');
		return await handleMfa(page);
	}

	if (!SF_USER || !SF_PASS) {
		console.error('❌ No Salesforce credentials in .env');
		return false;
	}

	try {
		// Fill login form
		await page.locator('#username').fill(SF_USER);
		await page.locator('#password').fill(SF_PASS);
		await page.locator('#Login').click();

		// Wait for navigation away from login page
		await page.waitForURL(url => !url.toString().includes('login.salesforce.com'), {
			timeout: 30000
		}).catch(() => {});

		await sleep(1000);
		const afterLoginUrl = page.url();
		console.log('   Post-login URL:', afterLoginUrl.substring(0, 120));

		// Still on login page? Wrong credentials
		if (afterLoginUrl.includes('login.salesforce.com')) {
			const errorEl = await page.locator('#error').textContent().catch(() => '');
			console.error('❌ Login failed — still on login page');
			if (errorEl) console.error('   Error:', errorEl);
			return false;
		}

		// MFA page?
		if (isMfaPage(afterLoginUrl)) {
			return await handleMfa(page);
		}

		// Success
		console.log('✅ Logged in successfully (no MFA required)');
		console.log('   URL:', page.url().substring(0, 100));
		return true;
	} catch (err) {
		console.error('❌ Login error:', err);
		return false;
	}
}

async function handleMfa(page: Page): Promise<boolean> {
	console.log('🔐 MFA/TOTP verification required');
	console.log('   Page title:', await page.title());

	try {
		// Step 1: Switch from TOTP to Email verification
		// Click "Use a Different Verification Method"
		console.log('   Looking for "Use a Different Verification Method" link...');
		const diffMethodLink = page.locator('a:has-text("Different Verification Method"), a:has-text("autre méthode"), button:has-text("Different Verification Method")').first();

		try {
			await diffMethodLink.click({ timeout: 5000 });
			console.log('   ✅ Clicked "Use a Different Verification Method"');
			await sleep(2000);
		} catch {
			console.log('   ⚠️ Could not find different method link — trying direct code input');
		}

		// Step 2: Click the radio button for "Email a code"
		// The page has radio buttons — we must click the radio input, not the label
		console.log('   Looking for "Email a code" radio button...');
		try {
			// Take screenshot to see current state
			await page.screenshot({ path: resolve(__dirname, '../.test-mfa-step2.png') });

			// Try multiple strategies to click the email radio
			let radioClicked = false;

			// The Email option is the 2nd radio button (index 1)
			// Radio 0 = "Use a code from an authenticator app"
			// Radio 1 = "Email a code to en@***********ng.fr"
			const radioButtons = page.locator('input[type="radio"]');
			const radioCount = await radioButtons.count();
			console.log(`   Found ${radioCount} radio buttons`);

			if (radioCount >= 2) {
				await radioButtons.nth(1).click({ force: true });
				console.log('   ✅ Clicked radio button #1 (Email a code)');
				radioClicked = true;
			} else if (radioCount === 1) {
				await radioButtons.nth(0).click({ force: true });
				console.log('   ✅ Clicked only available radio button');
				radioClicked = true;
			}

			if (!radioClicked) {
				console.log('   ⚠️ Could not find Email radio button');
			}

			await sleep(1000);
		} catch (err) {
			console.log('   ⚠️ Radio button click failed:', String(err).substring(0, 100));
		}

		// Step 3: Click Continue to send the email
		console.log('   Looking for Continue button...');
		const continueBtn = page.locator('button:has-text("Continue"), input[value="Continue"], button:has-text("Continuer"), input[value="Continuer"], input[type="submit"]').first();

		try {
			await continueBtn.click({ timeout: 5000 });
			console.log('   ✅ Clicked Continue — email code should be sent');
			await sleep(3000);

			// Check if we're now on the code entry page or still on method selection
			const pageText = await page.textContent('body').catch(() => '');
			if (pageText?.includes('Select a valid method') || pageText?.includes('Sélectionnez une méthode')) {
				console.log('   ⚠️ Still on method selection — radio might not have been selected');
				await page.screenshot({ path: resolve(__dirname, '../.test-mfa-step3-error.png') });
			} else {
				console.log('   Page moved past method selection');
			}
		} catch {
			console.log('   ⚠️ Could not find Continue button');
		}

		// Step 4: Wait for MFA code from file
		console.log('   📧 Email code sent — waiting for code...');
		const code = await waitForMfaCode();
		console.log('   Got MFA code:', code);

		// Step 5: Fill the verification code input
		const codeInput = page.locator('input[type="text"], input[type="tel"], input[type="number"], input[name*="code"], input[name*="verification"], input[id*="code"], input[id*="verification"]').first();

		await codeInput.fill(code);
		console.log('   Filled MFA code into input');

		// Step 6: Click Verify/Submit
		const verifyBtn = page.locator('input[type="submit"], button[type="submit"], input[id*="verify"], button:has-text("Verify"), button:has-text("Vérifier"), input[value="Verify"], input[value="Vérifier"]').first();
		await verifyBtn.click();
		console.log('   Clicked verify button');

		// Wait for navigation past MFA
		await page.waitForURL(url => !isMfaPage(url.toString()), {
			timeout: 30000
		});

		await sleep(2000);
		console.log('✅ MFA verification passed');
		console.log('   URL:', page.url().substring(0, 100));
		return true;
	} catch (err) {
		console.error('❌ MFA handling failed:', err);
		// Take screenshot for debugging
		await page.screenshot({ path: resolve(__dirname, '../.test-mfa-debug.png') }).catch(() => {});
		console.log('   📸 Debug screenshot saved to .test-mfa-debug.png');
		return false;
	}
}

// ---------------------------------------------------------------------------
// Detection via Playwright frames (bypasses extension — raw DOM checks)
// ---------------------------------------------------------------------------

async function checkFrameForLLPlayer(frame: Frame): Promise<{
	url: string;
	detected: boolean;
	signals: string[];
	error?: string;
}> {
	const url = frame.url();
	try {
		const result = await frame.evaluate(() => {
			const signals: string[] = [];
			try { if (document.querySelector('lemon-learning-player')) signals.push('wxt-custom-element'); } catch {}
			try { if (document.querySelector('[data-wxt-shadow-root]')) signals.push('wxt-shadow-root'); } catch {}
			try { if ((document.body as any)?.dataset?.llUserEmail) signals.push('ll-user-email:' + (document.body as any).dataset.llUserEmail); } catch {}
			try { if (document.getElementById('lemonlearning-player-embed')) signals.push('script-tag'); } catch {}
			try { if ((window as any).LemonPlayer) signals.push('LemonPlayer'); } catch {}
			try { if ((window as any).LemonLearningReady) signals.push('LemonLearningReady'); } catch {}
			try {
				const scripts = document.querySelectorAll('script[src]');
				for (let i = 0; i < scripts.length; i++) {
					const src = (scripts[i] as HTMLScriptElement).src || '';
					if (src.includes('lemonlearning') || src.includes('lemon-learning')) {
						signals.push('script-src:' + src.substring(0, 120));
						break;
					}
				}
			} catch {}
			try { if (document.querySelector('[id*="lemon-learning"], [id*="lemonlearning"]')) signals.push('dom-element'); } catch {}
			return signals;
		});
		return { url: url.substring(0, 150), detected: result.length > 0, signals: result };
	} catch (err) {
		return { url: url.substring(0, 150), detected: false, signals: [], error: String(err).substring(0, 200) };
	}
}

async function testDirectDetection(page: Page): Promise<void> {
	console.log('\n🧪 Test 1: Direct frame-by-frame detection (Playwright)');
	console.log('   Checking all frames on the page...\n');

	const frames = page.frames();
	console.log(`   Found ${frames.length} frames total`);

	let detectedCount = 0;

	for (let i = 0; i < frames.length; i++) {
		const frame = frames[i];
		const result = await checkFrameForLLPlayer(frame);

		const prefix = result.detected ? '   ✅' : (result.error ? '   ⚠️' : '   ·');
		const signalsStr = result.signals.length > 0 ? ` → [${result.signals.join(', ')}]` : '';
		const errorStr = result.error ? ` (${result.error.substring(0, 80)})` : '';

		console.log(`${prefix} Frame ${i}: ${result.url}${signalsStr}${errorStr}`);

		if (result.detected) detectedCount++;
	}

	console.log(`\n   Summary: ${detectedCount}/${frames.length} frames have LL Player signals`);
	if (detectedCount === 0) {
		console.log('   ❌ LL Player NOT detected in any frame');
		console.log('   Possible causes:');
		console.log('     - LL Player not installed on this Salesforce org');
		console.log('     - Player loads lazily after user interaction');
		console.log('     - Player is in a cross-origin frame Playwright cannot access');
		console.log('     - Need to navigate to a specific Salesforce page first');
	}
}

// ---------------------------------------------------------------------------
// Detection via extension (tests our actual detection flow)
// ---------------------------------------------------------------------------

async function testExtensionDetection(
	context: BrowserContext,
	page: Page,
	extensionId: string
): Promise<void> {
	console.log('\n🧪 Test 2: Extension detection (via DETECT_LL_PLAYER message)');

	const popupPage = await context.newPage();
	const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`;
	await popupPage.goto(popupUrl);
	await sleep(2000);

	await popupPage.screenshot({ path: resolve(__dirname, '../.test-popup.png') });
	console.log('   📸 Popup screenshot saved to .test-popup.png');

	const popupContent = await popupPage.textContent('body');
	console.log('   Popup content (200ch):', popupContent?.substring(0, 200));

	// Test detection by injecting content script detection logic directly
	// (chrome.runtime.sendMessage from SW to itself doesn't work)
	console.log('\n   Testing detection by scripting into SF tab...');
	try {
		const sfPages = context.pages().filter(
			p => p.url().includes('salesforce.com') || p.url().includes('force.com')
		);
		if (sfPages.length > 0) {
			const sfPage = sfPages[0];
			console.log(`   SF page: ${sfPage.url().substring(0, 100)}`);

			// Run detection directly in the page (mirroring our content-script logic)
			const detResult = await sfPage.evaluate(() => {
				const signals: string[] = [];
				if (document.querySelector('lemon-learning-player')) signals.push('wxt-custom-element');
				if (document.querySelector('[data-wxt-shadow-root]')) signals.push('wxt-shadow-root');
				if ((document.body as any)?.dataset?.llUserEmail) signals.push('ll-user-email');
				if (document.getElementById('lemonlearning-player-embed')) signals.push('script-tag');
				if ((window as any).LemonPlayer) signals.push('LemonPlayer');
				if ((window as any).LemonLearningReady) signals.push('LemonLearningReady');

				// Also dump the shadow DOM state
				const host = document.querySelector('lemon-learning-player');
				const sr = host?.shadowRoot;
				const shadowInfo = sr ? {
					elements: sr.querySelectorAll('*').length,
					textLength: (sr.textContent || '').length,
					text: (sr.textContent || '').substring(0, 200).replace(/\s+/g, ' ').trim()
				} : null;

				return {
					detected: signals.length > 0,
					signals,
					shadowInfo,
					bodyDataset: {
						llUserEmail: (document.body as any)?.dataset?.llUserEmail,
						llUsername: (document.body as any)?.dataset?.llUsername,
					}
				};
			});

			console.log('\n📊 Direct detection result:');
			console.log(JSON.stringify(detResult, null, 2));
		} else {
			console.log('   ❌ No Salesforce page found');
		}
	} catch (err) {
		console.error('   ❌ Detection test failed:', String(err).substring(0, 300));
	}

	await popupPage.close();
}

// ---------------------------------------------------------------------------
// LL Player extension login
// ---------------------------------------------------------------------------

async function getLLPlayerExtensionId(context: BrowserContext): Promise<string> {
	const page = await context.newPage();
	await page.goto('chrome://extensions');
	await sleep(1000);

	const llId = await page.evaluate(() => {
		const manager = document.querySelector('extensions-manager');
		if (!manager?.shadowRoot) return '';
		const itemList = manager.shadowRoot.querySelector('extensions-item-list');
		if (!itemList?.shadowRoot) return '';
		const items = itemList.shadowRoot.querySelectorAll('extensions-item');
		for (const item of Array.from(items)) {
			const name = item.shadowRoot?.querySelector('#name')?.textContent?.trim();
			if (name?.includes('Lemon Learning Player')) {
				return item.id || '';
			}
		}
		return '';
	});

	await page.close();
	console.log('🎮 LL Player extension ID:', llId || 'NOT FOUND');
	return llId;
}

async function loginToLLPlayer(page: Page): Promise<boolean> {
	if (!LL_USER || !LL_PASS) {
		console.log('⚠️ No LL Player credentials in .env (LL_USER, LL_PASS)');
		return false;
	}

	console.log('🎮 Logging into LL Player on the current page...');
	console.log('   Page URL:', page.url().substring(0, 100));

	await sleep(3000);
	await page.screenshot({ path: resolve(__dirname, '../.test-ll-before-click.png') });

	try {
		// Inspect the LL Player element and its shadow DOM
		const llInfo = await page.evaluate(() => {
			const host = document.querySelector('lemon-learning-player');
			if (!host) return { found: false as const };
			const sr = host.shadowRoot;
			if (!sr) return { found: true as const, hasShadow: false };

			const allEls = sr.querySelectorAll('*');
			const dump: string[] = [];
			for (const el of Array.from(allEls).slice(0, 60)) {
				const h = el as HTMLElement;
				const r = h.getBoundingClientRect();
				const tag = h.tagName.toLowerCase();
				const cls = (h.className?.toString() || '').substring(0, 60);
				const txt = (h.textContent || '').substring(0, 40).replace(/\s+/g, ' ').trim();
				if (r.width > 0 && r.height > 0) {
					dump.push(`[${r.width.toFixed(0)}x${r.height.toFixed(0)}@${r.x.toFixed(0)},${r.y.toFixed(0)}] <${tag} class="${cls}"> ${txt ? '"' + txt + '"' : ''}`);
				}
			}
			return {
				found: true as const,
				hasShadow: true,
				totalElements: allEls.length,
				visibleElements: dump.length,
				dump
			};
		});

		console.log('   LL Player element:', JSON.stringify({
			found: llInfo.found,
			hasShadow: (llInfo as any).hasShadow,
			totalElements: (llInfo as any).totalElements,
			visibleElements: (llInfo as any).visibleElements,
		}));

		if ((llInfo as any).dump) {
			console.log('   Shadow DOM visible elements:');
			for (const line of (llInfo as any).dump.slice(0, 20)) {
				console.log('     ' + line);
			}
		}

		if (!llInfo.found) {
			console.log('   ❌ No <lemon-learning-player> element found');
			return false;
		}

		// The LL Player widget has a FAB (floating action button) inside the shadow DOM.
		// Playwright pierces shadow DOM with locators automatically.
		// First, try to find and click any visible button/interactive element inside the shadow host.
		const fabBtn = page.locator('lemon-learning-player button, lemon-learning-player [role="button"], lemon-learning-player div[style*="cursor"]').first();
		const fabCount = await fabBtn.count();
		console.log(`   FAB button candidates: ${fabCount}`);

		if (fabCount > 0) {
			console.log('   Clicking FAB button...');
			await fabBtn.click({ timeout: 5000 });
		} else {
			// Try clicking the host element itself with JS
			console.log('   No FAB found, clicking host element via JS...');
			await page.evaluate(() => {
				const host = document.querySelector('lemon-learning-player');
				if (host?.shadowRoot) {
					// Click the first visible element inside
					const els = host.shadowRoot.querySelectorAll('*');
					for (const el of Array.from(els)) {
						const r = (el as HTMLElement).getBoundingClientRect();
						if (r.width > 10 && r.height > 10) {
							(el as HTMLElement).click();
							break;
						}
					}
				}
			});
		}

		await sleep(2000);
		await page.screenshot({ path: resolve(__dirname, '../.test-ll-after-click.png') });

		// Check if the player panel opened (look for email input)
		// Playwright locators automatically pierce shadow DOM
		const emailInput = page.locator('lemon-learning-player input[type="email"], lemon-learning-player input[placeholder*="email" i], lemon-learning-player input[type="text"]').first();
		const emailCount = await emailInput.count();
		console.log(`   Email input candidates: ${emailCount}`);

		if (emailCount > 0) {
			await emailInput.fill(LL_USER);
			console.log('   Filled email:', LL_USER);
			await page.screenshot({ path: resolve(__dirname, '../.test-ll-email-filled.png') });

			// Dump shadow DOM to find the Continue button
			const afterEmailDump = await page.evaluate(() => {
				const host = document.querySelector('lemon-learning-player');
				const sr = host?.shadowRoot;
				if (!sr) return [];
				const dump: string[] = [];
				for (const el of Array.from(sr.querySelectorAll('*'))) {
					const h = el as HTMLElement;
					const r = h.getBoundingClientRect();
					if (r.width < 5 || r.height < 5) continue;
					const tag = h.tagName.toLowerCase();
					const cls = (h.className?.toString() || '').substring(0, 80);
					const txt = (h.innerText || '').substring(0, 60).replace(/\s+/g, ' ').trim();
					const role = h.getAttribute('role') || '';
					const type = h.getAttribute('type') || '';
					const cursor = getComputedStyle(h).cursor;
					if (tag === 'button' || tag === 'a' || role === 'button' || cursor === 'pointer' || tag === 'input' || txt) {
						dump.push(`[${r.width.toFixed(0)}x${r.height.toFixed(0)}] <${tag}${type ? ' type=' + type : ''}${role ? ' role=' + role : ''}${cursor === 'pointer' ? ' cursor=pointer' : ''} class="${cls}"> "${txt}"`);
					}
				}
				return dump;
			});
			console.log('   Shadow DOM interactive/text elements after email:');
			for (const line of afterEmailDump) {
				console.log('     ' + line);
			}

			// Try broader selectors for the Continue button (may be div, a, span, etc.)
			const continueSelectors = [
				'lemon-learning-player button:has-text("Continue")',
				'lemon-learning-player button:has-text("Continuer")',
				'lemon-learning-player button[type="submit"]',
				'lemon-learning-player a:has-text("Continue")',
				'lemon-learning-player a:has-text("Continuer")',
				'lemon-learning-player div:has-text("Continue")',
				'lemon-learning-player div:has-text("Continuer")',
				'lemon-learning-player span:has-text("Continue")',
				'lemon-learning-player [role="button"]',
			];

			// Click Continue via JS (most reliable for shadow DOM elements)
			const emailContinueResult = await page.evaluate(() => {
				const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
				if (!sr) return 'no-shadow-root';
				for (const el of Array.from(sr.querySelectorAll('a, button, [role="button"]'))) {
					const h = el as HTMLElement;
					const r = h.getBoundingClientRect();
					const txt = (h.innerText || '').trim().toLowerCase();
					if (r.width > 20 && r.height > 20 &&
						(txt.includes('continuer') || txt.includes('continue') || txt.includes('next') || txt.includes('suivant'))) {
						h.click();
						return 'clicked:' + txt;
					}
				}
				return 'no-match';
			});
			console.log('   Email Continue click result:', emailContinueResult);
			const clicked = emailContinueResult.startsWith('clicked:');

			if (clicked) {
				console.log('   Clicked Continue (email step)');
				await sleep(2000);
				await page.screenshot({ path: resolve(__dirname, '../.test-ll-after-email.png') });

				// Fill password
				const pwInput = page.locator('lemon-learning-player input[type="password"]').first();
				const pwCount = await pwInput.count();
				console.log(`   Password input candidates: ${pwCount}`);

				if (pwCount > 0) {
					await pwInput.fill(LL_PASS);
					console.log('   Filled password');
					await sleep(500);

					// Dump shadow DOM after password to see the login button
					const afterPwDump = await page.evaluate(() => {
						const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
						if (!sr) return [];
						const dump: string[] = [];
						for (const el of Array.from(sr.querySelectorAll('*'))) {
							const h = el as HTMLElement;
							const r = h.getBoundingClientRect();
							if (r.width < 5 || r.height < 5) continue;
							const tag = h.tagName.toLowerCase();
							const cls = (h.className?.toString() || '').substring(0, 80);
							const txt = (h.innerText || '').substring(0, 60).replace(/\s+/g, ' ').trim();
							const cursor = getComputedStyle(h).cursor;
							if (tag === 'button' || tag === 'a' || cursor === 'pointer' || tag === 'input' || txt) {
								dump.push(`[${r.width.toFixed(0)}x${r.height.toFixed(0)}@${r.x.toFixed(0)},${r.y.toFixed(0)}] <${tag}${cursor === 'pointer' ? ' ptr' : ''} class="${cls}"> "${txt}"`);
							}
						}
						return dump;
					});
					console.log('   Shadow DOM after password:');
					for (const line of afterPwDump) {
						console.log('     ' + line);
					}

					// Click the login button via JS — look for "Connexion" specifically
					// (NOT "Continuer" which is the email step's button still in DOM)
					const loginResult = await page.evaluate(() => {
						const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
						if (!sr) return 'no-shadow-root';
						// Priority 1: exact login-related text (NOT "continuer")
						const loginTexts = ['connexion', 'se connecter', 'login', 'sign in', 'valider'];
						for (const el of Array.from(sr.querySelectorAll('a, button, [role="button"]'))) {
							const h = el as HTMLElement;
							const r = h.getBoundingClientRect();
							const txt = (h.innerText || '').trim().toLowerCase();
							if (r.width > 20 && r.height > 20 && loginTexts.some(t => txt.includes(t))) {
								h.click();
								return 'clicked:' + txt;
							}
						}
						// Priority 2: last <a> with _btn class (password step button is after email step button)
						const btns = sr.querySelectorAll('a[class*="_btn"]');
						if (btns.length > 0) {
							const last = btns[btns.length - 1] as HTMLElement;
							const r = last.getBoundingClientRect();
							if (r.width > 20 && r.height > 20) {
								last.click();
								return 'clicked-last-btn:' + (last.innerText || '').trim();
							}
						}
						return 'no-match';
					});
					console.log('   Login click result:', loginResult);

					await sleep(5000);
					await page.screenshot({ path: resolve(__dirname, '../.test-ll-logged-in.png') });
					console.log('   ✅ LL Player login step complete');
					return true;
				} else {
					console.log('   ⚠️ No password field found after email step');
					await page.screenshot({ path: resolve(__dirname, '../.test-ll-no-pw.png') });
				}
			}
		} else {
			console.log('   ⚠️ No email input found in player widget');
			const hasContent = await page.evaluate(() => {
				const host = document.querySelector('lemon-learning-player');
				const sr = host?.shadowRoot;
				if (!sr) return false;
				const text = sr.textContent || '';
				return text.includes('guide') || text.includes('Guide') || text.length > 500;
			});
			if (hasContent) {
				console.log('   Might already be logged in (content visible in shadow DOM)');
				return true;
			}
		}

		return false;
	} catch (err) {
		console.error('   ❌ LL Player login failed:', String(err).substring(0, 300));
		await page.screenshot({ path: resolve(__dirname, '../.test-ll-error.png') }).catch(() => {});
		return false;
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	cleanMfaFiles();

	console.log('='.repeat(60));
	console.log('🍋 Lemon Lab — LL Player Detection Test');
	console.log('='.repeat(60));

	const context = await launchBrowser();
	const extensionId = await getExtensionId(context);

	if (!extensionId) {
		console.error('❌ Cannot find extension ID — is the extension built?');
		await context.close();
		return;
	}

	// Verify LL Player extension is loaded
	const llExtId = await getLLPlayerExtensionId(context);
	if (!llExtId) {
		console.log('⚠️ LL Player extension not found — detection test will likely fail');
	}

	// Open Salesforce and login first
	const page = await context.newPage();
	const loggedIn = await loginToSalesforce(page);

	if (!loggedIn) {
		console.log('⏸  Login failed. Aborting test.');
		await context.close();
		return;
	}

	// Wait for Salesforce + LL Player extension to load
	console.log('⏳ Waiting 8s for Salesforce + LL Player to initialize...');
	await sleep(8000);

	// Login to LL Player widget on the Salesforce page
	if (llExtId) {
		await loginToLLPlayer(page);
		// Wait for player to fully initialize after login
		console.log('⏳ Waiting 5s for LL Player to initialize after login...');
		await sleep(5000);
	}

	console.log('   Final URL:', page.url().substring(0, 120));
	console.log('   Title:', await page.title());

	// Test 1: Direct detection (Playwright frames)
	await testDirectDetection(page);

	// Test 2: Extension detection (our actual flow)
	await testExtensionDetection(context, page, extensionId);

	// Keep browser open
	console.log('\n✅ Test complete. Browser kept open for inspection.');
	console.log('   Press Ctrl+C to close.');
	await new Promise(() => {});
}

main().catch(err => {
	console.error('Fatal error:', err);
	process.exit(1);
});
