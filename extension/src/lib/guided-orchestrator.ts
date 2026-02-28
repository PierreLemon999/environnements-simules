import { PAGE_STATUS, STORAGE_KEYS, type CapturedPage, type GuidedProgress, type LLGuide } from './constants';
import {
	captureCurrentPage,
	uploadCapturedPage,
	addCapturedPageToState,
	updatePageStatus,
	getCaptureState,
	updateCaptureState
} from './capture';
import { buildSelfContainedPage, getLastFaviconDataUri } from './resource-fetcher';
import { v4 as uuidv4 } from './uuid';
import api from './api';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let isRunning = false;
let currentTabId: number | null = null;
let guides: LLGuide[] = [];
let currentGuideIndex = 0;
let currentStepIndex = 0;
let executionMode: 'manual' | 'auto' = 'manual';
let capturedPageCount = 0;
let isProcessingStep = false;
let bubbleWaitTimer: ReturnType<typeof setTimeout> | null = null;

const BUBBLE_WAIT_TIMEOUT_MS = 30000;
const STEP_TRANSITION_DELAY_MS = 800;
const CAPTURE_SETTLE_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function startGuidedCapture(
	tabId: number,
	selectedGuides: LLGuide[],
	mode: 'manual' | 'auto'
): Promise<void> {
	if (isRunning) {
		throw new Error('Une capture guidée est déjà en cours');
	}

	guides = selectedGuides.filter(g => g.selected);
	if (guides.length === 0) {
		throw new Error('Aucun guide sélectionné');
	}

	currentTabId = tabId;
	currentGuideIndex = 0;
	currentStepIndex = 0;
	executionMode = mode;
	capturedPageCount = 0;
	isRunning = true;
	isProcessingStep = false;

	// Update capture state
	await updateCaptureState({
		mode: 'guided',
		isRunning: true,
		isPaused: false,
		guided: buildProgress('waiting_bubble')
	});

	// Create capture job on backend
	const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
	const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
	if (version?.id) {
		const totalSteps = guides.reduce((sum, g) => sum + g.stepCount, 0);
		try {
			const jobResult = await api.post<{ data: { id: string } }>(
				`/versions/${version.id}/capture-jobs`,
				{
					mode: 'guided',
					targetPageCount: totalSteps || guides.length
				}
			);
			if (jobResult?.data?.id) {
				await updateCaptureState({ jobId: jobResult.data.id });
			}
		} catch {
			// Non-critical
		}
	}

	// Start observing the bubble in the content script
	try {
		await chrome.tabs.sendMessage(tabId, { type: 'OBSERVE_LL_BUBBLE' });
	} catch (err) {
		console.warn('[Guided] Failed to start bubble observer:', err);
	}

	// Set a timeout for first bubble appearance
	startBubbleWaitTimer();

	console.log(`[Guided] Started: ${guides.length} guides, mode=${mode}`);
}

export async function stopGuidedCapture(): Promise<void> {
	console.log('[Guided] Stopping...');

	isRunning = false;
	clearBubbleWaitTimer();

	// Stop observing the bubble
	if (currentTabId !== null) {
		try {
			await chrome.tabs.sendMessage(currentTabId, { type: 'STOP_OBSERVE_LL_BUBBLE' });
			// Restore bubble visibility in case it was hidden
			await chrome.tabs.sendMessage(currentTabId, { type: 'SHOW_LL_BUBBLE' });
		} catch {
			// Tab may have been closed
		}
	}

	// Finalize capture job
	const state = await getCaptureState();
	if (state.jobId) {
		const doneCount = state.pages.filter(p => p.status === PAGE_STATUS.DONE).length;
		await api.put(`/capture-jobs/${state.jobId}`, {
			status: 'done',
			pagesCaptured: doneCount
		}).catch(() => {});
	}

	await updateCaptureState({
		isRunning: false,
		isPaused: false,
		jobId: undefined,
		guided: undefined
	});

	currentTabId = null;
	guides = [];
}

/**
 * Called by the service worker when the content script detects a bubble change.
 */
