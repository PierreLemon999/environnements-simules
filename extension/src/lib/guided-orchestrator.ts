import {
	PAGE_STATUS, STORAGE_KEYS,
	type CapturedPage, type GuidedProgress, type LLGuide, type LLGuideStep, type RunPlan
} from './constants';
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
import api, { reportError } from './api';
import {
	playGuide,
	clickNextButton,
	findAndExecuteAction,
	answerQuestion,
	inspectPlayer
} from './ll-player-bridge';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUBBLE_WAIT_TIMEOUT_MS = 30000;
const STEP_TRANSITION_DELAY_MS = 800;
const CAPTURE_SETTLE_DELAY_MS = 500;
const MAX_RUNS_PER_GUIDE = 30;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let isRunning = false;
let currentTabId: number | null = null;
let llFrameId: number = 0;
let guides: LLGuide[] = [];
let currentGuideIndex = 0;
let currentStepIndex = 0;
let executionMode: 'manual' | 'auto' = 'manual';
let capturedPageCount = 0;
let isProcessingStep = false;
let bubbleWaitTimer: ReturnType<typeof setTimeout> | null = null;

// Multi-run state
let guideRunPlans: RunPlan[] = [];
let currentRunIndex = 0;
let currentRunPlan: RunPlan | null = null;

/** Send a message to the content script in the LL Player's frame. */
function sendToLLFrame(tabId: number, message: Record<string, unknown>): Promise<unknown> {
	return chrome.tabs.sendMessage(tabId, message, llFrameId ? { frameId: llFrameId } : undefined);
}

// ---------------------------------------------------------------------------
// Run Plan computation — Multi-branch analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a guide's step graph to determine how many runs are needed
 * to capture all question-driven branches.
 *
 * Logic:
 * 1. Find all question steps that have a step_key and multiple answers
 * 2. Find all condition steps with condition_type === 'question'
 * 3. Identify which questions are referenced by conditions
 * 4. Generate a cartesian product of answer indices for influential questions
 * 5. For non-influential questions (no condition references them), always pick index 0
 * 6. Cap at MAX_RUNS_PER_GUIDE
 */
