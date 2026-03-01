/**
 * LL Player login step — uses Stagehand for shadow DOM interaction.
 * Stagehand auto-pierces shadow DOM, so no manual querySelector chains.
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';
import { LL_USER, LL_PASS, sleep, clearLLPlayerData } from '../stagehand-helpers.js';

export async function loginToLLPlayer(stagehand: Stagehand): Promise<boolean> {
	if (!LL_USER || !LL_PASS) {
		console.log('  No LL credentials in .env');
		return false;
	}

	console.log('  Logging into LL Player...');
	const page = stagehand.context.pages()[0];

	for (let attempt = 0; attempt < 3; attempt++) {
		if (attempt > 0) {
			console.log(`    Retry ${attempt + 1}/3...`);
			// Clear LL data and reload on retry
			await clearLLPlayerData(page);
			await page.goto(await page.url());
			await sleep(8000);
		}

		try {
			// Wait for the FAB to appear (Stagehand observe is resilient)
			console.log('    Waiting for LL Player FAB...');
			let fabFound = false;
			for (let i = 0; i < 15; i++) {
				try {
					const actions = await stagehand.observe('Find the Lemon Learning floating action button (a small circular button, usually in the bottom-right corner of the page)');
					if (actions.length > 0) { fabFound = true; break; }
				} catch { /* not ready yet */ }
				await sleep(2000);
			}

			if (!fabFound) {
				console.log('    FAB not found after 30s');
				if (attempt < 2) continue;
				return false;
			}

			// Check current state
			const state = await stagehand.extract(
				'Look at the Lemon Learning player panel (inside the shadow DOM of the lemon-learning-player element). Is it showing: a login form with email input, guide content (list of guides), or just the floating button with no panel open?',
				z.object({
					state: z.enum(['login-form', 'logged-in', 'fab-only', 'unknown']),
				})
			);
			console.log('    Panel state:', state.state);

			if (state.state === 'logged-in') {
				console.log('  LL Player already logged in');
				return true;
			}

			// Open panel if only FAB visible
			if (state.state === 'fab-only') {
				await stagehand.act('Click the Lemon Learning floating action button to open the panel');
				await sleep(2000);
			}

			// Login flow: email → continue → password → connexion
			if (state.state === 'login-form' || state.state === 'fab-only') {
				await stagehand.act(`Type "${LL_USER}" into the email input field in the Lemon Learning panel`);
				await sleep(500);

				await stagehand.act('Click the Continue button (or "Continuer") in the Lemon Learning panel');
				await sleep(2000);

				await stagehand.act(`Type "${LL_PASS}" into the password input field in the Lemon Learning panel`);
				await sleep(500);

				await stagehand.act('Click the login button (labeled "Connexion", "Se connecter", or "Login") in the Lemon Learning panel');
				await sleep(5000);

				// Verify login succeeded
				const afterState = await stagehand.extract(
					'After logging in, check the Lemon Learning player panel. Does it show guide content (list of guides/sections) or still a login form?',
					z.object({
						loggedIn: z.boolean().describe('true if guides/sections are visible, false if still showing login form'),
					})
				);

				if (afterState.loggedIn) {
					console.log('  LL Player login OK');
					return true;
				}
				console.log('    Login did not succeed');
			}
		} catch (err) {
			console.error(`    LL login attempt ${attempt + 1} failed:`, String(err).substring(0, 200));
		}
	}

	return false;
}
