import { PAGE_STATUS, STORAGE_KEYS, type CapturedPage } from './constants';
import {
	captureCurrentPage,
	uploadCapturedPage,
	addCapturedPageToState,
	updatePageStatus,
	getCaptureState,
	updateCaptureState
} from './capture';
import { v4 as uuidv4 } from './uuid';
import api from './api';

export interface GuideStep {
	id: string;
	title: string;
	description?: string;
	targetUrl?: string;
	selector?: string;
	order: number;
}

export interface Guide {
	id: string;
	name: string;
	versionId: string;
	steps: GuideStep[];
}

interface GuidedCaptureSession {
	guide: Guide;
	currentStepIndex: number;
	capturedSteps: Map<string, string>; // stepId -> pageLocalId
}

let activeSession: GuidedCaptureSession | null = null;

/**
 * Start a guided capture session following a guide's steps.
 */
export async function startGuidedCapture(guide: Guide): Promise<void> {
	activeSession = {
		guide,
		currentStepIndex: 0,
		capturedSteps: new Map()
	};

	await updateCaptureState({
		mode: 'guided',
		isRunning: true,
		isPaused: false,
		targetPageCount: guide.steps.length
	});
}

/**
 * Get the current step of the guided capture.
 */
export function getCurrentStep(): GuideStep | null {
	if (!activeSession) return null;
	return activeSession.guide.steps[activeSession.currentStepIndex] || null;
}

/**
 * Get the current step index.
 */
export function getCurrentStepIndex(): number {
	return activeSession?.currentStepIndex ?? 0;
}

/**
 * Get the total number of steps.
 */
export function getTotalSteps(): number {
	return activeSession?.guide.steps.length ?? 0;
}

/**
 * Capture the current page for the current guided step.
 */
export async function captureGuidedStep(tabId: number): Promise<CapturedPage | null> {
	if (!activeSession) return null;

	const step = getCurrentStep();
	if (!step) return null;

	const state = await getCaptureState();
	const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
	const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
	if (!version?.id) {
		throw new Error('Aucune version sélectionnée');
	}

	const localId = uuidv4();

	const page: CapturedPage = {
		id: '',
		localId,
		title: step.title || `Étape ${activeSession.currentStepIndex + 1}`,
		url: '',
		fileSize: 0,
		status: PAGE_STATUS.CAPTURING,
		capturedAt: new Date().toISOString()
	};

	await addCapturedPageToState(page);

	try {
		// Highlight the target element if a selector is provided
		if (step.selector) {
			await chrome.tabs.sendMessage(tabId, {
				type: 'HIGHLIGHT_ELEMENT',
				selector: step.selector
			});
		}

		const captured = await captureCurrentPage(tabId);
		await updatePageStatus(localId, PAGE_STATUS.UPLOADING, {
			title: `${step.title} — ${captured.title}`,
			url: captured.url
		});

		const result = await uploadCapturedPage(version.id, captured, 'guided');
		await updatePageStatus(localId, PAGE_STATUS.DONE, {
			id: result.id,
			fileSize: result.fileSize
		});

		// Track step-to-page mapping
		activeSession.capturedSteps.set(step.id, localId);

		// Remove highlights
		await chrome.tabs.sendMessage(tabId, { type: 'REMOVE_HIGHLIGHTS' }).catch(() => {});

		return (await getCaptureState()).pages.find((p) => p.localId === localId) || null;
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
		await updatePageStatus(localId, PAGE_STATUS.ERROR, { error: errorMsg });
		throw err;
	}
}

/**
 * Move to the next step.
 */
export async function nextStep(): Promise<GuideStep | null> {
	if (!activeSession) return null;

	activeSession.currentStepIndex++;

	if (activeSession.currentStepIndex >= activeSession.guide.steps.length) {
		await finishGuidedCapture();
		return null;
	}

	return getCurrentStep();
}

/**
 * Move to the previous step.
 */
export function previousStep(): GuideStep | null {
	if (!activeSession) return null;
	if (activeSession.currentStepIndex > 0) {
		activeSession.currentStepIndex--;
	}
	return getCurrentStep();
}

/**
 * Finish the guided capture session.
 */
export async function finishGuidedCapture(): Promise<void> {
	if (!activeSession) return;

	await updateCaptureState({
		isRunning: false,
		isPaused: false
	});

	activeSession = null;
}

/**
 * Check if there's an active guided session.
 */
export function isGuidedSessionActive(): boolean {
	return activeSession !== null;
}
