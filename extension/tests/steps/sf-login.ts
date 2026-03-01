/**
 * Salesforce login step — uses Stagehand for form interaction.
 * MFA uses file-based system (proven to work).
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import {
	SF_URL, SF_USER, SF_PASS,
	sleep, waitForMfaCode, isMfaPage, isLoggedIntoSalesforce, screenshot,
} from '../stagehand-helpers.js';

async function handleMfa(stagehand: Stagehand): Promise<boolean> {
	console.log('  MFA/TOTP verification required');

	try {
		// Try switching to email verification
		try {
			await stagehand.act('Click the link to use a different verification method');
			await sleep(2000);
		} catch { /* may not exist */ }

		// Select email radio option
		try {
			await stagehand.act('Select the email verification option (the radio button for receiving a code by email)');
			await sleep(1000);
		} catch { /* may already be selected */ }

		// Click Continue
		try {
			await stagehand.act('Click the Continue button to send the verification code');
			await sleep(3000);
		} catch { /* may auto-submit */ }

		// Wait for code via file
		const code = await waitForMfaCode();
		console.log('    Got MFA code:', code);

		// Check if already past MFA
		const page = stagehand.context.pages()[0];
		const url = await page.url();
		if (isLoggedIntoSalesforce(url)) {
			console.log('  Already past MFA (logged in during wait)');
			return true;
		}

		// Fill code
		await stagehand.act(`Type the verification code ${code} into the code input field`);
		await sleep(500);

		// Click Verify
		await stagehand.act('Click the Verify button to submit the code');
		await sleep(5000);

		const afterUrl = await stagehand.context.pages()[0].url();
		if (isLoggedIntoSalesforce(afterUrl)) {
			console.log('  MFA passed');
			return true;
		}

		console.log('  MFA may have failed, URL:', afterUrl);
		return !isMfaPage(afterUrl);
	} catch (err) {
		console.error('  MFA failed:', err);
		return false;
	}
}

export async function loginToSalesforce(stagehand: Stagehand): Promise<boolean> {
	console.log('  Logging into Salesforce...');

	const page = stagehand.context.pages()[0];
	await page.goto(SF_URL);
	await sleep(2000);

	const url = await page.url();

	if (isLoggedIntoSalesforce(url)) {
		console.log('  Already logged in');
		return true;
	}
	if (isMfaPage(url)) return handleMfa(stagehand);

	if (!SF_USER || !SF_PASS) {
		console.error('  No Salesforce credentials in .env');
		return false;
	}

	try {
		await stagehand.act(`Type "${SF_USER}" into the username field`);
		await stagehand.act(`Type "${SF_PASS}" into the password field`);
		await stagehand.act('Click the Log In button');

		await sleep(5000);

		const afterUrl = await page.url();
		if (isLoggedIntoSalesforce(afterUrl)) {
			console.log('  SF login OK');
			return true;
		}
		if (isMfaPage(afterUrl)) return handleMfa(stagehand);

		console.log('  Login result unclear, URL:', afterUrl);
		return false;
	} catch (err) {
		console.error('  SF login error:', err);
		return false;
	}
}
