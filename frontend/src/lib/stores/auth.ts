/**
 * Authentication store — manages user session state.
 *
 * Uses Svelte writable/derived stores so any component can subscribe
 * reactively.  Token persistence is handled via the api module's
 * getToken / setToken / removeToken helpers (localStorage).
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { getToken, setToken, removeToken, post, ApiError } from '$lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
	id: string;
	name: string;
	email: string;
	role: 'admin' | 'client';
	avatarUrl: string | null;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/** Currently authenticated user (null when logged out). */
export const user = writable<User | null>(null);

/** Raw JWT token (null when logged out). */
export const token = writable<string | null>(null);

/** Derived boolean for quick auth checks. */
export const isAuthenticated = derived(
	[user, token],
	([$user, $token]) => $user !== null && $token !== null
);

/** Derived role accessor. */
export const userRole = derived(user, ($user) => $user?.role ?? null);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Log in with email and password (client flow).
 * On success the JWT is persisted and the user store is populated.
 */
export async function login(email: string, password: string): Promise<User> {
	const res = await post<{ data: { token: string; user: User } }>('/auth/login', {
		email,
		password
	});

	setToken(res.data.token);
	token.set(res.data.token);
	user.set(res.data.user);
	return res.data.user;
}

/**
 * Log in via Google SSO (admin flow).
 * The frontend handles the Google sign-in and sends the token to the backend.
 */
export async function loginWithGoogle(
	googleToken: string,
	email: string,
	name: string,
	googleId: string,
	avatarUrl?: string
): Promise<User> {
	const res = await post<{ data: { token: string; user: User } }>('/auth/google', {
		googleToken,
		email,
		name,
		googleId,
		avatarUrl
	});

	setToken(res.data.token);
	token.set(res.data.token);
	user.set(res.data.user);
	return res.data.user;
}

/**
 * Log out — clear stores and localStorage, optionally redirect.
 */
export function logout(redirect = true): void {
	removeToken();
	token.set(null);
	user.set(null);

	if (redirect && browser) {
		window.location.href = '/login';
	}
}

/**
 * Hydrate stores from localStorage on app start.
 * Call this once during layout mount.
 */
export async function loadFromStorage(): Promise<void> {
	if (!browser) return;

	const stored = getToken();
	if (!stored) return;

	token.set(stored);

	try {
		const res = await post<{
			data: {
				valid: boolean;
				user: { userId: string; email: string; role: 'admin' | 'client'; name: string } | null;
			};
		}>('/auth/verify', {
			token: stored
		});

		if (res.data.valid && res.data.user) {
			// Map JWT payload to User interface
			user.set({
				id: res.data.user.userId,
				name: res.data.user.name,
				email: res.data.user.email,
				role: res.data.user.role,
				avatarUrl: null,
			});
		} else {
			removeToken();
			token.set(null);
			user.set(null);
		}
	} catch (err) {
		// Token expired or invalid — clean up silently
		removeToken();
		token.set(null);
		user.set(null);
	}
}
