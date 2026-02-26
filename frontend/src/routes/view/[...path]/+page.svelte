<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { post } from '$lib/api';
	import {
		Loader2,
		AlertTriangle,
		BookOpen,
		Maximize,
		Info,
		X,
	} from 'lucide-svelte';

	// Parse the URL path to get subdomain and page path
	let fullPath = $derived($page.params.path ?? '');
	let pathSegments = $derived(fullPath.split('/'));
	let subdomain = $derived(pathSegments[0] ?? '');
	let pagePath = $derived(pathSegments.slice(1).join('/'));

	// State
	let loading = $state(true);
	let iframeUrl = $state('');
	let iframeError = $state(false);
	let iframeLoaded = $state(false);
	let widgetExpanded = $state(false);
	let isFullscreen = $state(false);

	// Hover toolbar state
	let toolbarVisible = $state(false);
	let toolbarTimeout: ReturnType<typeof setTimeout> | null = $state(null);

	// Info panel state
	let infoPanelOpen = $state(false);

	// Build the demo API URL — use proxy path
	let demoApiUrl = $derived(
		subdomain ? `/demo-api/${subdomain}/${pagePath}` : ''
	);

	// Check for access token in URL params
	let accessToken = $derived(
		$page.url.searchParams.get('token') ?? ''
	);

	function handleIframeLoad() {
		iframeLoaded = true;
		iframeError = false;
		loading = false;
	}

	function handleIframeError() {
		iframeError = true;
		iframeLoaded = false;
		loading = false;
	}

	function showToolbar() {
		toolbarVisible = true;
		if (toolbarTimeout) clearTimeout(toolbarTimeout);
		toolbarTimeout = setTimeout(() => {
			toolbarVisible = false;
		}, 3000);
	}

	function hideToolbar() {
		if (toolbarTimeout) clearTimeout(toolbarTimeout);
		toolbarTimeout = setTimeout(() => {
			toolbarVisible = false;
		}, 500);
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
			isFullscreen = true;
		} else {
			document.exitFullscreen();
			isFullscreen = false;
		}
	}

	onMount(async () => {
		try {
			// If there's a token, verify demo access
			if (accessToken) {
				try {
					await post('/auth/demo-access', {
						accessToken: accessToken,
						password: '', // Link access — verification is best-effort
					});
				} catch {
					// Silent fail — the demo endpoint itself doesn't require auth
				}
			}

			if (demoApiUrl) {
				// Pre-check that the demo URL responds OK before loading iframe
				try {
					const checkRes = await fetch(demoApiUrl, { method: 'HEAD' });
					if (checkRes.ok) {
						iframeUrl = demoApiUrl;
					} else {
						iframeError = true;
						loading = false;
					}
				} catch {
					// HEAD may not be supported, try loading iframe anyway
					iframeUrl = demoApiUrl;
				}
			} else {
				iframeError = true;
				loading = false;
			}
		} catch (err) {
			console.error('Demo viewer error:', err);
			iframeError = true;
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Démo — Environnements Simulés</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			overflow: hidden;
		}
	</style>
</svelte:head>

<div class="relative h-screen w-screen bg-white">
	<!-- Loading state -->
	{#if loading && !iframeLoaded}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center bg-white"
		>
			<div class="text-center">
				<Loader2
					class="mx-auto h-6 w-6 animate-spin text-gray-400"
				/>
				<p class="mt-3 text-sm text-gray-400">Chargement...</p>
			</div>
		</div>
	{/if}

	<!-- Error state -->
	{#if iframeError}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center bg-gray-50"
		>
			<div class="text-center">
				<AlertTriangle class="mx-auto h-10 w-10 text-gray-300" />
				<p class="mt-3 text-sm font-medium text-gray-700">
					Cette démo n'est pas disponible
				</p>
				<p class="mt-1 max-w-sm text-sm text-gray-400">
					Le lien est peut-être expiré ou la démo n'existe plus.
				</p>
				<button
					class="mt-4 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
					onclick={() => window.location.reload()}
				>
					Réessayer
				</button>
			</div>
		</div>
	{/if}

	<!-- Full-screen demo iframe -->
	{#if iframeUrl && !iframeError}
		<iframe
			src={iframeUrl}
			class="h-full w-full border-0"
			title="Démo"
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
			onload={handleIframeLoad}
			onerror={handleIframeError}
		></iframe>
	{/if}

	<!-- Hover detection zone at top-right -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed right-0 top-0 z-40 h-12 w-64"
		onmouseenter={showToolbar}
		onmouseleave={hideToolbar}
	>
		<!-- Minimal hover toolbar -->
		<div
			class="absolute right-4 top-3 flex items-center gap-1 rounded-lg border border-gray-200/80 bg-white/95 px-1 py-1 shadow-lg backdrop-blur-sm transition-all duration-200"
			class:opacity-0={!toolbarVisible}
			class:translate-y-[-4px]={!toolbarVisible}
			class:pointer-events-none={!toolbarVisible}
			class:opacity-100={toolbarVisible}
			class:translate-y-0={toolbarVisible}
			onmouseenter={showToolbar}
			onmouseleave={hideToolbar}
		>
			<button
				class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
				title="Guides"
			>
				<BookOpen class="h-3.5 w-3.5" />
				<span>Guides</span>
			</button>

			<div class="h-4 w-px bg-gray-200"></div>

			<button
				class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
				onclick={toggleFullscreen}
				title="Plein écran"
			>
				<Maximize class="h-3.5 w-3.5" />
				<span>{isFullscreen ? 'Quitter' : 'Plein écran'}</span>
			</button>

			<div class="h-4 w-px bg-gray-200"></div>

			<button
				class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
				onclick={() => {
					infoPanelOpen = !infoPanelOpen;
				}}
				title="Informations"
			>
				<Info class="h-3.5 w-3.5" />
				<span>Info</span>
			</button>
		</div>
	</div>

	<!-- Info panel (slides in from right) -->
	{#if infoPanelOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50"
			onclick={() => {
				infoPanelOpen = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') infoPanelOpen = false;
			}}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="absolute right-0 top-0 h-full w-80 border-l border-gray-200 bg-white p-6 shadow-lg"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="mb-6 flex items-center justify-between">
					<h3 class="text-sm font-semibold text-gray-900">
						Informations
					</h3>
					<button
						class="rounded-md p-1 text-gray-400 hover:text-gray-600"
						onclick={() => {
							infoPanelOpen = false;
						}}
					>
						<X class="h-4 w-4" />
					</button>
				</div>
				<div class="space-y-4">
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
							Type
						</p>
						<p class="mt-1 text-sm text-gray-700">
							Environnement de démonstration
						</p>
					</div>
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
							Description
						</p>
						<p class="mt-1 text-sm leading-relaxed text-gray-600">
							Cet environnement est une simulation créée par Lemon
							Learning pour vous permettre de découvrir l'outil en
							conditions réelles.
						</p>
					</div>
					<div class="border-t border-gray-100 pt-4">
						<a
							href="https://www.lemonlearning.com"
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm font-medium text-blue-600 hover:underline"
						>
							En savoir plus sur Lemon Learning
						</a>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Floating LL avatar widget (bottom-right) — only when loaded successfully -->
	{#if iframeLoaded && !iframeError}
	<div class="fixed bottom-5 right-5 z-50">
		{#if widgetExpanded}
			<!-- Expanded widget -->
			<div
				class="mb-2 w-56 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
			>
				<div class="mb-3 flex items-center justify-between">
					<span class="text-xs font-semibold text-gray-800"
						>Environnement de démo</span
					>
					<button
						class="rounded p-0.5 text-gray-400 hover:text-gray-600"
						onclick={() => {
							widgetExpanded = false;
						}}
						title="Fermer"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				</div>
				<p class="text-[11px] leading-relaxed text-gray-500">
					Cet environnement est une simulation créée par Lemon
					Learning pour vous permettre de découvrir l'outil.
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
			onclick={() => {
				widgetExpanded = !widgetExpanded;
			}}
			title="Lemon Learning"
		>
			LL
		</button>
	</div>
	{/if}
</div>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			infoPanelOpen = false;
			widgetExpanded = false;
		}
	}}
/>
