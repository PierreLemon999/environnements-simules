/**
 * LL Player Bridge — Interactions MAIN world avec le player Lemon Learning.
 *
 * Chaque fonction injecte un script dans le MAIN world de la page via
 * chrome.scripting.executeScript (même pattern que detectLLPlayer / scanLLGuides).
 *
 * Cela permet d'accéder à window.LemonPlayer et au DOM de la page
 * avec le contexte JavaScript de la page (pas l'isolated world).
 */

import type { StepActionInfo } from './constants';
import { reportError } from './api';

/** Build the executeScript target, routing to the correct frame if needed. */
function scriptTarget(tabId: number, frameId?: number): chrome.scripting.ScriptInjectionTarget {
	return frameId ? { tabId, frameIds: [frameId] } : { tabId };
}

// ---------------------------------------------------------------------------
// inspectPlayer — Diagnostic du LemonPlayer
// ---------------------------------------------------------------------------

/**
 * Diagnostic: inspect the LemonPlayer object to understand its structure.
 */
export async function inspectPlayer(tabId: number, frameId?: number): Promise<Record<string, unknown>> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: scriptTarget(tabId, frameId),
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
			func: () => {
				const win = window as unknown as Record<string, unknown>;
				const player = win.LemonPlayer;

				if (!player) {
					return { exists: false, type: typeof player };
				}

				const info: Record<string, unknown> = {
					exists: true,
					type: typeof player,
					isFunction: typeof player === 'function',
					constructor: (player as object).constructor?.name,
				};

				// Own property names
				try { info.ownKeys = Object.getOwnPropertyNames(player); } catch { info.ownKeys = 'error'; }

				// Prototype chain
				try {
					const proto = Object.getPrototypeOf(player);
					if (proto && proto !== Object.prototype) {
						info.protoKeys = Object.getOwnPropertyNames(proto);
						const proto2 = Object.getPrototypeOf(proto);
						if (proto2 && proto2 !== Object.prototype) {
							info.proto2Keys = Object.getOwnPropertyNames(proto2);
						}
					}
				} catch { info.protoKeys = 'error'; }

				// Check specific known method names
				const methodsToCheck = ['show', 'hide', 'playGuide', 'play', 'start', 'open',
					'launchGuide', 'startGuide', 'openGuide', 'runGuide',
					'toggle', 'init', 'destroy', 'setConfig', 'getConfig'];
				const found: Record<string, string> = {};
				for (const m of methodsToCheck) {
					try {
						const val = (player as Record<string, unknown>)[m];
						if (val !== undefined) found[m] = typeof val;
					} catch { /* skip */ }
				}
				info.knownMethods = found;

				// Enumerate all accessible properties with types
				try {
					const allProps: Record<string, string> = {};
					for (const key in player as object) {
						try {
							allProps[key] = typeof (player as Record<string, unknown>)[key];
						} catch { allProps[key] = 'error'; }
					}
					info.enumerableProps = allProps;
				} catch { info.enumerableProps = 'error'; }

				// Check config keys
				try {
					const config = (player as Record<string, unknown>).config;
					if (config && typeof config === 'object') {
						info.configKeys = Object.keys(config as object);
						// Extract a few key config values
						const c = config as Record<string, unknown>;
						info.configSample = {
							projectKey: c.projectKey,
							companyKey: c.companyKey,
							apiUrl: c.apiUrl,
							apiKey: c.apiKey,
							lang: c.lang,
							userId: c.userId,
						};
					}
				} catch { info.configKeys = 'error'; }

				// Check for other LL-related window globals
				try {
					const llGlobals: string[] = [];
					for (const key of Object.getOwnPropertyNames(win)) {
						const lower = key.toLowerCase();
						if (lower.includes('lemon') || lower.includes('ll') || lower.includes('guide') || lower.includes('tour')) {
							llGlobals.push(`${key}:${typeof win[key]}`);
						}
					}
					info.llGlobals = llGlobals;
				} catch { info.llGlobals = 'error'; }

				// Full shadow DOM tree dump
				try {
					const host = document.querySelector('lemon-learning-player');
					if (host?.shadowRoot) {
						const allEls = host.shadowRoot.querySelectorAll('*');
						info.shadowDomElementCount = allEls.length;
						const treeDump: string[] = [];
						for (const el of Array.from(allEls)) {
							const h = el as HTMLElement;
							const r = h.getBoundingClientRect();
							const s = window.getComputedStyle(h);
							const text = (h.textContent?.trim() || '').substring(0, 40);
							const vis = s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0;
							const cls = (h.className && typeof h.className === 'string') ? h.className.substring(0, 40) : '';
							treeDump.push(
								`<${h.tagName.toLowerCase()}${h.id ? '#' + h.id : ''}${cls ? '.' + cls.split(' ')[0] : ''}> ` +
								`${Math.round(r.width)}x${Math.round(r.height)} vis=${vis} cursor=${s.cursor} z=${s.zIndex}` +
								(text ? ` "${text}"` : '')
							);
						}
						info.shadowTreeDump = treeDump;
					}
				} catch { info.shadowDom = 'error'; }

				// Container type check
				try {
					const p = (window as unknown as Record<string, unknown>).LemonPlayer as Record<string, unknown>;
					if (p?.container) {
						const c = p.container;
						info.containerIsShadowRoot = c instanceof ShadowRoot;
						info.containerIsHTMLElement = c instanceof HTMLElement;
						info.containerConstructor = (c as object)?.constructor?.name;
						if (c instanceof ShadowRoot || c instanceof HTMLElement) {
							info.containerElementCount = (c as ShadowRoot | HTMLElement).querySelectorAll('*').length;
						}
					}
					if (p?.reactRoot) {
						const rr = p.reactRoot as Record<string, unknown>;
						const ir = rr._internalRoot as Record<string, unknown> | undefined;
						if (ir?.containerInfo) {
							const ci = ir.containerInfo;
							info.reactContainerIsShadowRoot = ci instanceof ShadowRoot;
							info.reactContainerIsHTMLElement = ci instanceof HTMLElement;
							info.reactContainerConstructor = (ci as object)?.constructor?.name;
						}
					}
				} catch { info.containerCheck = 'error'; }

				return info;
			}
		});
		return result?.result as Record<string, unknown> ?? { error: 'No result' };
	} catch (err) {
		return { error: `Script injection failed: ${err}` };
	}
}

