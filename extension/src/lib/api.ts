import { API_BASE_URL, STORAGE_KEYS } from './constants';

async function getToken(): Promise<string | null> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_TOKEN);
	return result[STORAGE_KEYS.AUTH_TOKEN] || null;
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;

async function request<T = unknown>(
	endpoint: string,
	options: {
		method?: string;
		body?: unknown;
		noAuth?: boolean;
	} = {}
): Promise<T> {
	const { method = 'GET', body, noAuth } = options;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (!noAuth) {
		const token = await getToken();
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}
	}

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const response = await fetch(`${API_BASE_URL}${endpoint}`, {
				method,
				headers,
				body: body !== undefined ? JSON.stringify(body) : undefined
			});

			if (response.status === 204) {
				return undefined as T;
			}

			const data = await response.json();

			if (!response.ok) {
				// Don't retry 4xx errors (client errors)
				if (response.status >= 400 && response.status < 500) {
					throw new ApiError(
						response.status,
						data?.code ?? 'UNKNOWN_ERROR',
						data?.error ?? response.statusText
					);
				}
				// 5xx errors: retry
				if (attempt < MAX_RETRIES - 1) {
					await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt));
					continue;
				}
				throw new ApiError(
					response.status,
					data?.code ?? 'UNKNOWN_ERROR',
					data?.error ?? response.statusText
				);
			}

			return data as T;
		} catch (err) {
			if (err instanceof ApiError) throw err;
			// Network error: retry
			if (attempt < MAX_RETRIES - 1) {
				await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt));
				continue;
			}
			throw new ApiError(0, 'NETWORK_ERROR', err instanceof Error ? err.message : 'Erreur réseau');
		}
	}

	throw new ApiError(0, 'NETWORK_ERROR', 'Erreur réseau après plusieurs tentatives');
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function uploadPage(
	versionId: string,
	file: Blob,
	metadata: {
		urlSource: string;
		urlPath?: string;
		title: string;
		captureMode: string;
		pageType?: string;
		parentPageId?: string;
		domFingerprint?: string;
		syntheticUrl?: string;
		captureTimingMs?: number;
		stateIndex?: number;
	},
	screenshotBlob?: Blob | null
): Promise<{ data: { id: string; fileSize: number } }> {
	const token = await getToken();
	const formData = new FormData();
	formData.append('file', file, 'page.html');
	if (screenshotBlob) {
		formData.append('screenshot', screenshotBlob, 'screenshot.png');
	}
	formData.append('metadata', JSON.stringify(metadata));

	const headers: Record<string, string> = {};
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const response = await fetch(`${API_BASE_URL}/versions/${versionId}/pages`, {
		method: 'POST',
		headers,
		body: formData
	});

	let data;
	try {
		data = await response.json();
	} catch (parseErr) {
		console.error('[LL API] Failed to parse upload response:', response.status, response.statusText);
		throw new ApiError(response.status, 'PARSE_ERROR', `Server returned ${response.status}: ${response.statusText}`);
	}

	if (!response.ok) {
		console.error('[LL API] Upload error:', response.status, data?.error || data);
		throw new ApiError(
			response.status,
			data?.code ?? 'UNKNOWN_ERROR',
			data?.error ?? response.statusText
		);
	}

	return data;
}

export const api = {
	get: <T = unknown>(endpoint: string) => request<T>(endpoint),
	post: <T = unknown>(endpoint: string, body?: unknown) =>
		request<T>(endpoint, { method: 'POST', body }),
	put: <T = unknown>(endpoint: string, body?: unknown) =>
		request<T>(endpoint, { method: 'PUT', body }),
	del: <T = unknown>(endpoint: string) =>
		request<T>(endpoint, { method: 'DELETE' }),
	upload: uploadPage
};

export default api;
