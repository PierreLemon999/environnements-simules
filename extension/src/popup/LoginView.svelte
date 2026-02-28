<script lang="ts">
	import { STORAGE_KEYS, API_BASE_URL, type User } from '$lib/constants';

	let { onLogin }: { onLogin: (data: { user: User }) => void } = $props();

	let email = $state('');
	let error = $state('');
	let loading = $state(false);
	let devLoading = $state(false);

	async function handleGoogleLogin() {
		error = '';
		loading = true;

		try {
			// For development: simulate Google SSO by sending the email directly
			// In production, this would use chrome.identity.launchWebAuthFlow
			const googleEmail = email.trim() || 'admin@lemonlearning.com';

			if (!googleEmail.endsWith('@lemonlearning.com')) {
				error = 'Seuls les emails @lemonlearning.com sont autorisés';
				loading = false;
				return;
			}

			const response = await fetch(`${API_BASE_URL}/auth/google`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					devBypass: true,
					email: googleEmail,
					name: googleEmail.split('@')[0].replace('.', ' '),
					googleId: `google-${Date.now()}`,
					avatarUrl: ''
				})
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Échec de la connexion';
				loading = false;
				return;
			}

			const { token, user } = data.data;

			await chrome.storage.local.set({
				[STORAGE_KEYS.AUTH_TOKEN]: token,
				[STORAGE_KEYS.USER]: user
			});

			onLogin({ user });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur de connexion';
		} finally {
			loading = false;
		}
	}

	async function handleDevLogin() {
		error = '';
		devLoading = true;

		try {
			const response = await fetch(`${API_BASE_URL}/auth/google`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					devBypass: true,
					email: 'marie.laurent@lemonlearning.com',
					name: 'Marie Laurent',
					googleId: 'google-marie-001'
				})
			});

			const data = await response.json();
			if (!response.ok) {
				error = data.error || 'Échec de la connexion';
				devLoading = false;
				return;
			}

			const { token, user } = data.data;
			await chrome.storage.local.set({
				[STORAGE_KEYS.AUTH_TOKEN]: token,
				[STORAGE_KEYS.USER]: user
			});
			onLogin({ user });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur de connexion';
		} finally {
			devLoading = false;
		}
	}
</script>

<div class="flex flex-col items-center justify-center min-h-[500px] p-6 bg-gray-50">
	<div class="w-full max-w-sm">
		<!-- Logo -->
		<div class="flex flex-col items-center mb-8">
			<div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 shadow-lg shadow-blue-100">
				<svg width="28" height="28" viewBox="0 0 32 32" fill="none">
					<path d="M12 4 L12 13 L6 25 Q5 27 7 28 L25 28 Q27 27 26 25 L20 13 L20 4" stroke="#2B72EE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
					<line x1="10" y1="4" x2="22" y2="4" stroke="#2B72EE" stroke-width="2.5" stroke-linecap="round"/>
					<path d="M8.5 21 L12.5 14 L19.5 14 L23.5 21 Q25 24 24 26 Q23 27 22 27 L10 27 Q9 27 8 26 Q7 24 8.5 21Z" fill="#D5E3FC" opacity="0.6"/>
					<circle cx="14" cy="22" r="1.8" fill="#FAE100"/>
					<circle cx="18.5" cy="19" r="1.3" fill="#2B72EE" opacity="0.5"/>
					<circle cx="11.5" cy="18.5" r="1" fill="#FAE100" opacity="0.7"/>
				</svg>
			</div>
			<h1 class="text-lg font-semibold text-gray-900">Lemon Lab</h1>
			<p class="text-sm text-gray-500 mt-1">Connectez-vous pour commencer</p>
		</div>

		<!-- Login card -->
		<div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
			<div class="space-y-4">
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 mb-1.5">
						Email administrateur
					</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						placeholder="prenom@lemonlearning.com"
						class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
						onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleGoogleLogin()}
					/>
					<p class="text-xs text-gray-400 mt-1">(admin uniquement)</p>
				</div>

				{#if error}
					<div class="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
						<svg class="w-4 h-4 text-error shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						<p class="text-xs text-red-600">{error}</p>
					</div>
				{/if}

				<button
					onclick={handleGoogleLogin}
					disabled={loading}
					class="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if loading}
						<div class="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
						<span>Connexion...</span>
					{:else}
						<svg class="w-4 h-4" viewBox="0 0 24 24">
							<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
							<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
							<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
							<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
						</svg>
						<span>Se connecter avec Google</span>
					{/if}
				</button>
			</div>
		</div>

		<!-- Dev quick login -->
		<button
			onclick={handleDevLogin}
			disabled={loading || devLoading}
			class="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white/90 text-xs font-medium text-gray-500 hover:text-primary hover:border-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
		>
			{#if devLoading}
				<div class="w-3 h-3 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
			{:else}
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
				</svg>
			{/if}
			Connexion locale
		</button>

		<p class="text-center text-xs text-gray-400 mt-3">
			Lemon Lab v{__APP_VERSION__}
		</p>
	</div>
</div>