export async function showPlayer(tabId: number, frameId?: number): Promise<{ success: boolean; error?: string }> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: scriptTarget(tabId, frameId),
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
			func: () => {
				try {
					const player = (window as unknown as Record<string, unknown>).LemonPlayer as {
						show?: () => void;
						visible?: boolean;
					} | undefined;

					if (!player) {
						return { success: false, error: 'LemonPlayer not found on window' };
					}

					if (typeof player.show === 'function') {
						player.show();
						return { success: true };
					}

					return { success: false, error: 'LemonPlayer.show() not available' };
				} catch (err) {
					return { success: false, error: String(err) };
				}
			}
		});
		return result?.result as { success: boolean; error?: string } ?? { success: false, error: 'No result' };
	} catch (err) {
		return { success: false, error: `Script injection failed: ${err}` };
	}
}

// ---------------------------------------------------------------------------
// playGuide — Lance un guide par son ID/nom (hybrid DOM-first approach)
// ---------------------------------------------------------------------------

/**
 * Play a guide by simulating real user clicks in the player UI.
 * window.LemonPlayer does NOT expose playGuide() — it's an internal React hook.
 *
 * Hybrid approach:
 * - Strategy A (DOM-only): Works on Salesforce where LemonPlayer is ISOLATED world
 *   → Find shadow root → click FAB → wait for panel → find guide name → click
 * - Strategy B (LemonPlayer API): Fallback for sites where player is in MAIN world
 *   → LemonPlayer.show() → then same DOM flow
 */
