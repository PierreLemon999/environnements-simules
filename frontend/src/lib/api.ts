/**
 * API client for communicating with the backend.
 *
 * Base URL defaults to http://localhost:3001/api and can be overridden
 * via the PUBLIC_API_BASE_URL environment variable.
 */

import { browser } from '$app/environment';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:3001/api';

/**
 * Resolve the API base URL.
 * In the browser we read from the SvelteKit public env; on the server
 * we fall back to the default so SSR requests still work.
 */
function getBaseUrl(): string {
	if (browser) {
		// SvelteKit exposes PUBLIC_ env vars at build time via import.meta.env
		return (import.meta.env.PUBLIC_API_BASE_URL as string) ?? DEFAULT_BASE_URL;
	}
	return DEFAULT_BASE_URL;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'auth_token';

/** Read the JWT from localStorage (browser-only). */
export function getToken(): string | null {
	if (!browser) return null;
	return localStorage.getItem(TOKEN_KEY);
}

/** Persist the JWT to localStorage. */
export function setToken(token: string): void {
	if (!browser) return;
	localStorage.setItem(TOKEN_KEY, token);
}

/** Remove the JWT from localStorage. */
export function removeToken(): void {
	if (!browser) return;
	localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

interface RequestOptions extends Omit<RequestInit, 'body'> {
	body?: unknown;
	/** Skip the Authorization header even if a token exists. */
	noAuth?: boolean;
}

async function request<T = unknown>(
	endpoint: string,
	options: RequestOptions = {}
): Promise<T> {
	const { body, noAuth, ...init } = options;

	const url = `${getBaseUrl()}${endpoint}`;

	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		...(init.headers as Record<string, string>)
	};

	// Attach JWT when available
	if (!noAuth) {
		const token = getToken();
		if (token) {
			(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
		}
	}

	const response = await fetch(url, {
		...init,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});

	// Handle empty responses (204 No Content, etc.)
	if (response.status === 204) {
		return undefined as T;
	}

	const data = await response.json();

	if (!response.ok) {
		throw new ApiError(
			response.status,
			data?.code ?? 'UNKNOWN_ERROR',
			data?.error ?? response.statusText
		);
	}

	return data as T;
}

// ---------------------------------------------------------------------------
// Public HTTP helpers
// ---------------------------------------------------------------------------

export function get<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
	return request<T>(endpoint, { ...options, method: 'GET' });
}

export function post<T = unknown>(
	endpoint: string,
	body?: unknown,
	options?: RequestOptions
): Promise<T> {
	return request<T>(endpoint, { ...options, method: 'POST', body });
}

export function put<T = unknown>(
	endpoint: string,
	body?: unknown,
	options?: RequestOptions
): Promise<T> {
	return request<T>(endpoint, { ...options, method: 'PUT', body });
}

export function patch<T = unknown>(
	endpoint: string,
	body?: unknown,
	options?: RequestOptions
): Promise<T> {
	return request<T>(endpoint, { ...options, method: 'PATCH', body });
}

export function del<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
	return request<T>(endpoint, { ...options, method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Multipart upload helper (for page capture uploads, etc.)
// ---------------------------------------------------------------------------

export async function upload<T = unknown>(
	endpoint: string,
	formData: FormData,
	options?: Omit<RequestOptions, 'body'>
): Promise<T> {
	const { noAuth, ...init } = options ?? {};

	const url = `${getBaseUrl()}${endpoint}`;

	const headers: Record<string, string> = {};

	if (!noAuth) {
		const token = getToken();
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}
	}

	// Do NOT set Content-Type — the browser sets the multipart boundary automatically
	const response = await fetch(url, {
		...init,
		method: 'POST',
		headers,
		body: formData
	});

	if (response.status === 204) {
		return undefined as T;
	}

	const data = await response.json();

	if (!response.ok) {
		throw new ApiError(
			response.status,
			data?.code ?? 'UNKNOWN_ERROR',
			data?.error ?? response.statusText
		);
	}

	return data as T;
}

// ---------------------------------------------------------------------------
// Convenience: default export for ergonomic usage
// ---------------------------------------------------------------------------

const api = { get, post, put, patch, del, upload };
export default api;