export async function onBubbleChanged(data: {
	bubblePresent: boolean;
	contentHash: string;
	hasNextButton?: boolean;
	stepIndicator?: string;
	title?: string;
}): Promise<void> {
	if (!isRunning || isProcessingStep) return;

	clearBubbleWaitTimer();

	if (!data.bubblePresent) {
		// Bubble disappeared — check if guide is done
		console.log('[Guided] Bubble disappeared — guide may be complete');
		await handleGuideCompleted();
		return;
	}

	// Parse step indicator if available (e.g. "2/5")
	if (data.stepIndicator) {
		const parts = data.stepIndicator.split('/');
		if (parts.length === 2) {
			currentStepIndex = parseInt(parts[0], 10) - 1; // 0-indexed
			const detectedTotal = parseInt(parts[1], 10);
			if (detectedTotal > 0 && guides[currentGuideIndex]) {
				guides[currentGuideIndex].stepCount = detectedTotal;
			}
		}
	}

	// A new step appeared — capture it
	await captureCurrentStep();

	// In auto mode, advance to next step after capture
	if (executionMode === 'auto' && isRunning) {
		await sleep(STEP_TRANSITION_DELAY_MS);
		await advanceToNextStep();
	}
}

export function isGuidedCaptureRunning(): boolean {
	return isRunning;
}

// ---------------------------------------------------------------------------
// Internal — Capture
// ---------------------------------------------------------------------------

async function captureCurrentStep(): Promise<void> {
	if (!isRunning || currentTabId === null) return;

	isProcessingStep = true;
	const tabId = currentTabId;
	const guideName = guides[currentGuideIndex]?.name || 'Guide';
	const LOG = '[Guided Capture]';

	console.log(`${LOG} Capturing step ${currentStepIndex + 1} of guide "${guideName}"`);

	await updateCaptureState({
		guided: buildProgress('capturing')
	});

	// Wait for DOM to stabilize (bubble content just changed)
	await sleep(CAPTURE_SETTLE_DELAY_MS);

	// Hide the bubble before capture
	try {
		await chrome.tabs.sendMessage(tabId, { type: 'HIDE_LL_BUBBLE' });
		await sleep(200); // Let the browser repaint
	} catch (err) {
		console.warn(`${LOG} Failed to hide bubble:`, err);
	}

	const localId = uuidv4();
	const page: CapturedPage = {
		id: '',
		localId,
		title: `${guideName} — Étape ${currentStepIndex + 1}`,
		url: '',
		fileSize: 0,
		status: PAGE_STATUS.CAPTURING,
		capturedAt: new Date().toISOString()
	};

	await addCapturedPageToState(page);

	try {
		// Collect DOM
		const collected = await captureCurrentPage(tabId);
		await updatePageStatus(localId, PAGE_STATUS.UPLOADING, {
			title: collected.title || page.title,
			url: collected.url
		});

		// Build self-contained HTML + screenshot
		const [selfContainedHtml, screenshotDataUrl] = await Promise.all([
			buildSelfContainedPage(collected.html, collected.resources, collected.url),
			chrome.tabs.captureVisibleTab({ format: 'png' }).catch(() => null)
		]);

		let screenshotBlob: Blob | null = null;
		if (screenshotDataUrl) {
			try {
				const resp = await fetch(screenshotDataUrl);
				screenshotBlob = await resp.blob();
			} catch { /* ignore */ }
		}

		// Upload
		const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
		const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
		if (!version?.id) throw new Error('Aucune version sélectionnée');

		const result = await uploadCapturedPage(
			version.id,
			{ html: selfContainedHtml, title: collected.title || page.title, url: collected.url },
			'guided',
			screenshotBlob,
			getLastFaviconDataUri()
		);

		let urlPath: string | undefined;
		try {
			const parsedUrl = new URL(collected.url);
			urlPath = parsedUrl.pathname + parsedUrl.search;
		} catch { /* keep undefined */ }

		await updatePageStatus(localId, PAGE_STATUS.DONE, {
			id: result.id,
			fileSize: result.fileSize,
			urlPath
		});

		capturedPageCount++;
		console.log(`${LOG} Step captured: "${collected.title}" (${capturedPageCount} total)`);

		// Update capture job progress
		const state = await getCaptureState();
		if (state.jobId) {
			const doneCount = state.pages.filter(p => p.status === PAGE_STATUS.DONE).length;
			await api.put(`/capture-jobs/${state.jobId}`, {
				pagesCaptured: doneCount,
				status: 'running'
			}).catch(() => {});
		}
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
		console.error(`${LOG} Capture failed:`, errorMsg);
		await updatePageStatus(localId, PAGE_STATUS.ERROR, { error: errorMsg });
	}

	// Restore bubble visibility
	try {
		await chrome.tabs.sendMessage(tabId, { type: 'SHOW_LL_BUBBLE' });
	} catch {
		// Tab may have navigated
	}

	isProcessingStep = false;

	await updateCaptureState({
		guided: buildProgress('idle')
	});
}