export function computeRunPlans(steps: LLGuideStep[] | undefined): RunPlan[] {
	if (!steps || steps.length === 0) {
		return [{ answers: {}, label: 'Standard' }];
	}

	// 1. Collect question steps with step_key and multiple answers
	const questionSteps = steps.filter(
		s => s.stepType === 'question' && s.stepKey && s.question && s.question.answers.length > 1
	);

	if (questionSteps.length === 0) {
		return [{ answers: {}, label: 'Standard' }];
	}

	// 2. Collect condition branches of type 'question'
	const questionConditions: Array<{ conditionContent: string }> = [];
	for (const step of steps) {
		if (step.stepType === 'condition' && step.conditions) {
			for (const cond of step.conditions) {
				if (cond.conditionType === 'question') {
					questionConditions.push(cond);
				}
			}
		}
	}

	// 3. Identify which questions are referenced by conditions
	// condition_content is a JSON string that references the question's step_key or question id
	const influentialQuestions = questionSteps.filter(q => {
		const stepKey = q.stepKey!;
		const questionId = q.question!.id;
		return questionConditions.some(c => {
			const content = c.conditionContent;
			return content.includes(stepKey) ||
				content.includes(String(questionId)) ||
				content.includes(`"${stepKey}"`) ||
				content.includes(`"${questionId}"`);
		});
	});

	// 4. All questions with multiple answers get varied (including non-influential ones)
	// because even without explicit condition references, different answers may lead
	// to different user experiences worth capturing
	const questionsToVary = influentialQuestions.length > 0
		? influentialQuestions
		: questionSteps; // If no conditions found, still vary all questions

	if (questionsToVary.length === 0) {
		return [{ answers: {}, label: 'Standard' }];
	}

	// 5. Generate cartesian product, capped at MAX_RUNS_PER_GUIDE
	const answerCounts = questionsToVary.map(q => q.question!.answers.length);
	const totalCombinations = answerCounts.reduce((a, b) => a * b, 1);
	const cappedTotal = Math.min(totalCombinations, MAX_RUNS_PER_GUIDE);

	const plans: RunPlan[] = [];

	for (let combo = 0; combo < cappedTotal; combo++) {
		const answers: Record<string, number> = {};
		const labelParts: string[] = [];
		let remainder = combo;

		for (let qi = questionsToVary.length - 1; qi >= 0; qi--) {
			const q = questionsToVary[qi];
			const ansCount = q.question!.answers.length;
			const ansIdx = remainder % ansCount;
			remainder = Math.floor(remainder / ansCount);
			answers[q.stepKey!] = ansIdx;

			const ansTitle = q.question!.answers[ansIdx]?.title || `Option ${ansIdx + 1}`;
			labelParts.unshift(`${q.title || q.stepKey || `Q${qi + 1}`}=${ansTitle}`);
		}

		plans.push({
			answers,
			label: plans.length === 0 && cappedTotal === 1 ? 'Standard' : labelParts.join(', ')
		});
	}

	console.log(`[RunPlans] ${questionsToVary.length} questions, ${plans.length} runs planned (${totalCombinations} total, capped at ${MAX_RUNS_PER_GUIDE})`);
	return plans;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function startGuidedCapture(
	tabId: number,
	selectedGuides: LLGuide[],
	mode: 'manual' | 'auto',
	playerFrameId: number = 0
): Promise<void> {
	if (isRunning) {
		throw new Error('Une capture guidée est déjà en cours');
	}

	guides = selectedGuides.filter(g => g.selected);
	if (guides.length === 0) {
		throw new Error('Aucun guide sélectionné');
	}

	currentTabId = tabId;
	llFrameId = playerFrameId;
	currentGuideIndex = 0;
	currentStepIndex = 0;
	executionMode = mode;
	capturedPageCount = 0;
	isRunning = true;
	isProcessingStep = false;

	// Compute run plans for the first guide
	guideRunPlans = computeRunPlans(guides[0].steps);
	currentRunIndex = 0;
	currentRunPlan = guideRunPlans[0] || null;

	console.log(`[Guided] First guide "${guides[0].name}": ${guideRunPlans.length} run(s) planned`);

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
		// Estimate total pages: sum of (stepCount × runCount) for each guide
		const totalSteps = guides.reduce((sum, g) => {
			const runs = computeRunPlans(g.steps).length;
			return sum + Math.max(g.stepCount, 1) * runs;
		}, 0);
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

	// Capture the initial page before any guide interaction
	try {
		console.log('[Guided] Capturing initial page (before guide)...');
		await captureInitialPage(tabId);
	} catch (err) {
		console.warn('[Guided] Initial page capture failed:', err);
	}

	// Start observing the bubble in the content script
	try {
		await sendToLLFrame(tabId, { type: 'OBSERVE_LL_BUBBLE' });
	} catch (err) {
		console.warn('[Guided] Failed to start bubble observer:', err);
	}

	// In auto mode, launch the first guide
	if (mode === 'auto') {
		await launchCurrentGuide();
	}

	startBubbleWaitTimer();
	console.log(`[Guided] Started: ${guides.length} guides, mode=${mode}`);
}

export async function stopGuidedCapture(): Promise<void> {
	console.log('[Guided] Stopping...');

	isRunning = false;
	clearBubbleWaitTimer();

	if (currentTabId !== null) {
		try {
			await sendToLLFrame(currentTabId, { type: 'STOP_OBSERVE_LL_BUBBLE' });
			await sendToLLFrame(currentTabId, { type: 'SHOW_LL_BUBBLE' });
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
		}).catch((e) => console.warn('[Guided] Failed to finalize capture job:', e));
	}

	await updateCaptureState({
		isRunning: false,
		isPaused: false,
		jobId: undefined,
		guided: undefined
	});

	currentTabId = null;
	guides = [];
	guideRunPlans = [];
	currentRunPlan = null;
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

	reportError({
		message: `[Guided] onBubbleChanged: present=${data.bubblePresent} step=${data.stepIndicator || '?'} title=${data.title || '?'}`,
		metadata: { ...data, currentGuideIndex, currentStepIndex, currentRunIndex, executionMode }
	});

	if (!data.bubblePresent) {
		console.log('[Guided] Bubble disappeared — guide run may be complete');
		await handleRunCompleted();
		return;
	}

	// Parse step indicator if available (e.g. "2/5")
	if (data.stepIndicator) {
		const parts = data.stepIndicator.split('/');
		if (parts.length === 2) {
			currentStepIndex = parseInt(parts[0], 10) - 1;
			const detectedTotal = parseInt(parts[1], 10);
			if (detectedTotal > 0 && guides[currentGuideIndex]) {
				guides[currentGuideIndex].stepCount = detectedTotal;
			}
		}
	}

	// Capture the current step
	await captureCurrentStep();

	// In auto mode, advance to next step
	if (executionMode === 'auto' && isRunning) {
		await sleep(STEP_TRANSITION_DELAY_MS);
		await advanceToNextStep();
	} else if (executionMode === 'manual' && isRunning) {
		startBubbleWaitTimer();
	}
}

