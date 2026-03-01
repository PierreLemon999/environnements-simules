/**
 * Shared test helpers for Playwright E2E tests.
 *
 * Provides: Chrome launch (with extensions), SF login, MFA handling,
 * LL Player login, extension ID discovery.
 *
 * Usage:
 *   import { launchBrowser, loginToSalesforce, loginToLLPlayer, ... } from './helpers';
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import { readFileSync, writeFileSync, existsSync, unlinkSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

export const EXTENSION_PATH = resolve(__dirname, '../dist');
export const LL_PLAYER_PATH = resolve(__dirname, 'll-player-ext/unpacked');
export const USER_DATA_DIR = resolve(__dirname, '../.test-profile');
export const SCREENSHOT_DIR = resolve(__dirname, '..');

const MFA_NEEDED_FILE = resolve(__dirname, '../.mfa-needed');
const MFA_CODE_FILE = resolve(__dirname, '../.mfa-code');

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const envPath = resolve(__dirname, '../.env');
const env: Record<string, string> = {};
if (existsSync(envPath)) {
	for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
		const match = line.match(/^(\w+)=(.*)$/);
		if (match) env[match[1]] = match[2];
	}
}

export const SF_URL = env.SALESFORCE_URL || 'https://login.salesforce.com/';
export const SF_USER = env.SALESFORCE_USER || '';
export const SF_PASS = env.SALESFORCE_PASS || '';
export const LL_USER = env.LL_USER || '';
export const LL_PASS = env.LL_PASS || '';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export function screenshot(name: string) {
	return resolve(SCREENSHOT_DIR, `.test-${name}.png`);
}

function cleanMfaFiles() {
	try { unlinkSync(MFA_NEEDED_FILE); } catch {}
	try { unlinkSync(MFA_CODE_FILE); } catch {}
}

// ---------------------------------------------------------------------------
// Browser launch
// ---------------------------------------------------------------------------

export async function launchBrowser(): Promise<BrowserContext> {
	console.log('  Launching Chrome with extensions...');
	console.log('    Lemon Lab:', EXTENSION_PATH);
	console.log('    LL Player:', LL_PLAYER_PATH);

	cleanMfaFiles();

	// Remove stale profile locks from unclean Chrome shutdown
	for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
		const p = resolve(USER_DATA_DIR, lock);
		if (existsSync(p)) { try { unlinkSync(p); } catch {} }
	}
	// Also clean up stale LOCK files inside Default/ that prevent DB access
	const defaultDir = resolve(USER_DATA_DIR, 'Default');
	if (existsSync(defaultDir)) {
		const cleanLocks = (dir: string) => {
			try {
				const { readdirSync, statSync } = require('fs');
				for (const entry of readdirSync(dir)) {
					const full = resolve(dir, entry);
					try {
						const s = statSync(full);
						if (s.isDirectory()) cleanLocks(full);
						else if (entry === 'LOCK') unlinkSync(full);
					} catch {}
				}
			} catch {}
		};
		cleanLocks(defaultDir);
	}

	// Note: Clearing ScriptCache forces Chrome to recompile service workers from dist.
	// Only do this when extension code has changed — Chrome sometimes crashes if
	// ScriptCache is deleted while the profile's Database references compiled entries.
	// The flag --load-extension should detect file changes, but doesn't always work.
	if (process.env.CLEAR_SW_CACHE === '1') {
		const swCacheDir = resolve(USER_DATA_DIR, 'Default/Service Worker/ScriptCache');
		if (existsSync(swCacheDir)) {
			rmSync(swCacheDir, { recursive: true, force: true });
			console.log('    Cleared SW ScriptCache');
		}
	}

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

	// Wait for extensions to load and service workers to register
	// Longer wait needed after cache clearing (Chrome must recompile service workers)
	await sleep(5000);
	return context;
}

// ---------------------------------------------------------------------------
// Extension ID discovery
// ---------------------------------------------------------------------------

export async function getExtensionId(context: BrowserContext, name: string): Promise<string> {
	const page = await context.newPage();
	await page.goto('chrome://extensions');
	await sleep(1000);

	const extId = await page.evaluate((targetName: string) => {
		const manager = document.querySelector('extensions-manager');
		if (!manager?.shadowRoot) return '';
		const itemList = manager.shadowRoot.querySelector('extensions-item-list');
		if (!itemList?.shadowRoot) return '';
		const items = itemList.shadowRoot.querySelectorAll('extensions-item');
		for (const item of Array.from(items)) {
			const n = item.shadowRoot?.querySelector('#name')?.textContent?.trim();
			if (n?.includes(targetName)) return item.id || '';
		}
		return '';
	}, name);

	await page.close();

	// Fallback: service worker URL
	if (!extId && name === 'Lemon Lab') {
		for (const sw of context.serviceWorkers()) {
			if (sw.url().includes('service-worker')) {
				const match = sw.url().match(/chrome-extension:\/\/([^/]+)/);
				if (match) return match[1];
			}
		}
	}

	return extId;
}

// ---------------------------------------------------------------------------
// Salesforce login
// ---------------------------------------------------------------------------

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

async function waitForMfaCode(): Promise<string> {
	writeFileSync(MFA_NEEDED_FILE, new Date().toISOString());
	console.log('    Wrote .mfa-needed — waiting for .mfa-code file...');

	for (let i = 0; i < 120; i++) {
		await sleep(2000);
		if (existsSync(MFA_CODE_FILE)) {
			const code = readFileSync(MFA_CODE_FILE, 'utf-8').trim();
			cleanMfaFiles();
			if (code && /^\d{4,8}$/.test(code)) return code;
			console.log('    Invalid code:', code);
		}
	}
	cleanMfaFiles();
	throw new Error('MFA code timeout (4 minutes)');
}

async function handleMfa(page: Page): Promise<boolean> {
	console.log('  MFA/TOTP verification required');

	try {
		// Switch to email verification
		const diffMethod = page.locator('a:has-text("Different Verification Method"), a:has-text("autre méthode"), button:has-text("Different Verification Method")').first();
		try {
			await diffMethod.click({ timeout: 5000 });
			await sleep(2000);
		} catch {}

		// Select email radio (index 1)
		const radios = page.locator('input[type="radio"]');
		const radioCount = await radios.count();
		if (radioCount >= 2) await radios.nth(1).click({ force: true });
		else if (radioCount === 1) await radios.nth(0).click({ force: true });
		await sleep(1000);

		// Click Continue
		const continueBtn = page.locator('button:has-text("Continue"), input[value="Continue"], button:has-text("Continuer"), input[value="Continuer"], input[type="submit"]').first();
		try {
			await continueBtn.click({ timeout: 5000 });
			await sleep(3000);
		} catch {}

		// Wait for code
		const code = await waitForMfaCode();
		console.log('    Got MFA code:', code);

		// Check if already past MFA (user may have verified manually while waiting)
		if (isLoggedIntoSalesforce(page.url())) {
			console.log('  Already past MFA (logged in during wait)');
			return true;
		}

		// Fill code — try multiple selectors (SF MFA pages vary in structure)
		await page.screenshot({ path: screenshot('mfa-before-fill') }).catch(() => {});
		const codeSelectors = [
			'input[name*="code"]', 'input[name*="verification"]',
			'input[id*="code"]', 'input[id*="verification"]', 'input[id*="smc"]',
			'input[type="tel"]', 'input[type="number"]',
			'input[autocomplete*="one-time"]', 'input[inputmode="numeric"]',
			'input.input[type="text"]', // SF generic text input
		];
		let filled = false;
		for (const sel of codeSelectors) {
			const input = page.locator(sel).first();
			if (await input.count() > 0) {
				try {
					await input.fill(code, { timeout: 3000 });
					console.log('    Filled code in:', sel);
					filled = true;
					break;
				} catch { /* try next */ }
			}
		}
		if (!filled) {
			// Last resort: find any visible text input on the page
			const allInputs = page.locator('input[type="text"], input:not([type])');
			const count = await allInputs.count();
			console.log(`    No specific code input found, trying ${count} generic inputs...`);
			for (let i = 0; i < Math.min(count, 5); i++) {
				const inp = allInputs.nth(i);
				if (await inp.isVisible()) {
					try {
						await inp.fill(code, { timeout: 2000 });
						console.log(`    Filled generic input #${i}`);
						filled = true;
						break;
					} catch { /* try next */ }
				}
			}
		}
		if (!filled) throw new Error('No code input found on MFA page');

		// Verify
		const verifyBtn = page.locator('input[type="submit"], button[type="submit"], button:has-text("Verify"), button:has-text("Vérifier")').first();
		await verifyBtn.click();

		await page.waitForURL(url => !isMfaPage(url.toString()), { timeout: 30000 });
		await sleep(2000);
		console.log('  MFA passed');
		return true;
	} catch (err) {
		console.error('  MFA failed:', err);
		await page.screenshot({ path: screenshot('mfa-debug') }).catch(() => {});
		return false;
	}
}