export async function playGuide(
	tabId: number,
	guideId: string | number,
	guideName?: string,
	frameId?: number
): Promise<{ success: boolean; error?: string; debug?: unknown }> {
	const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
	const target = scriptTarget(tabId, frameId);

	// Step 1: Ensure the player panel is open (check first, click FAB only if needed)
	try {
		const [openResult] = await chrome.scripting.executeScript({
			target,
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
			func: () => {
				const host = document.querySelector('lemon-learning-player');
				if (!host?.shadowRoot) {
					return { panelOpen: false, elCount: 0, error: 'No shadow root' };
				}

				const elCount = host.shadowRoot.querySelectorAll('*').length;

				// If panel already has many elements (guides visible), don't click FAB (it would close!)
				if (elCount > 30) {
					return { panelOpen: true, elCount, strategy: 'already-open' };
				}

				// Panel not open — find and click FAB
				function simulateRealClick(el: HTMLElement): string {
					const rect = el.getBoundingClientRect();
					const x = Math.round(rect.left + rect.width / 2);
					const y = Math.round(rect.top + rect.height / 2);
					const opts: MouseEventInit = {
						bubbles: true, cancelable: true, composed: true,
						view: window, clientX: x, clientY: y,
						screenX: x + window.screenX, screenY: y + window.screenY,
						button: 0, buttons: 1,
					};
					el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse' }));
					el.dispatchEvent(new MouseEvent('mousedown', opts));
					el.focus?.();
					el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse', buttons: 0 }));
					el.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
					el.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
					return `<${el.tagName.toLowerCase()}> @(${x},${y})`;
				}

				let fab: HTMLElement | null = null;
				fab = host.shadowRoot.querySelector('[class*="launcher"]') as HTMLElement | null;
				if (!fab) {
					for (const el of Array.from(host.shadowRoot.querySelectorAll('*'))) {
						const h = el as HTMLElement;
						const r = h.getBoundingClientRect();
						const s = window.getComputedStyle(h);
						if (s.display === 'none' || r.width === 0) continue;
						if (r.width >= 40 && r.width <= 120 && r.height >= 40 && r.height <= 120 &&
							(s.cursor === 'pointer' || parseInt(s.zIndex, 10) > 1000000)) {
							fab = h;
							break;
						}
					}
				}
				if (!fab) {
					// Try LemonPlayer API
					const win = window as unknown as Record<string, unknown>;
					const player = win.LemonPlayer as { show?: () => void } | undefined;
					if (player && typeof player.show === 'function') {
						player.show();
						return { panelOpen: false, elCount, strategy: 'api-show', needsWait: true };
					}
					return { panelOpen: false, elCount, error: 'No FAB found and no API' };
				}

				simulateRealClick(fab);
				return { panelOpen: false, elCount, strategy: 'fab-clicked', needsWait: true };
			}
		});

		const openRes = openResult?.result as { panelOpen: boolean; elCount: number; strategy?: string; error?: string; needsWait?: boolean };
		reportError({
			message: `[playGuide] Open: ${openRes?.strategy || 'none'} elCount=${openRes?.elCount}`,
			metadata: { ...openRes, guideId, guideName }
		});

		if (openRes?.error) {
			return { success: false, error: `Cannot open player: ${openRes.error}` };
		}

		// Wait for panel to render if we just clicked FAB
		if (openRes?.needsWait) {
			let panelReady = false;
			for (let tick = 0; tick < 12; tick++) {
				await wait(500);
				try {
					const [check] = await chrome.scripting.executeScript({
						target,
						world: 'MAIN' as chrome.scripting.ExecutionWorld,
						func: () => document.querySelector('lemon-learning-player')?.shadowRoot?.querySelectorAll('*').length || 0
					});
					if ((check?.result as number) > 30) { panelReady = true; break; }
				} catch { /* continue */ }
			}
			if (!panelReady) {
				return { success: false, error: 'Panel did not open after FAB click' };
			}
		}
	} catch (err) {
		return { success: false, error: `Open injection failed: ${err}` };
	}

	// Step 2: Find the guide by name and simulate a real click on it
	if (!guideName) {
		return { success: false, error: 'No guide name provided' };
	}

	await wait(500); // Let the panel content finish rendering

	for (let attempt = 0; attempt < 3; attempt++) {
		if (attempt > 0) await wait(1500);

		try {
			const [scanResult] = await chrome.scripting.executeScript({
				target,
				world: 'MAIN' as chrome.scripting.ExecutionWorld,
				args: [guideName, attempt],
				func: (gName: string, attemptNum: number) => {
					const nameToFind = gName.toLowerCase().trim();
					const debug: {
						attempt: number;
						shadowElCount: number;
						textElements: Array<{ tag: string; text: string; loc: string }>;
						clicked?: string;
					} = { attempt: attemptNum, shadowElCount: 0, textElements: [] };

					let bestMatch: HTMLElement | null = null;
					let bestLen = Infinity;

					function scanRoot(root: ShadowRoot | HTMLElement, label: string) {
						try {
							for (const el of Array.from(root.querySelectorAll('*'))) {
								const htmlEl = el as HTMLElement;
								if (htmlEl.shadowRoot) scanRoot(htmlEl.shadowRoot, `${label}>shd`);

								const text = htmlEl.textContent?.trim() || '';
								if (!text || text.length < 3 || text.length > 500) continue;

								// Only leaf-ish text (element's own text, not just children)
								const childText = Array.from(htmlEl.children)
									.map(c => (c as HTMLElement).textContent?.trim() || '').join('');
								if (childText && text.length - childText.length < 3) continue;

								if (debug.textElements.length < 40) {
									debug.textElements.push({
										tag: `<${htmlEl.tagName.toLowerCase()}>`,
										text: text.substring(0, 80),
										loc: label
									});
								}

								if (text.toLowerCase().includes(nameToFind) && text.length < bestLen) {
									bestMatch = htmlEl;
									bestLen = text.length;
								}
							}
						} catch { /* skip */ }
					}

					// Scan WXT shadow DOM
					const host = document.querySelector('lemon-learning-player');
					if (host?.shadowRoot) {
						debug.shadowElCount = host.shadowRoot.querySelectorAll('*').length;
						scanRoot(host.shadowRoot, 'shadow');
					}

					// Also scan LemonPlayer container if accessible
					const win = window as unknown as Record<string, unknown>;
					const player = win.LemonPlayer as Record<string, unknown> | undefined;
					if (player?.container instanceof HTMLElement) scanRoot(player.container, 'container');
					if (player?.container instanceof ShadowRoot) scanRoot(player.container, 'container');

					if (bestMatch) {
						// Walk up to find nearest clickable ancestor (cursor:pointer, button, a)
						let clickTarget: HTMLElement = bestMatch;
						let el: HTMLElement | null = bestMatch;
						for (let depth = 0; depth < 5 && el; depth++) {
							const cursor = window.getComputedStyle(el).cursor;
							const tag = el.tagName.toLowerCase();
							if (cursor === 'pointer' || tag === 'a' || tag === 'button' || el.getAttribute('role') === 'button') {
								clickTarget = el;
								break;
							}
							el = el.parentElement;
						}

						// Full composed mouse event sequence (works across shadow DOM + with React event delegation)
						const rect = clickTarget.getBoundingClientRect();
						const x = Math.round(rect.left + rect.width / 2);
						const y = Math.round(rect.top + rect.height / 2);
						const opts: MouseEventInit = {
							bubbles: true, cancelable: true, composed: true,
							view: window, clientX: x, clientY: y, button: 0,
						};
						clickTarget.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse', buttons: 1 }));
						clickTarget.dispatchEvent(new MouseEvent('mousedown', { ...opts, buttons: 1 }));
						clickTarget.focus?.();
						clickTarget.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse', buttons: 0 }));
						clickTarget.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
						clickTarget.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));

						// Also try native .click() as backup
						clickTarget.click();

						debug.clicked = `<${clickTarget.tagName.toLowerCase()}> "${clickTarget.textContent?.trim().substring(0, 60)}" @(${x},${y})`;
						return { success: true, debug };
					}

					return {
						success: false,
						error: `Guide "${gName}" not found (attempt ${attemptNum + 1}, ${debug.shadowElCount} shadow els, ${debug.textElements.length} text)`,
						debug
					};
				}
			});

			const res = scanResult?.result as { success: boolean; error?: string; debug?: unknown };
			reportError({
				message: `[playGuide] scan attempt ${attempt}: ${res?.success ? 'FOUND' : res?.error}`,
				metadata: { ...(res?.debug as Record<string, unknown> || {}), guideId, guideName }
			});

			if (res?.success) return res;
			if (attempt === 2) return res ?? { success: false, error: 'No result' };
		} catch (err) {
			if (attempt === 2) return { success: false, error: `Scan failed: ${err}` };
		}
	}

	return { success: false, error: 'All attempts failed' };
}

// ---------------------------------------------------------------------------
// clickNextButton — Click the Next/Suivant button in the LL bubble
// ---------------------------------------------------------------------------

