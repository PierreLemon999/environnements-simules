/**
 * Stagehand-based test helpers.
 *
 * Stagehand handles UI interactions (forms, buttons, shadow DOM).
 * Playwright connects to the SAME Chrome via CDP for extension-specific ops
 * (chrome-extension:// pages, chrome.storage, service workers).
 */

import { Stagehand } from '@browserbasehq/stagehand';
import { chromium, type BrowserContext } from 'playwright';
import { readFileSync, writeFileSync, existsSync, unlinkSync, rmSync, readdirSync, statSync } from 'fs';
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
export const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';

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

function cleanLockFiles() {
	for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
		const p = resolve(USER_DATA_DIR, lock);
		if (existsSync(p)) { try { unlinkSync(p); } catch {} }
	}
	const defaultDir = resolve(USER_DATA_DIR, 'Default');
	if (existsSync(defaultDir)) {
		const cleanLocks = (dir: string) => {
			try {
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
}

// ---------------------------------------------------------------------------
// MFA (file-based — proven to work)
// ---------------------------------------------------------------------------

export async function waitForMfaCode(): Promise<string> {
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

// ---------------------------------------------------------------------------
// LL Player data cleanup (fixes corrupted state)
// ---------------------------------------------------------------------------

export async function clearLLPlayerData(page: { url: () => string; evaluate: (fn: () => void) => Promise<void> }) {
	console.log('    Clearing LL Player cached data...');
	await page.evaluate(() => {
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const key = localStorage.key(i)!;
			if (key.includes('lemon') || key.includes('REACT_QUERY') || key.includes('ll-')) {
				localStorage.removeItem(key);
			}
		}
		try {
			indexedDB.databases().then(dbs => dbs.forEach(db => {
				if (db.name && (db.name.includes('lemon') || db.name.includes('react-query'))) {
					indexedDB.deleteDatabase(db.name);
				}
			}));
		} catch {}
	});
}

// ---------------------------------------------------------------------------
// Test browser: Stagehand + Playwright hybrid
// ---------------------------------------------------------------------------

export interface TestBrowser {
	stagehand: Stagehand | null;
	playwright: BrowserContext;
	close: () => Promise<void>;
}

export async function createTestBrowser(opts: { freshProfile?: boolean } = {}): Promise<TestBrowser> {
	console.log('  Launching Chrome with extensions...');
	console.log('    Lemon Lab:', EXTENSION_PATH);
	console.log('    LL Player:', LL_PLAYER_PATH);

	cleanMfaFiles();

	if (opts.freshProfile && existsSync(USER_DATA_DIR)) {
		console.log('    Wiping test profile (--fresh-profile)...');
		rmSync(USER_DATA_DIR, { recursive: true, force: true });
	}

	cleanLockFiles();

	// Clear SW ScriptCache if requested
	if (process.env.CLEAR_SW_CACHE === '1') {
		const swCacheDir = resolve(USER_DATA_DIR, 'Default/Service Worker/ScriptCache');
		if (existsSync(swCacheDir)) {
			rmSync(swCacheDir, { recursive: true, force: true });
			console.log('    Cleared SW ScriptCache');
		}
	}

	if (!ANTHROPIC_API_KEY) {
		console.warn('    ⚠ No ANTHROPIC_API_KEY — Stagehand LLM calls will fail');
	}

	// Architecture: Playwright launches Chrome with pipe (default, reliable),
	// then Stagehand connects separately via CDP port.
	// Chrome supports both pipe and port simultaneously.
	const CDP_PORT = 9222 + Math.floor(Math.random() * 1000);

	// Step 1: Playwright launches Chrome with extensions (pipe for Playwright, port for Stagehand)
	const playwrightCtx = await chromium.launchPersistentContext(USER_DATA_DIR, {
		headless: false,
		args: [
			`--disable-extensions-except=${EXTENSION_PATH},${LL_PLAYER_PATH}`,
			`--load-extension=${EXTENSION_PATH},${LL_PLAYER_PATH}`,
			'--no-first-run',
			'--disable-default-apps',
			`--remote-debugging-port=${CDP_PORT}`,
		],
		viewport: { width: 1440, height: 900 },
		ignoreDefaultArgs: ['--disable-component-extensions-with-background-pages'],
	});

	// Wait for extensions to register
	const waitMs = opts.freshProfile ? 8000 : 5000;
	await sleep(waitMs);
	console.log('    Chrome launched with extensions');

	// Verify CDP endpoint is accessible before Stagehand connects
	const cdpUrl = `http://localhost:${CDP_PORT}`;
	let cdpAvailable = false;
	for (let attempt = 0; attempt < 15; attempt++) {
		try {
			const resp = await fetch(`${cdpUrl}/json/version`);
			if (resp.ok) {
				const info = await resp.json() as { webSocketDebuggerUrl?: string };
				console.log('    CDP endpoint verified on port', CDP_PORT);
				if (info.webSocketDebuggerUrl) {
					console.log('    WebSocket:', info.webSocketDebuggerUrl);
				}
				cdpAvailable = true;
				break;
			}
			console.log(`    CDP attempt ${attempt + 1}: HTTP ${resp.status}`);
		} catch (err: any) {
			console.log(`    CDP attempt ${attempt + 1}: ${err.code || err.message}`);
		}
		await sleep(1000);
	}

	// Step 2: Connect Stagehand to the SAME Chrome via CDP (if available)
	let stagehand: Stagehand | null = null;
	if (cdpAvailable) {
		try {
			stagehand = new Stagehand({
				env: 'LOCAL',
				model: {
					modelName: 'anthropic/claude-haiku-4-5',
					apiKey: ANTHROPIC_API_KEY,
				},
				localBrowserLaunchOptions: {
					cdpUrl,
				},
				verbose: 1,
				disablePino: true,
			});
			await stagehand.init();
			console.log('    Stagehand connected via CDP');
		} catch (err: any) {
			console.warn('    Stagehand CDP connection failed:', err.message);
			console.warn('    Continuing with Playwright only (no AI-powered actions)');
			stagehand = null;
		}
	} else {
		console.warn('    CDP not available — continuing with Playwright only');
	}
	console.log('    Ready');

	return {
		stagehand,
		playwright: playwrightCtx,
		close: async () => {
			if (stagehand) try { await stagehand.close(); } catch {}
			try { await playwrightCtx.close(); } catch {}
		},
	};
}

// ---------------------------------------------------------------------------
// Extension ID discovery (needs Playwright for chrome:// pages)
// ---------------------------------------------------------------------------

export async function getExtensionId(ctx: BrowserContext, name: string): Promise<string> {
	// Strategy 1: Check service workers (works with launchPersistentContext)
	for (const sw of ctx.serviceWorkers()) {
		const url = sw.url();
		if (url.includes('service-worker') || url.includes('background')) {
			const match = url.match(/chrome-extension:\/\/([^/]+)/);
			if (match) {
				console.log(`    Found extension via SW: ${match[1]}`);
				return match[1];
			}
		}
	}

	// Strategy 2: chrome://extensions page
	const page = await ctx.newPage();
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

	if (extId) return extId;

	// Strategy 3: Wait for service worker to register (fresh profile)
	console.log('    Waiting for extension service worker...');
	for (let i = 0; i < 10; i++) {
		await sleep(2000);
		for (const sw of ctx.serviceWorkers()) {
			const match = sw.url().match(/chrome-extension:\/\/([^/]+)/);
			if (match) return match[1];
		}
	}

	return '';
}

// ---------------------------------------------------------------------------
// Helper: open extension popup (Playwright)
// ---------------------------------------------------------------------------

export async function openPopup(ctx: BrowserContext, extensionId: string) {
	const popupPage = await ctx.newPage();
	await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
	await sleep(1500);
	return popupPage;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function isMfaPage(url: string): boolean {
	return url.includes('verification') ||
		url.includes('challenge') ||
		url.includes('TotpVerification') ||
		url.includes('mfa') ||
		url.includes('two-factor');
}

export function isLoggedIntoSalesforce(url: string): boolean {
	return !url.includes('login.salesforce.com') &&
		!isMfaPage(url) &&
		(url.includes('salesforce.com') || url.includes('force.com'));
}
