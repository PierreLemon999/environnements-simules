<script lang="ts">
	import LoginView from './LoginView.svelte';
	import MainView from './MainView.svelte';
	import type { User } from '$lib/constants';

	let isAuthenticated = $state(false);
	let user = $state<User | null>(null);
	let loading = $state(true);
	let outdated = $state(false);
	let loadingMessage = $state('Connexion...');
	let loadingTimedOut = $state(false);

	console.log(`[Lemon Lab] Popup mounted — v${__APP_VERSION__} (build ${__BUILD_HASH__})`);

	$effect(() => {
		checkAuth();
	});

	async function checkAuth() {
		loadingMessage = 'Connexion...';
		loadingTimedOut = false;

		const slowTimer = setTimeout(() => {
			loadingMessage = 'Le serveur met du temps à répondre...';
		}, 5000);

		const timeoutTimer = setTimeout(() => {
			loadingTimedOut = true;
			loadingMessage = 'Impossible de joindre le serveur';
			loading = false;
		}, 15000);

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
			clearTimeout(slowTimer);
			clearTimeout(timeoutTimer);
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

	function retry() {
		loading = true;
		loadingTimedOut = false;
		checkAuth();
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
			<span class="text-xs text-gray-400">{loadingMessage}</span>
		</div>
	</div>
{:else if loadingTimedOut}
	<div class="flex items-center justify-center h-full min-h-[500px]">
		<div class="flex flex-col items-center gap-3 px-6 text-center">
			<div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
				<svg class="w-5 h-5 text-[#F1362A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
			</div>
			<p class="text-sm text-gray-600 font-medium">Serveur inaccessible</p>
			<p class="text-xs text-gray-400">Vérifiez que le backend est lancé</p>
			<button
				onclick={retry}
				class="mt-1 px-4 py-1.5 text-sm font-medium text-primary bg-blue-50 rounded-lg hover:bg-blue-100 transition"
			>
				Réessayer
			</button>
			<span class="text-[10px] text-gray-300 font-mono">v{__APP_VERSION__}+{__BUILD_HASH__}</span>
		</div>
	</div>
{:else if !isAuthenticated}
	<LoginView onLogin={handleLogin} />
{:else}
	<MainView {user} {outdated} onLogout={handleLogout} />
{/if}