export async function loginToSalesforce(page: Page): Promise<boolean> {
	console.log('  Logging into Salesforce...');
	await page.goto(SF_URL, { waitUntil: 'networkidle' });
	await sleep(1000);

	const url = page.url();

	if (isLoggedIntoSalesforce(url)) {
		console.log('  Already logged in');
		return true;
	}
	if (isMfaPage(url)) return handleMfa(page);

	if (!SF_USER || !SF_PASS) {
		console.error('  No Salesforce credentials in .env');
		return false;
	}

	try {
		await page.locator('#username').fill(SF_USER);
		await page.locator('#password').fill(SF_PASS);
		await page.locator('#Login').click();

		await page.waitForURL(url => !url.toString().includes('login.salesforce.com'), {
			timeout: 30000
		}).catch(() => {});
		await sleep(1000);

		const afterUrl = page.url();
		if (afterUrl.includes('login.salesforce.com')) {
			console.error('  Login failed — still on login page');
			return false;
		}
		if (isMfaPage(afterUrl)) return handleMfa(page);

		console.log('  SF login OK');
		return true;
	} catch (err) {
		console.error('  SF login error:', err);
		return false;
	}
}

// ---------------------------------------------------------------------------
// LL Player login (on current page via shadow DOM)
// ---------------------------------------------------------------------------