// ---------------------------------------------------------------------------
// Internal — Navigation
// ---------------------------------------------------------------------------

async function advanceToNextStep(): Promise<void> {
	if (!isRunning || currentTabId === null) return;

	const LOG = '[Guided]';

	await updateCaptureState({
		guided: buildProgress('advancing')
	});

	// Click the Next button
	try {
		const result = await chrome.tabs.sendMessage(currentTabId, { type: 'CLICK_LL_NEXT' });

		if (!result?.clicked) {
			console.log(`${LOG} No Next button found — guide may be complete`);
			await handleGuideCompleted();
			return;
		}

		currentStepIndex++;
		console.log(`${LOG} Clicked Next → step ${currentStepIndex + 1}`);

		// Wait for bubble content to update (the MutationObserver will trigger onBubbleChanged)
		startBubbleWaitTimer();
	} catch (err) {
		console.error(`${LOG} Failed to click Next:`, err);
		// The tab may have navigated (cross-page guide)
		// Re-inject the observer after a delay
		await sleep(2000);
		if (isRunning && currentTabId !== null) {
			try {
				await chrome.tabs.sendMessage(currentTabId, { type: 'OBSERVE_LL_BUBBLE' });
				startBubbleWaitTimer();
			} catch {
				console.error(`${LOG} Cannot re-inject observer — stopping`);
				await stopGuidedCapture();
			}
		}
	}
}

async function handleGuideCompleted(): Promise<void> {
	const LOG = '[Guided]';
	const completedGuide = guides[currentGuideIndex];
	console.log(`${LOG} Guide "${completedGuide?.name}" completed`);

	currentGuideIndex++;
	currentStepIndex = 0;

	if (currentGuideIndex >= guides.length) {
		// All guides completed
		console.log(`${LOG} All ${guides.length} guides completed. Total pages: ${capturedPageCount}`);
		await updateCaptureState({
			guided: buildProgress('done')
		});
		await sleep(1500); // Let the UI show "done" briefly
		await stopGuidedCapture();
		return;
	}

	// More guides to capture — update progress and wait for next bubble
	console.log(`${LOG} Moving to guide ${currentGuideIndex + 1}/${guides.length}: "${guides[currentGuideIndex].name}"`);
	await updateCaptureState({
		guided: buildProgress('waiting_bubble')
	});
	startBubbleWaitTimer();
}

// ---------------------------------------------------------------------------
// Internal — Timers & Helpers
// ---------------------------------------------------------------------------

function startBubbleWaitTimer(): void {
	clearBubbleWaitTimer();
	bubbleWaitTimer = setTimeout(async () => {
		if (isRunning) {
			console.warn('[Guided] Bubble wait timeout — stopping');
			await stopGuidedCapture();
		}
	}, BUBBLE_WAIT_TIMEOUT_MS);
}

function clearBubbleWaitTimer(): void {
	if (bubbleWaitTimer) {
		clearTimeout(bubbleWaitTimer);
		bubbleWaitTimer = null;
	}
}

function buildProgress(status: GuidedProgress['status']): GuidedProgress {
	const currentGuide = guides[currentGuideIndex];
	return {
		currentGuideIndex,
		totalGuides: guides.length,
		currentGuideName: currentGuide?.name || 'Guide',
		currentStepIndex,
		totalSteps: currentGuide?.stepCount || 0,
		executionMode,
		capturedPages: capturedPageCount,
		status
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Tab navigation listener — re-inject observer after page navigation
// ---------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
	if (!isRunning || tabId !== currentTabId) return;
	if (changeInfo.status === 'complete') {
		// Page loaded (possibly cross-page guide step) — re-inject observer
		console.log('[Guided] Tab navigated — re-injecting bubble observer');
		await sleep(1000); // Wait for LL Player to re-initialize
		try {
			await chrome.tabs.sendMessage(tabId, { type: 'OBSERVE_LL_BUBBLE' });
		} catch (err) {
			console.warn('[Guided] Failed to re-inject observer after navigation:', err);
		}
	}
});
