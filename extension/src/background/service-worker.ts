import { STORAGE_KEYS, PAGE_STATUS, type CapturedPage } from '$lib/constants';
import {
	captureCurrentPage,
	uploadCapturedPage,
	getCaptureState,
	updateCaptureState,
	addCapturedPageToState,
	updatePageStatus,
	removePageFromState
} from '$lib/capture';
import {
	startAutoCrawl,
	stopAutoCrawl,
	pauseAutoCrawl,
	resumeAutoCrawl,
	getAutoConfig,
	saveAutoConfig,
	type AutoCaptureConfig
} from '$lib/auto-capture';
import { v4 as uuidv4 } from '$lib/uuid';
import { verifyToken } from '$lib/auth';
import api from '$lib/api';

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	handleMessage(message)
		.then(sendResponse)
		.catch((err) => sendResponse({ error: err.message }));
	return true; // async response
});

async function handleMessage(
	message: { type: string; [key: string]: unknown }
): Promise<unknown> {
	switch (message.type) {
		case 'CAPTURE_PAGE':
			return handleCapturePage(message.tabId as number);

		case 'GET_CAPTURE_STATE':
			return getCaptureState();

		case 'SET_CAPTURE_MODE':
			return updateCaptureState({ mode: message.mode as 'free' | 'guided' | 'auto' });

		case 'PAUSE_CAPTURE':
			return updateCaptureState({ isPaused: true });

		case 'RESUME_CAPTURE':
			return updateCaptureState({ isPaused: false });

		case 'START_AUTO_CRAWL': {
			const config = message.config as AutoCaptureConfig;
			const tabId = message.tabId as number;
			await startAutoCrawl(tabId, config);
			return { success: true };
		}

		case 'STOP_AUTO_CRAWL':
			await stopAutoCrawl();
			return { success: true };

		case 'GET_AUTO_CONFIG':
			return getAutoConfig();

		case 'SAVE_AUTO_CONFIG':
			await saveAutoConfig(message.config as AutoCaptureConfig);
			return { success: true };

		case 'REMOVE_PAGE':
			await removePageFromState(message.localId as string);
			return { success: true };

		case 'RECAPTURE_PAGE': {
			const state = await getCaptureState();
			const page = state.pages.find((p) => p.localId === message.localId);
			if (page) {
				// Remove old page and recapture
				await removePageFromState(message.localId as string);
				return handleCapturePage(message.tabId as number);
			}
			throw new Error('Page not found');
		}

		case 'DELETE_BACKEND_PAGE': {
			await api.del(`/pages/${message.pageId}`);
			await removePageFromState(message.localId as string);
			return { success: true };
		}

		case 'GET_PROJECTS':
			return api.get('/projects');

		case 'GET_VERSIONS':
			return api.get(`/projects/${message.projectId}/versions`);

		case 'CREATE_CAPTURE_JOB': {
			const versionId = message.versionId as string;
			const mode = message.mode as string;
			const targetPageCount = message.targetPageCount as number;
			const result = await api.post(`/versions/${versionId}/capture-jobs`, {
				mode,
				targetPageCount
			});
			return result;
		}

		case 'UPDATE_CAPTURE_JOB': {
			const jobId = message.jobId as string;
			const updates = message.updates as Record<string, unknown>;
			return api.put(`/capture-jobs/${jobId}`, updates);
		}

		case 'CHECK_AUTH':
			return verifyToken();

		case 'LOGOUT': {
			await chrome.storage.local.remove([
				STORAGE_KEYS.AUTH_TOKEN,
				STORAGE_KEYS.USER,
				STORAGE_KEYS.ACTIVE_PROJECT,
				STORAGE_KEYS.ACTIVE_VERSION,
				STORAGE_KEYS.CAPTURE_STATE
			]);
			return { success: true };
		}

		default:
			throw new Error(`Unknown message type: ${message.type}`);
	}
}

// ---------------------------------------------------------------------------
// Capture flow
// ---------------------------------------------------------------------------

async function handleCapturePage(tabId: number): Promise<CapturedPage> {
	const state = await getCaptureState();

	// Get active version
	const versionResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_VERSION);
	const version = versionResult[STORAGE_KEYS.ACTIVE_VERSION];
	if (!version?.id) {
		throw new Error('Aucune version sélectionnée');
	}

	const localId = uuidv4();

	// Create page entry in state
	const page: CapturedPage = {
		id: '',
		localId,
		title: 'Capture en cours...',
		url: '',
		fileSize: 0,
		status: PAGE_STATUS.CAPTURING,
		capturedAt: new Date().toISOString()
	};

	await addCapturedPageToState(page);

	try {
		// Step 1: Capture DOM
		const captured = await captureCurrentPage(tabId);
		await updatePageStatus(localId, PAGE_STATUS.UPLOADING, {
			title: captured.title,
			url: captured.url
		});

		// Step 2: Upload to backend
		const result = await uploadCapturedPage(
			version.id,
			captured,
			state.mode
		);

		// Step 3: Mark as done
		await updatePageStatus(localId, PAGE_STATUS.DONE, {
			id: result.id,
			fileSize: result.fileSize
		});

		// Update capture job if exists
		if (state.jobId) {
			const currentState = await getCaptureState();
			const doneCount = currentState.pages.filter(
				(p) => p.status === PAGE_STATUS.DONE
			).length;

			await api.put(`/capture-jobs/${state.jobId}`, {
				pagesCaptured: doneCount,
				status: doneCount >= currentState.targetPageCount ? 'done' : 'running'
			}).catch(() => {
				// Non-critical
			});
		}

		return (await getCaptureState()).pages.find((p) => p.localId === localId)!;
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
		await updatePageStatus(localId, PAGE_STATUS.ERROR, { error: errorMsg });
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Token refresh on alarm
// ---------------------------------------------------------------------------

chrome.alarms?.create('token-refresh', { periodInMinutes: 30 });
chrome.alarms?.onAlarm.addListener(async (alarm) => {
	if (alarm.name === 'token-refresh') {
		await verifyToken();
	}
});

// ---------------------------------------------------------------------------
// Extension install handler
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
	console.log('[Env. Simulés] Extension installed');
});