export function isGuidedCaptureRunning(): boolean {
	return isRunning;
}

// ---------------------------------------------------------------------------
// Internal — Guide launching
// ---------------------------------------------------------------------------

async function launchCurrentGuide(): Promise<void> {
	if (!currentTabId) return;
	const guide = guides[currentGuideIndex];
	if (!guide) return;

	const runLabel = currentRunPlan?.label || 'Standard';
	console.log(`[Guided] Auto mode — launching guide: "${guide.name}" (id=${guide.id}) run ${currentRunIndex + 1}/${guideRunPlans.length} [${runLabel}]`);

	try {
		const result = await playGuide(currentTabId, guide.id, guide.name, llFrameId);
		console.log(`[Guided] playGuide result:`, JSON.stringify(result));
		if (!result.success) {
			console.warn(`[Guided] playGuide failed: ${result.error}`);
			reportError({
				message: `[Guided] playGuide failed: ${result.error}`,
				metadata: { guideId: guide.id, guideName: guide.name, debug: result.debug, frameId: llFrameId, runIndex: currentRunIndex }
			});
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.warn('[Guided] Failed to launch guide:', msg);
		reportError({
			message: `[Guided] Failed to launch guide: ${msg}`,
			metadata: { guideId: guide.id, frameId: llFrameId, runIndex: currentRunIndex }
		});
	}
}

// ---------------------------------------------------------------------------
// Internal — Capture
// ---------------------------------------------------------------------------

async function captureInitialPage(tabId: number): Promise<void> {
	const LOG = '[Guided Initial]';
	const localId = uuidv4();
	const page: CapturedPage = {
		id: '',
		localId,
		title: '[Page de départ]',
		url: '',
		fileSize: 0,
		status: PAGE_STATUS.CAPTURING,
		capturedAt: new Date().toISOString(),
		guideName: '[Page de départ]',
		captureVariant: 'clean',
		guideStepIndex: -1
	};

	await addCapturedPageToState(page);

	try {
		const collected = await captureCurrentPage(tabId);
		await updatePageStatus(localId, PAGE_STATUS.UPLOADING, {
			title: collected.title || page.title,
			url: collected.url
		});

		const [selfContainedHtml, screenshotDataUrl] = await Promise.all([
			buildSelfContainedPage(collected.html, collected.resources, collected.url),
			chrome.tabs.captureVisibleTab({ format: 'png' }).catch(() => null)
		]);

		let screenshotBlob: Blob | null = null;
		if (screenshotDataUrl) {
			try { const resp = await fetch(screenshotDataUrl); screenshotBlob = await resp.blob(); } catch { /* ignore */ }
		}

		const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
		const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
		if (!version?.id) throw new Error('Aucune version sélectionnée');

		const result = await uploadCapturedPage(
			version.id,
			{ html: selfContainedHtml, title: collected.title || page.title, url: collected.url },
			'guided',
			screenshotBlob,
			getLastFaviconDataUri(),
			{ guideName: '[Page de départ]', captureVariant: 'clean', guideStepIndex: -1 }
		);

		let urlPath: string | undefined;
		try { const parsedUrl = new URL(collected.url); urlPath = parsedUrl.pathname + parsedUrl.search; } catch { /* keep undefined */ }

		await updatePageStatus(localId, PAGE_STATUS.DONE, {
			id: result.id,
			fileSize: result.fileSize,
			urlPath
		});

		capturedPageCount++;
		console.log(`${LOG} Initial page captured: "${collected.title}"`);
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
		console.error(`${LOG} Failed:`, errorMsg);
		await updatePageStatus(localId, PAGE_STATUS.ERROR, { error: errorMsg });
	}
}

async function captureCurrentStep(): Promise<void> {
	if (!isRunning || currentTabId === null) return;

	isProcessingStep = true;
	const tabId = currentTabId;
	const guideName = guides[currentGuideIndex]?.name || 'Guide';
	const stepIndex = currentStepIndex;
	const LOG = '[Guided Capture]';
	const runLabel = currentRunPlan?.label || '';
	const hasMultipleRuns = guideRunPlans.length > 1;

	// Build step title with run info if multi-run
	const stepTitle = hasMultipleRuns
		? `${guideName} — Étape ${stepIndex + 1} [Run ${currentRunIndex + 1}: ${runLabel}]`
		: `${guideName} — Étape ${stepIndex + 1}`;

	console.log(`${LOG} Capturing step ${stepIndex + 1} of guide "${guideName}" run ${currentRunIndex + 1}/${guideRunPlans.length} (clean + annotated)`);

	await updateCaptureState({
		guided: buildProgress('capturing')
	});

	await sleep(CAPTURE_SETTLE_DELAY_MS);

	// === CAPTURE 1: CLEAN (bubble hidden) ===
	try {
		await sendToLLFrame(tabId, { type: 'HIDE_LL_BUBBLE' });
		await sleep(200);
	} catch (err) {
		console.warn(`${LOG} Failed to hide bubble:`, err);
	}

	const cleanLocalId = uuidv4();
	const cleanPage: CapturedPage = {
		id: '',
		localId: cleanLocalId,
		title: stepTitle,
		url: '',
		fileSize: 0,
		status: PAGE_STATUS.CAPTURING,
		capturedAt: new Date().toISOString(),
		guideName,
		captureVariant: 'clean',
		guideStepIndex: stepIndex,
		runIndex: currentRunIndex,
		runLabel: hasMultipleRuns ? runLabel : undefined
	};
	await addCapturedPageToState(cleanPage);

	let collected: Awaited<ReturnType<typeof captureCurrentPage>> | null = null;
	let selfContainedHtml = '';

	try {
		collected = await captureCurrentPage(tabId);
		await updatePageStatus(cleanLocalId, PAGE_STATUS.UPLOADING, {
			title: collected.title || cleanPage.title,
			url: collected.url
		});

		const [html, screenshotDataUrl] = await Promise.all([
			buildSelfContainedPage(collected.html, collected.resources, collected.url),
			chrome.tabs.captureVisibleTab({ format: 'png' }).catch(() => null)
		]);
		selfContainedHtml = html;

		let screenshotBlob: Blob | null = null;
		if (screenshotDataUrl) {
			try { const resp = await fetch(screenshotDataUrl); screenshotBlob = await resp.blob(); } catch { /* ignore */ }
		}

		const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
		const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
		if (!version?.id) throw new Error('Aucune version sélectionnée');

		const result = await uploadCapturedPage(
			version.id,
			{ html: selfContainedHtml, title: collected.title || cleanPage.title, url: collected.url },
			'guided',
			screenshotBlob,
			getLastFaviconDataUri(),
			{ guideName, captureVariant: 'clean', guideStepIndex: stepIndex }
		);

		let urlPath: string | undefined;
		try { const parsedUrl = new URL(collected.url); urlPath = parsedUrl.pathname + parsedUrl.search; } catch { /* keep undefined */ }

		await updatePageStatus(cleanLocalId, PAGE_STATUS.DONE, {
			id: result.id,
			fileSize: result.fileSize,
			urlPath
		});
		capturedPageCount++;
		console.log(`${LOG} Clean capture done: "${collected.title}"`);
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
		console.error(`${LOG} Clean capture failed:`, errorMsg);
		await updatePageStatus(cleanLocalId, PAGE_STATUS.ERROR, { error: errorMsg });
	}

	// === CAPTURE 2: ANNOTATED (bubble visible) ===
	try {
		await sendToLLFrame(tabId, { type: 'SHOW_LL_BUBBLE' });
		await sleep(300);
	} catch (e) {
		console.warn('[Guided] Failed to send SHOW_LL_BUBBLE:', e);
	}

	const annotatedLocalId = uuidv4();
	const annotatedPage: CapturedPage = {
		id: '',
		localId: annotatedLocalId,
		title: `${stepTitle} [guide]`,
		url: collected?.url || '',
		fileSize: 0,
		status: PAGE_STATUS.CAPTURING,
		capturedAt: new Date().toISOString(),
		guideName,
		captureVariant: 'annotated',
		guideStepIndex: stepIndex,
		runIndex: currentRunIndex,
		runLabel: hasMultipleRuns ? runLabel : undefined
	};
	await addCapturedPageToState(annotatedPage);

	try {
		const screenshotDataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' }).catch(() => null);
		let screenshotBlob: Blob | null = null;
		if (screenshotDataUrl) {
			try { const resp = await fetch(screenshotDataUrl); screenshotBlob = await resp.blob(); } catch { /* ignore */ }
		}

		const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
		const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
		if (!version?.id) throw new Error('Aucune version sélectionnée');

		const htmlToUpload = selfContainedHtml || '<html><body>Capture annotated only</body></html>';
		const titleToUpload = annotatedPage.title;
		const urlToUpload = collected?.url || '';

		const result = await uploadCapturedPage(
			version.id,
			{ html: htmlToUpload, title: titleToUpload, url: urlToUpload },
			'guided',
			screenshotBlob,
			getLastFaviconDataUri(),
			{ guideName, captureVariant: 'annotated', guideStepIndex: stepIndex }
		);

		let urlPath: string | undefined;
		try { if (urlToUpload) { const parsedUrl = new URL(urlToUpload); urlPath = parsedUrl.pathname + parsedUrl.search; } } catch { /* keep undefined */ }

		await updatePageStatus(annotatedLocalId, PAGE_STATUS.DONE, {
			id: result.id,
			fileSize: result.fileSize,
			urlPath
		});
		capturedPageCount++;
		console.log(`${LOG} Annotated capture done: "${titleToUpload}"`);
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
		console.error(`${LOG} Annotated capture failed:`, errorMsg);
		await updatePageStatus(annotatedLocalId, PAGE_STATUS.ERROR, { error: errorMsg });
	}

	// Update capture job progress
	try {
		const state = await getCaptureState();
		if (state.jobId) {
			const doneCount = state.pages.filter(p => p.status === PAGE_STATUS.DONE).length;
			await api.put(`/capture-jobs/${state.jobId}`, {
				pagesCaptured: doneCount,
				status: 'running'
			}).catch((e) => console.warn('[Guided] Failed to update capture job progress:', e));
		}
	} catch { /* non-critical */ }

	isProcessingStep = false;

	await updateCaptureState({
		guided: buildProgress('idle')
	});
}

// ---------------------------------------------------------------------------
// Internal — Navigation
// ---------------------------------------------------------------------------

/**
 * Advance to the next step using guide metadata for intelligent action routing.
 * For question steps, uses the current run plan to select the correct answer.
 */
async function advanceToNextStep(): Promise<void> {
	if (!isRunning || currentTabId === null) return;

	const LOG = '[Guided]';
	const tabId = currentTabId;

	await updateCaptureState({
		guided: buildProgress('advancing')
	});

	try {
		const guide = guides[currentGuideIndex];
		const step: LLGuideStep | undefined = guide?.steps?.[currentStepIndex];

		if (step) {
			const stepType = step.stepType;
			const triggers = step.triggers || [];
			console.log(`${LOG} Step ${currentStepIndex + 1}: type=${stepType} triggers=[${triggers.map(t => t.type).join(',')}]`);
			reportError({
				message: `[Guided] advanceStep: type=${stepType} triggers=${triggers.map(t => t.type).join(',')}`,
				metadata: { stepType, triggers, currentStepIndex, guideName: guide?.name, hasPaths: !!step.targetPaths, runIndex: currentRunIndex }
			});

			let actionResult: { success: boolean; error?: string } = { success: false, error: 'No action taken' };

			switch (stepType) {
				case 'intro':
				case 'outro':
					actionResult = await clickNextButton(tabId, llFrameId);
					break;

				case 'condition':
				case 'variable':
				case 'auto':
				case 'subguide':
					// These auto-advance — just wait for the next bubble
					actionResult = { success: true };
					break;

				case 'question': {
					// Use the run plan to determine which answer to select
					const answerIdx = getAnswerIndexForStep(step);
					console.log(`${LOG} Question step (stepKey=${step.stepKey || '?'}): selecting answer index ${answerIdx}`);
					actionResult = await answerQuestion(tabId, llFrameId, answerIdx);
					if (!actionResult.success) {
						actionResult = await clickNextButton(tabId, llFrameId);
					} else {
						// After selecting an answer, click Next to advance
						await sleep(300);
						const nextResult = await clickNextButton(tabId, llFrameId);
						if (!nextResult.success) {
							console.warn(`${LOG} Next after answer failed — answer may auto-advance`);
						}
					}
					break;
				}

				case 'regular':
				default:
					actionResult = await handleRegularStep(tabId, step);
					break;
			}

			if (!actionResult.success) {
				console.warn(`${LOG} Action failed: ${actionResult.error} — trying Next as fallback`);
				const fallback = await clickNextButton(tabId, llFrameId);
				if (!fallback.success) {
					console.warn(`${LOG} Next fallback also failed — guide may be stuck`);
				}
			}
		} else {
			// No step metadata — click Next
			console.log(`${LOG} No step metadata for step ${currentStepIndex + 1} — clicking Next`);
			const result = await clickNextButton(tabId, llFrameId);
			if (!result.success) {
				console.warn(`${LOG} Next click failed: ${result.error} — guide may be stuck`);
			}
		}

		currentStepIndex++;
		console.log(`${LOG} Step ${currentStepIndex} done → waiting for next bubble`);

		startBubbleWaitTimer();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`${LOG} Failed to advance step:`, msg);
		reportError({ message: `[Guided] advanceToNextStep failed: ${msg}` });
		await sleep(2000);
		if (isRunning && currentTabId !== null) {
			try {
				await sendToLLFrame(currentTabId, { type: 'OBSERVE_LL_BUBBLE' });
				startBubbleWaitTimer();
			} catch {
				console.error(`${LOG} Cannot re-inject observer — stopping`);
				await stopGuidedCapture();
			}
		}
	}
}

