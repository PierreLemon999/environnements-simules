<script lang="ts">
	import LoginView from './LoginView.svelte';
	import MainView from './MainView.svelte';
	import type { User } from '$lib/constants';

	let isAuthenticated = $state(false);
	let user = $state<User | null>(null);
	let loading = $state(true);
	let outdated = $state(false);

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
			outdated = response?.outdated ?? false;
		} catch {
			isAuthenticated = false;
			user = null;
		} finally {
			loading = false;
		}
	}

	function handleLogin(data: { user: User }) {
		isAuthenticated = true;
		user = data.user;
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
			<div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
				<svg width="22" height="22" viewBox="0 0 32 32" fill="none">
					<path d="M12 4 L12 13 L6 25 Q5 27 7 28 L25 28 Q27 27 26 25 L20 13 L20 4" stroke="#2B72EE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
					<line x1="10" y1="4" x2="22" y2="4" stroke="#2B72EE" stroke-width="2.5" stroke-linecap="round"/>
					<path d="M8.5 21 L12.5 14 L19.5 14 L23.5 21 Q25 24 24 26 Q23 27 22 27 L10 27 Q9 27 8 26 Q7 24 8.5 21Z" fill="#D5E3FC" opacity="0.6"/>
					<circle cx="14" cy="22" r="1.8" fill="#FAE100"/>
					<circle cx="18.5" cy="19" r="1.3" fill="#2B72EE" opacity="0.5"/>
				</svg>
			</div>
			<div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
		</div>
	</div>
{:else if !isAuthenticated}
	<LoginView onLogin={handleLogin} />
{:else}
	<MainView {user} {outdated} onLogout={handleLogout} />
{/if}