export async function loginToLLPlayer(page: Page): Promise<boolean> {
	if (!LL_USER || !LL_PASS) {
		console.log('  No LL credentials in .env');
		return false;
	}

	console.log('  Logging into LL Player...');

	try {
		// Wait for the player element + FAB to appear (poll up to 30s)
		let fabReady = false;
		for (let i = 0; i < 15; i++) {
			const elCount = await page.evaluate(() => {
				const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
				return sr ? sr.querySelectorAll('*').length : 0;
			});
			if (elCount > 10) { fabReady = true; break; }
			if (i === 0) console.log('    Waiting for player FAB...');
			await sleep(2000);
		}
		if (!fabReady) {
			// Fallback: reload the page and wait again (LL Player sometimes fails to render on first load)
			console.log('    FAB not found — reloading page...');
			await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
			await sleep(8000);
			for (let i = 0; i < 15; i++) {
				const elCount = await page.evaluate(() => {
					const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
					return sr ? sr.querySelectorAll('*').length : 0;
				});
				if (elCount > 10) { fabReady = true; break; }
				if (i === 0) console.log('    Waiting after reload...');
				await sleep(2000);
			}
		}
		if (!fabReady) {
			// Last resort: clear page localStorage (may contain stale LL Player cache) and reload
			console.log('    Still no FAB — clearing page cache and reloading...');
			await page.evaluate(() => {
				localStorage.clear();
				// Also clear IndexedDB databases that might belong to LL Player
				try { indexedDB.databases().then(dbs => dbs.forEach(db => { if (db.name) indexedDB.deleteDatabase(db.name); })); } catch {}
			});
			await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
			await sleep(10000);
			for (let i = 0; i < 15; i++) {
				const elCount = await page.evaluate(() => {
					const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
					return sr ? sr.querySelectorAll('*').length : 0;
				});
				if (elCount > 10) { fabReady = true; break; }
				if (i === 0) console.log('    Waiting after cache clear...');
				await sleep(2000);
			}
		}
		if (!fabReady) {
			console.log('  LL Player did not render FAB after cache clear + reload');
			return false;
		}

		// Click FAB to open panel
		const fabClicked = await clickFAB(page);
		console.log('    FAB result:', fabClicked);
		if (fabClicked === 'no-fab' || fabClicked === 'no-shadow-root') {
			console.log('  Could not find FAB');
			return false;
		}
		await sleep(3000);

		// Check if already logged in (guides visible, NOT the login form)
		const panelState = await page.evaluate(() => {
			const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
			if (!sr) return 'no-shadow';
			const elCount = sr.querySelectorAll('*').length;
			if (elCount < 30) return 'fab-only';
			const text = sr.textContent || '';
			// Login form shows "Bienvenue" + "Adresse E-mail" + "Continuer"
			if (text.includes('Adresse E-mail') || text.includes('Connectez-vous')) return 'login-form';
			// Logged in: shows guides/sections
			if (text.includes('guide') || text.includes('Guide') || text.includes('section') || elCount > 100) return 'logged-in';
			return 'unknown-' + elCount;
		});
		console.log('    Panel state:', panelState);
		if (panelState === 'logged-in') {
			console.log('  LL Player already logged in');
			return true;
		}
		if (panelState === 'fab-only' || panelState === 'no-shadow') {
			// Need to click FAB first — handled above, so this means click didn't work
		}

		// Fill email — wait for the input to appear
		await sleep(1000);
		const emailInput = page.locator('lemon-learning-player input[type="email"], lemon-learning-player input[type="text"]').first();
		if (await emailInput.count() === 0) {
			console.log('  No email input found');
			return false;
		}
		await emailInput.fill(LL_USER);
		await sleep(500);

		// Click Continue (email step)
		await page.evaluate(() => {
			const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
			if (!sr) return;
			for (const el of Array.from(sr.querySelectorAll('a, button, [role="button"]'))) {
				const h = el as HTMLElement;
				const r = h.getBoundingClientRect();
				const txt = (h.innerText || '').trim().toLowerCase();
				if (r.width > 20 && r.height > 20 &&
					(txt.includes('continuer') || txt.includes('continue') || txt.includes('next'))) {
					h.click();
					return;
				}
			}
		});
		await sleep(2000);

		// Fill password
		const pwInput = page.locator('lemon-learning-player input[type="password"]').first();
		if (await pwInput.count() > 0) {
			await pwInput.fill(LL_PASS);
			await sleep(500);

			// Click Connexion
			await page.evaluate(() => {
				const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
				if (!sr) return;
				const loginTexts = ['connexion', 'se connecter', 'login', 'sign in', 'valider'];
				for (const el of Array.from(sr.querySelectorAll('a, button, [role="button"]'))) {
					const h = el as HTMLElement;
					const r = h.getBoundingClientRect();
					const txt = (h.innerText || '').trim().toLowerCase();
					if (r.width > 20 && r.height > 20 && loginTexts.some(t => txt.includes(t))) {
						h.click();
						return;
					}
				}
				// Fallback: last _btn link
				const btns = sr.querySelectorAll('a[class*="_btn"]');
				if (btns.length > 0) (btns[btns.length - 1] as HTMLElement).click();
			});
			await sleep(5000);
		}

		console.log('  LL Player login complete');
		return true;
	} catch (err) {
		console.error('  LL login failed:', String(err).substring(0, 200));
		await page.screenshot({ path: screenshot('ll-error') }).catch(() => {});
		return false;
	}
}