/**
 * Get the answer index for a question step based on the current run plan.
 */
function getAnswerIndexForStep(step: LLGuideStep): number {
	if (!currentRunPlan || !step.stepKey) return 0;
	const idx = currentRunPlan.answers[step.stepKey];
	return idx !== undefined ? idx : 0;
}

/**
 * Handle a REGULAR step using its trigger types.
 */
async function handleRegularStep(
	tabId: number,
	step: LLGuideStep
): Promise<{ success: boolean; error?: string }> {
	const triggers = step.triggers || [];

	if (triggers.some(t => t.type === 'NEXT')) {
		return clickNextButton(tabId, llFrameId);
	}

	if (triggers.some(t => ['APPEAR', 'DISAPPEAR', 'WAIT', 'MULTIPAGE'].includes(t.type))) {
		return { success: true };
	}

	const actionTrigger = triggers.find(t =>
		['CLICK', 'INPUT', 'CHANGE', 'HOVER', 'MOUSEDOWN'].includes(t.type)
	);

	if (actionTrigger) {
		const result = await findAndExecuteAction(tabId, actionTrigger.type, step.targetPaths, llFrameId);
		if (result.success) return result;

		console.warn(`[Guided] Target not found for ${actionTrigger.type} — trying Next`);
		return clickNextButton(tabId, llFrameId);
	}

	return clickNextButton(tabId, llFrameId);
}

