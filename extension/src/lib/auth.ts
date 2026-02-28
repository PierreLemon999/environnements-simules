import { STORAGE_KEYS, type User } from './constants';
import api from './api';

export interface AuthState {
	isAuthenticated: boolean;
	user: User | null;
	token: string | null;
	outdated?: boolean;
}

export async function getAuthState(): Promise<AuthState> {
	const result = await chrome.storage.local.get([
		STORAGE_KEYS.AUTH_TOKEN,
		STORAGE_KEYS.USER,
		STORAGE_KEYS.VERSION_OUTDATED
	]);

	const token = result[STORAGE_KEYS.AUTH_TOKEN] || null;
	const user = result[STORAGE_KEYS.USER] || null;

	if (!token || !user) {
		return { isAuthenticated: false, user: null, token: null };
	}

	const outdated = result[STORAGE_KEYS.VERSION_OUTDATED] === true;
	return { isAuthenticated: true, user, token, outdated };
}

export async function loginWithGoogle(
	email: string,
	name: string,
	googleId: string,
	avatarUrl?: string
): Promise<AuthState> {
	const response = await api.post<{
		data: { token: string; user: User };
	}>('/auth/google', {
		devBypass: true,
		email,
		name,
		googleId,
		avatarUrl
	});

	const { token, user } = response.data;

	await chrome.storage.local.set({
		[STORAGE_KEYS.AUTH_TOKEN]: token,
		[STORAGE_KEYS.USER]: user
	});

	return { isAuthenticated: true, user, token };
}

function isVersionOutdated(current: string, minimum: string): boolean {
	const c = current.split('.').map(Number);
	const m = minimum.split('.').map(Number);
	for (let i = 0; i < Math.max(c.length, m.length); i++) {
		const cv = c[i] || 0;
		const mv = m[i] || 0;
		if (cv < mv) return true;
		if (cv > mv) return false;
	}
	return false;
}

export async function verifyToken(): Promise<AuthState> {
	const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_TOKEN);
	const token = result[STORAGE_KEYS.AUTH_TOKEN];

	if (!token) {
		return { isAuthenticated: false, user: null, token: null };
	}

	try {
		const response = await api.post<{
			data: {
				valid: boolean;
				user: { userId: string; email: string; role: string; name: string } | null;
				minExtensionVersion?: string;
			};
		}>('/auth/verify', { token, extensionVersion: chrome.runtime.getManifest().version });

		if (!response.data.valid || !response.data.user) {
			await logout();
			return { isAuthenticated: false, user: null, token: null };
		}

		const user: User = {
			id: response.data.user.userId,
			name: response.data.user.name,
			email: response.data.user.email,
			role: response.data.user.role as 'admin' | 'client'
		};

		const minVersion = response.data.minExtensionVersion;
		const currentVersion = chrome.runtime.getManifest().version;
		const outdated = minVersion ? isVersionOutdated(currentVersion, minVersion) : false;

		await chrome.storage.local.set({
			[STORAGE_KEYS.USER]: user,
			[STORAGE_KEYS.VERSION_OUTDATED]: outdated
		});

		return { isAuthenticated: true, user, token, outdated };
	} catch {
		await logout();
		return { isAuthenticated: false, user: null, token: null };
	}
}

export async function logout(): Promise<void> {
	await chrome.storage.local.remove([
		STORAGE_KEYS.AUTH_TOKEN,
		STORAGE_KEYS.USER,
		STORAGE_KEYS.ACTIVE_PROJECT,
		STORAGE_KEYS.ACTIVE_VERSION,
		STORAGE_KEYS.CAPTURE_STATE,
		STORAGE_KEYS.VERSION_OUTDATED
	]);
}
