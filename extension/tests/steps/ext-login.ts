/**
 * Lemon Lab extension login step.
 * Uses Playwright (needs chrome-extension:// protocol).
 */

import type { BrowserContext } from 'playwright';
import { openPopup, sleep, screenshot } from '../stagehand-helpers.js';

export async function loginToLemonLab(ctx: BrowserContext, extensionId: string): Promise<boolean> {
	console.log('  Logging into Lemon Lab extension...');

	const popup = await openPopup(ctx, extensionId);

	try {
		const bodyText = await popup.textContent('body') || '';

		if (bodyText.includes('Capture') || bodyText.includes('projet')) {
			console.log('  Already logged in');
			await popup.close();
			return true;
		}

		const localBtn = popup.locator('button:has-text("Connexion locale")').first();
		if (await localBtn.count() === 0) {
			console.log('  No "Connexion locale" button found');
			console.log('  Popup text:', bodyText.substring(0, 200));
			await popup.close();
			return false;
		}

		await localBtn.click();
		console.log('  Clicked "Connexion locale"');

		await sleep(3000);

		const afterText = await popup.textContent('body') || '';
		const loggedIn = afterText.includes('Capture') || afterText.includes('projet') || afterText.includes('Lemon Lab v');

		if (afterText.includes('Erreur') || afterText.includes('Échec')) {
			console.log('  Login error:', afterText.substring(0, 200));
			await popup.screenshot({ path: screenshot('lemonlab-login-error') });
			await popup.close();
			return false;
		}

		if (loggedIn) {
			console.log('  Lemon Lab login OK');
		} else {
			console.log('  Login state unclear, continuing');
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