/**
 * Handle guide run completion — check if there are more runs or move to next guide.
 */
async function handleRunCompleted(): Promise<void> {
	const LOG = '[Guided]';
	const completedGuide = guides[currentGuideIndex];
	console.log(`${LOG} Guide "${completedGuide?.name}" run ${currentRunIndex + 1}/${guideRunPlans.length} completed`);

	// Check if there are more runs for the current guide
	currentRunIndex++;
	if (currentRunIndex < guideRunPlans.length) {
		// More runs — replay the same guide with a different answer plan
		currentRunPlan = guideRunPlans[currentRunIndex];
		currentStepIndex = 0;

		console.log(`${LOG} Starting run ${currentRunIndex + 1}/${guideRunPlans.length} for "${completedGuide?.name}" [${currentRunPlan.label}]`);
		await updateCaptureState({
			guided: buildProgress('waiting_bubble')
		});

		// In auto mode, relaunch the same guide
		if (executionMode === 'auto' && currentTabId !== null) {
			await sleep(1500); // Let the previous run fully close
			await launchCurrentGuide();
		}

		startBubbleWaitTimer();
		return;
	}

	// All runs completed for this guide — move to next guide
	currentGuideIndex++;
	currentStepIndex = 0;

	if (currentGuideIndex >= guides.length) {
		// All guides completed
		console.log(`${LOG} All ${guides.length} guides completed. Total pages: ${capturedPageCount}`);
		await updateCaptureState({
			guided: buildProgress('done')
		});
		await sleep(1500);
		await stopGuidedCapture();
		return;
	}

	// Compute run plans for next guide
	const nextGuide = guides[currentGuideIndex];
	guideRunPlans = computeRunPlans(nextGuide.steps);
	currentRunIndex = 0;
	currentRunPlan = guideRunPlans[0] || null;

	console.log(`${LOG} Moving to guide ${currentGuideIndex + 1}/${guides.length}: "${nextGuide.name}" (${guideRunPlans.length} runs)`);
	await updateCaptureState({
		guided: buildProgress('waiting_bubble')
	});

	if (executionMode === 'auto' && currentTabId !== null) {
		await sleep(1000);
		await launchCurrentGuide();
	}

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
		status,
		runIndex: currentRunIndex,
		totalRuns: guideRunPlans.length,
		runLabel: currentRunPlan?.label
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
		console.log('[Guided] Tab navigated — re-injecting bubble observer');
		await sleep(1000);
		try {
			await sendToLLFrame(tabId, { type: 'OBSERVE_LL_BUBBLE' });
		} catch (err) {
			console.warn('[Guided] Failed to re-inject observer after navigation:', err);
		}
	}
});