// ---------------------------------------------------------------------------
// LL Player: open panel (click FAB to load guides into cache)
// ---------------------------------------------------------------------------

export async function openLLPlayerPanel(page: Page): Promise<boolean> {
	console.log('  Ensuring LL Player panel is open...');

	try {
		// Phase 1: Wait for the player to have its FAB visible (>10 elements).
		// After login, the player reinitializes and temporarily drops to ~5 elements.
		let elCount = 0;
		for (let attempt = 0; attempt < 20; attempt++) {
			elCount = await page.evaluate(() => {
				const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
				return sr ? sr.querySelectorAll('*').length : 0;
			});
			if (elCount > 10) break;
			if (attempt === 0) console.log('    Waiting for player to reinitialize...');
			if (attempt % 5 === 4) console.log(`    Still waiting... (${elCount} elements after ${(attempt + 1) * 2}s)`);
			await sleep(2000);
		}

		if (elCount <= 10) {
			// Fallback: reload page and try again
			console.log(`    Player stuck at ${elCount} elements — reloading page...`);
			await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
			await sleep(5000);
			for (let retry = 0; retry < 15; retry++) {
				elCount = await page.evaluate(() => {
					const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
					return sr ? sr.querySelectorAll('*').length : 0;
				});
				if (elCount > 10) break;
				if (retry === 0) console.log('    Waiting after reload...');
				await sleep(2000);
			}
			if (elCount <= 10) {
				// Last resort: clear page cache and try once more
				console.log(`    Player stuck at ${elCount} elements — clearing page cache...`);
				await page.evaluate(() => {
					localStorage.clear();
					try { indexedDB.databases().then(dbs => dbs.forEach(db => { if (db.name) indexedDB.deleteDatabase(db.name); })); } catch {}
				});
				await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
				await sleep(10000);
				for (let retry2 = 0; retry2 < 15; retry2++) {
					elCount = await page.evaluate(() => {
						const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
						return sr ? sr.querySelectorAll('*').length : 0;
					});
					if (elCount > 10) break;
					if (retry2 === 0) console.log('    Waiting after cache clear...');
					await sleep(2000);
				}
			}
			if (elCount <= 10) {
				console.log(`    Player still not ready (${elCount} elements after all attempts)`);
				await dumpShadowDOMState(page);
				return false;
			}
		}
		console.log(`    Player ready (${elCount} elements)`);

		// Phase 2: Check panel state (is it open? login form? logged in with guides?)
		const panelState = await page.evaluate(() => {
			const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
			if (!sr) return 'no-shadow';
			const count = sr.querySelectorAll('*').length;
			if (count < 30) return 'fab-only';
			const text = sr.textContent || '';
			if (text.includes('Adresse E-mail') || text.includes('Connectez-vous')) return 'login-form';
			if (text.includes('guide') || text.includes('Guide') || text.includes('section') || count > 100) return 'logged-in';
			return 'panel-open-' + count;
		});
		console.log('    Panel state:', panelState);

		if (panelState === 'fab-only') {
			// Click FAB to open panel
			const result = await clickFAB(page);
			console.log('    FAB click:', result);

			// Poll until panel opens (>30 elements)
			console.log('    Waiting for panel to open...');
			for (let i = 0; i < 10; i++) {
				await sleep(2000);
				const count = await page.evaluate(() => {
					const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
					return sr ? sr.querySelectorAll('*').length : 0;
				});
				if (count > 30) {
					console.log(`    Panel opened (${count} elements after ${(i + 1) * 2}s)`);
					break;
				}
				if (i === 9) console.log(`    Panel did not open (${count} elements after 20s)`);
			}
		}

		// Phase 3: Dump state for diagnostics
		const state = await dumpShadowDOMState(page);
		return state.elements > 30;
	} catch (err) {
		console.log('    Error:', String(err).substring(0, 200));
		return false;
	}
}

