<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { post } from '$lib/api';
	import { Loader2 } from 'lucide-svelte';

	// Parse the URL path to get subdomain and page path
	let fullPath = $derived($page.params.path ?? '');
	let pathSegments = $derived(fullPath.split('/'));
	let subdomain = $derived(pathSegments[0] ?? '');
	let pagePath = $derived(pathSegments.slice(1).join('/') || '');

	// State
	let loading = $state(true);
	let error = $state(false);
	let iframeUrl = $state('');
	let widgetExpanded = $state(false);

	// Build the demo API URL
	let demoApiUrl = $derived(
		subdomain ? `http://localhost:3001/demo/${subdomain}/${pagePath}` : ''
	);

	// Check for access token in URL params
	let accessToken = $derived($page.url.searchParams.get('token') ?? '');

	onMount(async () => {
		try {
			// If there's a token, verify demo access
			if (accessToken) {
				try {
					await post('/auth/demo-access', {
						token: accessToken,
						password: '', // Link access, no password needed
					});
				} catch {
					// Silent fail — the demo endpoint itself doesn't require auth
				}
			}

			if (demoApiUrl) {
				iframeUrl = demoApiUrl;
			} else {
				error = true;
			}
		} catch (err) {
			console.error('Demo viewer error:', err);
			error = true;
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Démo — Environnements Simulés</title>
	<style>
		/* Hide root layout spinner styling if present */
		body {
			margin: 0;
			padding: 0;
			overflow: hidden;
		}
	</style>
</svelte:head>

<div class="relative h-screen w-screen bg-white">
	{#if loading}
		<div class="flex h-full items-center justify-center">
			<Loader2 class="h-6 w-6 animate-spin text-gray-400" />
		</div>
	{:else if error || !iframeUrl}
		<div class="flex h-full items-center justify-center">
			<div class="text-center">
				<p class="text-sm text-gray-500">Cette démo n'est pas disponible.</p>
			</div>
		</div>
	{:else}
		<!-- Full-screen demo iframe — nearly invisible UI -->
		<iframe
			src={iframeUrl}
			class="h-full w-full border-0"
			title="Démo"
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
		></iframe>

		<!-- Floating LL avatar widget (bottom-right) -->
		<div class="fixed bottom-5 right-5 z-50">
			{#if widgetExpanded}
				<!-- Expanded widget -->
				<div class="mb-2 w-56 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
					<div class="mb-3 flex items-center justify-between">
						<span class="text-xs font-semibold text-gray-800">Environnement de démo</span>
						<button
							class="rounded p-0.5 text-gray-400 hover:text-gray-600"
							onclick={() => { widgetExpanded = false; }}
							title="Fermer"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					</div>
					<p class="text-[11px] leading-relaxed text-gray-500">
						Cet environnement est une simulation créée par Lemon Learning pour vous permettre de découvrir l'outil.
					</p>
					<div class="mt-3 border-t border-gray-100 pt-3">
						<a
							href="https://www.lemonlearning.com"
							target="_blank"
							rel="noopener noreferrer"
							class="text-[11px] font-medium text-blue-600 hover:underline"
						>
							En savoir plus sur Lemon Learning
						</a>
					</div>
				</div>
			{/if}

			<!-- Avatar button -->
			<button
				class="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5a623] text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
				onclick={() => { widgetExpanded = !widgetExpanded; }}
				title="Lemon Learning"
			>
				LL
			</button>
		</div>
	{/if}
</div>