export async function clickNextButton(tabId: number, frameId?: number): Promise<{ success: boolean; error?: string }> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: scriptTarget(tabId, frameId),
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
			func: () => {
				function findBubble(): HTMLElement | null {
					const host = document.querySelector('lemon-learning-player');
					if (host?.shadowRoot) {
						for (const child of Array.from(host.shadowRoot.querySelectorAll('*'))) {
							const s = window.getComputedStyle(child);
							if (s.position === 'fixed' && parseInt(s.zIndex, 10) > 2000000000) {
								const r = child.getBoundingClientRect();
								if (r.width > 120 && r.height > 50 && (child as HTMLElement).innerText?.trim().length > 5)
									return child as HTMLElement;
							}
						}
					}
					return null;
				}

				function simulateClick(el: HTMLElement): void {
					const rect = el.getBoundingClientRect();
					const x = Math.round(rect.left + rect.width / 2);
					const y = Math.round(rect.top + rect.height / 2);
					const opts: MouseEventInit = {
						bubbles: true, cancelable: true, composed: true,
						view: window, clientX: x, clientY: y, button: 0, buttons: 1,
					};
					el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse' }));
					el.dispatchEvent(new MouseEvent('mousedown', opts));
					el.focus?.();
					el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse', buttons: 0 }));
					el.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
					el.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
				}

				const bubble = findBubble();
				if (!bubble) return { success: false, error: 'Bubble not found' };

				const nextTexts = ['suivant', 'next', 'continuer', 'continue', 'compris', 'ok', 'got it', 'commencer', 'start', 'terminer', 'finish', 'fermer', 'close'];
				for (const el of Array.from(bubble.querySelectorAll('button, [role="button"], a, div[class*="action"]'))) {
					const text = (el as HTMLElement).innerText?.trim().toLowerCase() || '';
					if (nextTexts.some(nt => text.includes(nt))) {
						simulateClick(el as HTMLElement);
						return { success: true };
					}
				}
				// Fallback: rightmost clickable element
				const clickables = Array.from(bubble.querySelectorAll('button, [role="button"], a'));
				if (clickables.length > 0) {
					let rightmost: HTMLElement | null = null;
					let maxRight = -Infinity;
					for (const el of clickables) {
						const r = el.getBoundingClientRect();
						if (r.right > maxRight) { maxRight = r.right; rightmost = el as HTMLElement; }
					}
					if (rightmost) { simulateClick(rightmost); return { success: true }; }
				}
				return { success: false, error: 'Next button not found in bubble' };
			}
		});
		return result?.result as { success: boolean; error?: string } ?? { success: false, error: 'No result' };
	} catch (err) {
		return { success: false, error: `Script injection failed: ${err}` };
	}
}

// ---------------------------------------------------------------------------
// findTargetElement — Find and interact with a target element using LL paths
// ---------------------------------------------------------------------------