/** Click the LL Player FAB using realistic mouse events */
async function clickFAB(page: Page): Promise<string> {
	return page.evaluate(() => {
		const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
		if (!sr) return 'no-shadow-root';
		let target: HTMLElement | null = null;
		for (const el of Array.from(sr.querySelectorAll('*'))) {
			const h = el as HTMLElement;
			const cls = h.className?.toString() || '';
			if (cls.includes('launcher')) { target = h; break; }
		}
		if (!target) {
			for (const el of Array.from(sr.querySelectorAll('*'))) {
				const h = el as HTMLElement;
				const r = h.getBoundingClientRect();
				if (r.width >= 40 && r.width <= 120 && r.height >= 40 && r.height <= 120) {
					target = h; break;
				}
			}
		}
		if (!target) return 'no-fab';
		const r = target.getBoundingClientRect();
		const x = r.left + r.width / 2;
		const y = r.top + r.height / 2;
		const opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y };
		target.dispatchEvent(new PointerEvent('pointerdown', opts));
		target.dispatchEvent(new MouseEvent('mousedown', opts));
		target.dispatchEvent(new PointerEvent('pointerup', opts));
		target.dispatchEvent(new MouseEvent('mouseup', opts));
		target.dispatchEvent(new MouseEvent('click', opts));
		return 'clicked-launcher';
	});
}

