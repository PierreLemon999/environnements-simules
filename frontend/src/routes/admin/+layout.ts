import { browser } from '$app/environment';
import { get as getStore } from 'svelte/store';
import { isAuthenticated, user } from '$lib/stores/auth';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = () => {
	if (browser) {
		const authed = getStore(isAuthenticated);
		const currentUser = getStore(user);

		if (!authed) {
			throw redirect(302, '/login');
		}

		if (currentUser?.role === 'client') {
			throw redirect(302, '/view');
		}
	}
};