export async function findAndExecuteAction(
	tabId: number,
	actionType: string,
	targetPaths: unknown,
	frameId?: number
): Promise<{ success: boolean; error?: string; fallbackUsed?: boolean }> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: scriptTarget(tabId, frameId),
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
			args: [actionType, targetPaths as Record<string, unknown> | null],
			func: (action: string, paths: Record<string, unknown> | null) => {
				function simulateClick(el: HTMLElement): void {
					const rect = el.getBoundingClientRect();
					const x = Math.round(rect.left + rect.width / 2);
					const y = Math.round(rect.top + rect.height / 2);
					const opts: MouseEventInit = {
						bubbles: true, cancelable: true, composed: true,
						view: window, clientX: x, clientY: y, button: 0, buttons: 1,
					};
					el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse' }));
					el.dispatchEvent(new MouseEvent('mousedown', opts));
					el.focus?.();
					el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse', buttons: 0 }));
					el.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
					el.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
				}

				function simulateInput(el: HTMLElement, text: string): void {
					if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
						el.focus();
						el.value = '';
						for (const letter of text) {
							el.dispatchEvent(new KeyboardEvent('keydown', { key: letter, bubbles: true }));
							el.dispatchEvent(new InputEvent('input', { bubbles: true, data: letter }));
							el.value += letter;
							el.dispatchEvent(new KeyboardEvent('keyup', { key: letter, bubbles: true }));
						}
						el.dispatchEvent(new Event('change', { bubbles: true }));
					} else if (el.getAttribute('contenteditable') === 'true') {
						el.focus();
						el.textContent = text;
						el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
					}
				}

				// Try to find the target element using LL paths data
				let target: HTMLElement | null = null;

				if (paths) {
					// LL Player uses different path types — try them all
					// CSS selector (most common)
					const cssSelector = (paths.css ?? paths.cssSelector ?? paths.selector) as string | undefined;
					if (cssSelector) {
						try { target = document.querySelector(cssSelector) as HTMLElement | null; } catch { /* invalid selector */ }
					}

					// XPath
					const xpath = (paths.xpath ?? paths.xPath) as string | undefined;
					if (!target && xpath) {
						try {
							const xpathResult = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
							target = xpathResult.singleNodeValue as HTMLElement | null;
						} catch { /* invalid xpath */ }
					}

					// ID-based
					const targetId = (paths.id ?? paths.elementId) as string | undefined;
					if (!target && targetId) {
						target = document.getElementById(targetId) as HTMLElement | null;
					}

					// data-* attribute
					const dataAttr = (paths.dataAttribute ?? paths.data) as string | undefined;
					if (!target && dataAttr) {
						try { target = document.querySelector(`[${dataAttr}]`) as HTMLElement | null; } catch { /* invalid */ }
					}

					// Text-based (last resort from paths)
					const targetText = (paths.text ?? paths.innerText) as string | undefined;
					if (!target && targetText) {
						const textLower = targetText.toLowerCase();
						for (const el of Array.from(document.querySelectorAll('button, a, input, select, [role="button"], [role="link"]'))) {
							if ((el as HTMLElement).innerText?.toLowerCase().includes(textLower)) {
								target = el as HTMLElement;
								break;
							}
						}
					}
				}

				// Fallback: find the element highlighted by the LL Player
				// The player uses a z-index overlay or outline on the target element
				if (!target) {
					const host = document.querySelector('lemon-learning-player');
					if (host?.shadowRoot) {
						// Look for a highlight/beacon element that points to a target
						const beacons = host.shadowRoot.querySelectorAll('[class*="beacon"], [class*="highlight"], [class*="target"]');
						for (const beacon of Array.from(beacons)) {
							const r = beacon.getBoundingClientRect();
							if (r.width > 0 && r.height > 0) {
								// The beacon overlays the target — find what's behind it
								const centerX = r.left + r.width / 2;
								const centerY = r.top + r.height / 2;
								// Temporarily hide the beacon
								const saved = (beacon as HTMLElement).style.pointerEvents;
								(beacon as HTMLElement).style.pointerEvents = 'none';
								const behind = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
								(beacon as HTMLElement).style.pointerEvents = saved;
								if (behind && behind !== document.body && behind !== document.documentElement) {
									target = behind;
									break;
								}
							}
						}
					}
				}

				if (!target) {
					return { success: false, error: 'Target element not found', fallbackUsed: false };
				}

				// Execute the action on the found target
				switch (action) {
					case 'CLICK':
					case 'MOUSEDOWN': {
						simulateClick(target);
						return { success: true };
					}

					case 'HOVER': {
						const rect = target.getBoundingClientRect();
						const x = Math.round(rect.left + rect.width / 2);
						const y = Math.round(rect.top + rect.height / 2);
						const opts: MouseEventInit = { bubbles: true, composed: true, view: window, clientX: x, clientY: y };
						target.dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false }));
						target.dispatchEvent(new MouseEvent('mouseover', opts));
						target.dispatchEvent(new MouseEvent('mousemove', opts));
						return { success: true };
					}

					case 'INPUT': {
						// Smart placeholder based on input type/attributes
						const inputType = target.getAttribute('type')?.toLowerCase() || 'text';
						const placeholder = target.getAttribute('placeholder')?.toLowerCase() || '';
						let text = 'Lorem ipsum';
						if (inputType === 'email' || placeholder.includes('mail')) text = 'test@example.com';
						else if (inputType === 'password') text = 'Test1234!';
						else if (inputType === 'tel' || placeholder.includes('tel') || placeholder.includes('phone')) text = '+33612345678';
						else if (inputType === 'number') text = '42';
						else if (inputType === 'url') text = 'https://example.com';
						else if (placeholder.includes('nom') || placeholder.includes('name')) text = 'Jean Dupont';
						else if (placeholder.includes('search') || placeholder.includes('cherch')) text = 'Test';
						simulateInput(target, text);
						return { success: true };
					}

					case 'CHANGE': {
						if (target instanceof HTMLSelectElement) {
							if (target.options.length > 1) {
								target.selectedIndex = 1;
								target.dispatchEvent(new Event('change', { bubbles: true }));
							}
						} else if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
							target.checked = !target.checked;
							target.dispatchEvent(new Event('change', { bubbles: true }));
							simulateClick(target);
						} else {
							simulateClick(target);
						}
						return { success: true };
					}

					default:
						simulateClick(target);
						return { success: true };
				}
			}
		});
		return result?.result as { success: boolean; error?: string; fallbackUsed?: boolean } ?? { success: false, error: 'No result' };
	} catch (err) {
		return { success: false, error: `Script injection failed: ${err}` };
	}
}

// ---------------------------------------------------------------------------
// answerQuestion — Select a specific answer in a question step by index
// ---------------------------------------------------------------------------

export async function answerQuestion(
	tabId: number,
	frameId?: number,
	answerIndex: number = 0
): Promise<{ success: boolean; error?: string; answersFound?: number }> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: scriptTarget(tabId, frameId),
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
			args: [answerIndex],
			func: (targetIndex: number) => {
				function simulateClick(el: HTMLElement): void {
					const rect = el.getBoundingClientRect();
					const x = Math.round(rect.left + rect.width / 2);
					const y = Math.round(rect.top + rect.height / 2);
					const opts: MouseEventInit = {
						bubbles: true, cancelable: true, composed: true,
						view: window, clientX: x, clientY: y, button: 0, buttons: 1,
					};
					el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse' }));
					el.dispatchEvent(new MouseEvent('mousedown', opts));
					el.focus?.();
					el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse', buttons: 0 }));
					el.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
					el.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
				}

				// Find the bubble
				const host = document.querySelector('lemon-learning-player');
				if (!host?.shadowRoot) return { success: false, error: 'No shadow root', answersFound: 0 };

				let bubble: HTMLElement | null = null;
				for (const child of Array.from(host.shadowRoot.querySelectorAll('*'))) {
					const s = window.getComputedStyle(child);
					if (s.position === 'fixed' && parseInt(s.zIndex, 10) > 2000000000) {
						const r = child.getBoundingClientRect();
						if (r.width > 120 && r.height > 50 && (child as HTMLElement).innerText?.trim().length > 5) {
							bubble = child as HTMLElement;
							break;
						}
					}
				}
				if (!bubble) return { success: false, error: 'Bubble not found', answersFound: 0 };

				// Look for answer options — collect all, sort by vertical position
				const answerEls = bubble.querySelectorAll(
					'[class*="answer"], [class*="choice"], [class*="option"], input[type="radio"], label'
				);
				const sortedAnswers = Array.from(answerEls)
					.map(el => ({ el: el as HTMLElement, top: el.getBoundingClientRect().top }))
					.filter(a => a.top > 0) // visible only
					.sort((a, b) => a.top - b.top);

				if (sortedAnswers.length > 0) {
					const idx = Math.min(targetIndex, sortedAnswers.length - 1);
					simulateClick(sortedAnswers[idx].el);
					return { success: true, answersFound: sortedAnswers.length };
				}

				// Fallback: collect clickable non-navigation elements as answer candidates
				const clickables = bubble.querySelectorAll('button, [role="button"], a');
				const navTexts = ['suivant', 'next', 'précédent', 'previous', 'retour', 'back',
					'terminer', 'finish', 'fermer', 'close', 'commencer', 'start'];
				const answerCandidates = Array.from(clickables)
					.filter(el => {
						const text = (el as HTMLElement).innerText?.trim().toLowerCase() || '';
						return text.length > 0 && !navTexts.some(nt => text.includes(nt));
					})
					.map(el => ({ el: el as HTMLElement, top: el.getBoundingClientRect().top }))
					.filter(a => a.top > 0)
					.sort((a, b) => a.top - b.top);

				if (answerCandidates.length > 0) {
					const idx = Math.min(targetIndex, answerCandidates.length - 1);
					simulateClick(answerCandidates[idx].el);
					return { success: true, answersFound: answerCandidates.length };
				}

				return { success: false, error: 'No answer options found', answersFound: 0 };
			}
		});
		return result?.result as { success: boolean; error?: string; answersFound?: number } ?? { success: false, error: 'No result', answersFound: 0 };
	} catch (err) {
		return { success: false, error: `Script injection failed: ${err}`, answersFound: 0 };
	}
}