/** Dump shadow DOM visible text elements for diagnostics */
async function dumpShadowDOMState(page: Page): Promise<{ elements: number; visibleTexts: string[] }> {
	const shadowState = await page.evaluate(() => {
		const sr = document.querySelector('lemon-learning-player')?.shadowRoot;
		if (!sr) return { elements: 0, visibleTexts: [] as string[] };

		const visibleTexts: string[] = [];
		for (const el of Array.from(sr.querySelectorAll('*'))) {
			const h = el as HTMLElement;
			const r = h.getBoundingClientRect();
			if (r.width < 5 || r.height < 5) continue;
			const ownText = Array.from(h.childNodes)
				.filter(n => n.nodeType === 3)
				.map(n => n.textContent?.trim())
				.filter(Boolean)
				.join(' ');
			if (ownText && ownText.length > 2) visibleTexts.push(ownText);
		}

		return {
			elements: sr.querySelectorAll('*').length,
			visibleTexts: [...new Set(visibleTexts)].slice(0, 50),
		};
	});

	console.log(`    Shadow DOM: ${shadowState.elements} elements`);
	console.log(`    Visible texts (${shadowState.visibleTexts.length}):`);
	for (const t of shadowState.visibleTexts.slice(0, 25)) {
		console.log(`      "${t}"`);
	}
	return shadowState;
}

// ---------------------------------------------------------------------------
// Lemon Lab extension login (local dev bypass)
// ---------------------------------------------------------------------------

export async function loginToLemonLab(context: BrowserContext, extensionId: string): Promise<boolean> {
	console.log('  Logging into Lemon Lab extension...');

	const popup = await openPopup(context, extensionId);

	try {
		const bodyText = await popup.textContent('body') || '';

		// Already logged in?
		if (bodyText.includes('Capture') || bodyText.includes('projet')) {
			console.log('  Already logged in');
			await popup.close();
			return true;
		}

		// Click "Connexion locale" button (devBypass → POST /api/auth/google)
		const localBtn = popup.locator('button:has-text("Connexion locale")').first();
		if (await localBtn.count() === 0) {
			console.log('  No "Connexion locale" button found');
			console.log('  Popup text:', bodyText.substring(0, 200));
			await popup.close();
			return false;
		}

		await localBtn.click();
		console.log('  Clicked "Connexion locale"');

		// Wait for login to complete (popup refreshes to main view)
		await sleep(3000);

		const afterText = await popup.textContent('body') || '';
		const loggedIn = afterText.includes('Capture') || afterText.includes('projet') || afterText.includes('Lemon Lab v');
		const hasError = afterText.includes('Erreur') || afterText.includes('Échec');

		if (hasError) {
			console.log('  Login error:', afterText.substring(0, 200));
			await popup.screenshot({ path: screenshot('lemonlab-login-error') });
			await popup.close();
			return false;
		}

		if (loggedIn) {
			console.log('  Lemon Lab login OK');
		} else {
			console.log('  Login state unclear, continuing anyway');
			console.log('  Popup text:', afterText.substring(0, 200));
		}

		await popup.close();
		return true;
	} catch (err) {
		console.error('  Lemon Lab login failed:', String(err).substring(0, 200));
		await popup.screenshot({ path: screenshot('lemonlab-login-error') }).catch(() => {});
		await popup.close();
		return false;
	}
}

// ---------------------------------------------------------------------------
// Helper: get Salesforce page from context
// ---------------------------------------------------------------------------

export function findSalesforcePage(context: BrowserContext): Page | null {
	return context.pages().find(
		p => (p.url().includes('salesforce.com') || p.url().includes('force.com'))
			&& !p.url().includes('login.salesforce.com')
	) || null;
}

// ---------------------------------------------------------------------------
// Helper: open extension popup
// ---------------------------------------------------------------------------

export async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
	const popupPage = await context.newPage();
	await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
	await sleep(1500);
	return popupPage;
}
