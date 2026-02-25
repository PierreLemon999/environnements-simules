<script lang="ts">
	import LoginView from './LoginView.svelte';
	import MainView from './MainView.svelte';
	import type { User } from '$lib/constants';
	import { STORAGE_KEYS } from '$lib/constants';

	let isAuthenticated = $state(false);
	let user = $state<User | null>(null);
	let loading = $state(true);

	$effect(() => {
		checkAuth();
	});

	async function checkAuth() {
		try {
			const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });
			if (response?.isAuthenticated) {
				isAuthenticated = true;
				user = response.user;
			} else {
				isAuthenticated = false;
				user = null;
			}
		} catch {
			isAuthenticated = false;
			user = null;
		} finally {
			loading = false;
		}
	}

	function handleLogin(event: CustomEvent<{ user: User }>) {
		isAuthenticated = true;
		user = event.detail.user;
	}

	async function handleLogout() {
		await chrome.runtime.sendMessage({ type: 'LOGOUT' });
		isAuthenticated = false;
		user = null;
	}
</script>

{#if loading}
	<div class="flex items-center justify-center h-full min-h-[500px]">
		<div class="flex flex-col items-center gap-3">
			<div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-lg">
				ES
			</div>
			<div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
		</div>
	</div>
{:else if !isAuthenticated}
	<LoginView on:login={handleLogin} />
{:else}
	<MainView {user} on:logout={handleLogout} />
{/if}