// ---------------------------------------------------------------------------
// getStepActionInfo — Analyse le DOM pour détecter l'action attendue (legacy)
// ---------------------------------------------------------------------------

export async function getStepActionInfo(tabId: number, frameId?: number): Promise<StepActionInfo> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: scriptTarget(tabId, frameId),
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
			func: () => {
				try {
					// ----- Helper: find the LL bubble (skip FAB launcher) -----
					function findBubble(): HTMLElement | null {
						const candidates: HTMLElement[] = [];
						const ids = ['lemon-learning-player', 'lemonlearning-player-embed'];
						for (const id of ids) {
							const el = document.getElementById(id);
							if (el?.shadowRoot) {
								for (const child of Array.from(el.shadowRoot.querySelectorAll('*'))) {
									const s = window.getComputedStyle(child);
									if (s.position === 'fixed' && parseInt(s.zIndex, 10) > 2000000000) {
										const r = child.getBoundingClientRect();
										if (r.width > 0 && r.height > 0 && r.width < 600 && r.height < 500)
											candidates.push(child as HTMLElement);
									}
								}
							}
						}
						for (const el of Array.from(document.querySelectorAll('*'))) {
							const s = window.getComputedStyle(el);
							if (s.position === 'fixed' && parseInt(s.zIndex, 10) > 2000000000) {
								const r = el.getBoundingClientRect();
								if (r.width > 0 && r.height > 0 && r.width < 600 && r.height < 500)
									candidates.push(el as HTMLElement);
							}
						}
						if (!candidates.length) return null;
						const withText = candidates.filter(c => (c.innerText?.trim().length || 0) > 5);
						if (withText.length > 0)
							return withText.reduce((a, b) => {
								const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
								return (ra.width * ra.height) > (rb.width * rb.height) ? a : b;
							});
						const notFab = candidates.filter(c => {
							const r = c.getBoundingClientRect();
							return r.width > 120 || r.height > 120;
						});
						return notFab[0] || null;
					}

					// ----- Helper: find Next button in bubble (expanded strategies) -----
					function findNextButton(bubble: HTMLElement): HTMLElement | null {
						// Strategy 1: Text-based (existing)
						const nextTexts = ['suivant', 'next', 'continuer', 'continue', 'compris', 'ok', 'got it', 'commencer', 'start'];
						const allBtns = bubble.querySelectorAll('button, [role="button"], div[class*="action"], a');
						for (const btn of Array.from(allBtns)) {
							const text = (btn as HTMLElement).innerText?.trim().toLowerCase() || '';
							if (nextTexts.some(nt => text.includes(nt))) return btn as HTMLElement;
						}

						// Strategy 2: aria-label
						const ariaLabels = ['suivant', 'next', 'continuer', 'continue', 'forward'];
						for (const label of ariaLabels) {
							const found = bubble.querySelector(`[aria-label*="${label}" i]`) as HTMLElement | null;
							if (found) return found;
						}

						// Strategy 3: SVG arrow/chevron in clickable element
						const svgs = bubble.querySelectorAll('svg');
						let lastSvgButton: HTMLElement | null = null;
						for (const svg of Array.from(svgs)) {
							const parent = svg.closest('button, [role="button"]') || svg.parentElement;
							if (!parent) continue;
							const s = window.getComputedStyle(parent);
							if (s.cursor === 'pointer' || parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button') {
								lastSvgButton = parent as HTMLElement;
							}
						}
						if (lastSvgButton) return lastSvgButton;

						// Strategy 4: Heuristic — rightmost clickable in footer area
						const allClickable = bubble.querySelectorAll('button, [role="button"]');
						if (allClickable.length > 0) {
							let rightmost: HTMLElement | null = null;
							let maxRight = -Infinity;
							for (const el of Array.from(allClickable)) {
								const r = el.getBoundingClientRect();
								if (r.right > maxRight) {
									maxRight = r.right;
									rightmost = el as HTMLElement;
								}
							}
							return rightmost;
						}

						return null;
					}

					// ----- Main logic: text-based action detection -----
					const bubble = findBubble();
					if (!bubble) {
						return {
							actionType: 'unknown' as const,
							hasNextButton: false,
							debugInfo: 'No bubble found',
							instructionText: ''
						};
					}

					const instructionText = (bubble.innerText?.trim() || '').substring(0, 500);
					const textLower = instructionText.toLowerCase();
					const nextBtn = findNextButton(bubble);

					// Pattern matching on instruction text (FR + EN)
					const clickPatterns = /s[ée]lectionn|cliqu|appuy|click|select|press|tap on|choose|choisiss/i;
					const inputPatterns = /saisiss|tap[eé]z|entrez|renseign|[ée]criv|type|enter|fill|write|input/i;
					const checkboxPatterns = /coch|d[ée]coch|check|uncheck|toggle/i;

					let actionType: 'next' | 'click' | 'input' | 'checkbox' | 'unknown';

					if (checkboxPatterns.test(textLower)) {
						actionType = 'checkbox';
					} else if (inputPatterns.test(textLower)) {
						actionType = 'input';
					} else if (clickPatterns.test(textLower)) {
						actionType = 'click';
					} else if (nextBtn) {
						actionType = 'next';
					} else {
						actionType = 'unknown';
					}

					return {
						actionType,
						hasNextButton: !!nextBtn,
						debugInfo: `text-parse: "${textLower.substring(0, 80)}" → ${actionType}`,
						instructionText
					};

				} catch (err) {
					return {
						actionType: 'unknown' as const,
						hasNextButton: false,
						debugInfo: `Error: ${err}`,
						instructionText: ''
					};
				}
			}
		});
		return result?.result as StepActionInfo ?? {
			actionType: 'unknown',
			hasNextButton: false,
			debugInfo: 'No result from script'
		};
	} catch (err) {
		return {
			actionType: 'unknown',
			hasNextButton: false,
			debugInfo: `Script injection failed: ${err}`
		};
	}
}

// ---------------------------------------------------------------------------
// executeStepAction — Exécute l'action appropriée sur la page
// ---------------------------------------------------------------------------

export async function executeStepAction(
	tabId: number,
	actionInfo: StepActionInfo,
	frameId?: number
): Promise<{ success: boolean; error?: string }> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: scriptTarget(tabId, frameId),
			world: 'MAIN' as chrome.scripting.ExecutionWorld,
			args: [actionInfo],
			func: (info: { actionType: string; targetSelector?: string; targetTagName?: string; hasNextButton: boolean }) => {
				try {
					// ----- Helper: find LL bubble (skip FAB) -----
					function findBubble(): HTMLElement | null {
						const candidates: HTMLElement[] = [];
						const ids = ['lemon-learning-player', 'lemonlearning-player-embed'];
						for (const id of ids) {
							const el = document.getElementById(id);
							if (el?.shadowRoot) {
								for (const child of Array.from(el.shadowRoot.querySelectorAll('*'))) {
									const s = window.getComputedStyle(child);
									if (s.position === 'fixed' && parseInt(s.zIndex, 10) > 2000000000) {
										const r = child.getBoundingClientRect();
										if (r.width > 0 && r.height > 0 && r.width < 600 && r.height < 500)
											candidates.push(child as HTMLElement);
									}
								}
							}
						}
						for (const el of Array.from(document.querySelectorAll('*'))) {
							const s = window.getComputedStyle(el);
							if (s.position === 'fixed' && parseInt(s.zIndex, 10) > 2000000000) {
								const r = el.getBoundingClientRect();
								if (r.width > 0 && r.height > 0 && r.width < 600 && r.height < 500)
									candidates.push(el as HTMLElement);
							}
						}
						if (!candidates.length) return null;
						const withText = candidates.filter(c => (c.innerText?.trim().length || 0) > 5);
						if (withText.length > 0)
							return withText.reduce((a, b) => {
								const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
								return (ra.width * ra.height) > (rb.width * rb.height) ? a : b;
							});
						const notFab = candidates.filter(c => {
							const r = c.getBoundingClientRect();
							return r.width > 120 || r.height > 120;
						});
						return notFab[0] || null;
					}

					// ----- Helper: simulate REAL click with composed:true for shadow DOM -----
					function simulateClick(el: HTMLElement): void {
						const rect = el.getBoundingClientRect();
						const x = Math.round(rect.left + rect.width / 2);
						const y = Math.round(rect.top + rect.height / 2);
						const opts: MouseEventInit = {
							bubbles: true, cancelable: true, composed: true,
							view: window, clientX: x, clientY: y,
							screenX: x + window.screenX, screenY: y + window.screenY,
							button: 0, buttons: 1,
						};
						el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse' }));
						el.dispatchEvent(new MouseEvent('mousedown', opts));
						el.focus?.();
						el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse', buttons: 0 }));
						el.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }));
						el.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }));
						console.log(`[LL Bridge] Simulated real click on <${el.tagName.toLowerCase()}>`);
					}

					// ----- Helper: simulate text input (char by char, same as LL Player) -----
					function simulateInput(el: HTMLElement, text: string): void {
						if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
							el.focus();
							el.value = '';

							for (const letter of text) {
								el.dispatchEvent(new KeyboardEvent('keydown', { key: letter, bubbles: true }));
								el.dispatchEvent(new KeyboardEvent('keypress', { key: letter, bubbles: true }));
								el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, data: letter }));
								el.value += letter;
								el.dispatchEvent(new InputEvent('input', { bubbles: true, data: letter }));
								el.dispatchEvent(new KeyboardEvent('keyup', { key: letter, bubbles: true }));
							}

							el.dispatchEvent(new Event('change', { bubbles: true }));
							console.log(`[LL Bridge] Typed "${text}" into <${el.tagName.toLowerCase()}>`);
						} else if (el.getAttribute('contenteditable') === 'true') {
							el.focus();
							el.textContent = text;
							el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
							console.log(`[LL Bridge] Set contenteditable text to "${text}"`);
						}
					}

					// ----- Helper: find Next button in bubble (expanded strategies) -----
					function findNextBtn(bubble: HTMLElement): HTMLElement | null {
						// Strategy 1: Text-based
						const nextTexts = ['suivant', 'next', 'continuer', 'continue', 'compris', 'ok', 'got it', 'commencer', 'start'];
						const allBtns = bubble.querySelectorAll('button, [role="button"], div[class*="action"], a');
						for (const btn of Array.from(allBtns)) {
							const text = (btn as HTMLElement).innerText?.trim().toLowerCase() || '';
							if (nextTexts.some(nt => text.includes(nt))) return btn as HTMLElement;
						}
						// Strategy 2: aria-label
						const ariaLabels = ['suivant', 'next', 'continuer', 'continue', 'forward'];
						for (const label of ariaLabels) {
							const found = bubble.querySelector(`[aria-label*="${label}" i]`) as HTMLElement | null;
							if (found) return found;
						}
						// Strategy 3: SVG in clickable parent (last = rightmost = next)
						const svgs = bubble.querySelectorAll('svg');
						let lastSvgBtn: HTMLElement | null = null;
						for (const svg of Array.from(svgs)) {
							const parent = svg.closest('button, [role="button"]') || svg.parentElement;
							if (!parent) continue;
							const s = window.getComputedStyle(parent);
							if (s.cursor === 'pointer' || parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button') {
								lastSvgBtn = parent as HTMLElement;
							}
						}
						if (lastSvgBtn) return lastSvgBtn;
						// Strategy 4: Rightmost clickable element
						const allClickable = bubble.querySelectorAll('button, [role="button"]');
						if (allClickable.length > 0) {
							let rightmost: HTMLElement | null = null;
							let maxRight = -Infinity;
							for (const el of Array.from(allClickable)) {
								const r = el.getBoundingClientRect();
								if (r.right > maxRight) { maxRight = r.right; rightmost = el as HTMLElement; }
							}
							return rightmost;
						}
						return null;
					}

					function clickNextButton(): boolean {
						const bubble = findBubble();
						if (!bubble) return false;
						const btn = findNextBtn(bubble);
						if (!btn) return false;
						simulateClick(btn);
						console.log(`[LL Bridge] Clicked Next button: "${btn.innerText?.trim().substring(0, 30) || 'SVG/icon'}"`);
						return true;
					}

					// ----- Execute action based on type -----
					switch (info.actionType) {
						case 'next': {
							const clicked = clickNextButton();
							return { success: clicked, error: clicked ? undefined : 'Next button not found' };
						}

						case 'click': {
							if (!info.targetSelector) {
								return { success: false, error: 'No target selector for click action' };
							}
							const target = document.querySelector(info.targetSelector) as HTMLElement | null;
							if (!target) {
								// Fallback: try clicking Next if available
								if (info.hasNextButton) {
									const clicked = clickNextButton();
									return { success: clicked, error: clicked ? undefined : 'Target not found, Next fallback failed' };
								}
								return { success: false, error: `Target not found: ${info.targetSelector}` };
							}
							simulateClick(target);
							return { success: true };
						}

						case 'input': {
							if (!info.targetSelector) {
								return { success: false, error: 'No target selector for input action' };
							}
							const target = document.querySelector(info.targetSelector) as HTMLElement | null;
							if (!target) {
								return { success: false, error: `Target not found: ${info.targetSelector}` };
							}
							// Use placeholder text for POC
							const placeholders: Record<string, string> = {
								email: 'test@example.com',
								password: 'Test1234!',
								tel: '+33612345678',
								number: '42',
								url: 'https://example.com',
								search: 'Test',
								date: '2026-01-15'
							};
							const inputType = target.getAttribute('type')?.toLowerCase() || 'text';
							const placeholderAttr = target.getAttribute('placeholder') || '';
							let text = placeholders[inputType] || 'Lorem ipsum';

							// Try to be smart about the placeholder
							if (placeholderAttr.toLowerCase().includes('nom') || placeholderAttr.toLowerCase().includes('name')) {
								text = 'Jean Dupont';
							} else if (placeholderAttr.toLowerCase().includes('email') || placeholderAttr.toLowerCase().includes('mail')) {
								text = 'test@example.com';
							}

							if (info.targetTagName === 'select') {
								// For <select>, pick the second option (first is often placeholder)
								const select = target as HTMLSelectElement;
								if (select.options.length > 1) {
									select.selectedIndex = 1;
									select.dispatchEvent(new Event('change', { bubbles: true }));
									console.log(`[LL Bridge] Selected option index 1 in <select>`);
								}
								return { success: true };
							}

							simulateInput(target, text);
							return { success: true };
						}

						case 'checkbox': {
							if (!info.targetSelector) {
								return { success: false, error: 'No target selector for checkbox action' };
							}
							const target = document.querySelector(info.targetSelector) as HTMLInputElement | null;
							if (!target) {
								return { success: false, error: `Target not found: ${info.targetSelector}` };
							}
							target.checked = !target.checked;
							target.dispatchEvent(new Event('change', { bubbles: true }));
							target.dispatchEvent(new Event('input', { bubbles: true }));
							simulateClick(target);
							console.log(`[LL Bridge] Toggled checkbox to ${target.checked}`);
							return { success: true };
						}

						default:
							return { success: false, error: `Unknown action type: ${info.actionType}` };
					}
				} catch (err) {
					return { success: false, error: String(err) };
				}
			}
		});
		return result?.result as { success: boolean; error?: string } ?? { success: false, error: 'No result' };
	} catch (err) {
		return { success: false, error: `Script injection failed: ${err}` };
	}
}
