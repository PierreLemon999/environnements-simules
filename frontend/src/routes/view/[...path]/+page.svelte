<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { post } from '$lib/api';
	import {
		Loader2,
		AlertTriangle,
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
	let faviconUrl = $state('');

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

	// Listen for navigation messages from the demo iframe
	function handleDemoMessage(e: MessageEvent) {
		if (e.data?.type === 'DEMO_NAVIGATE' && e.data.href) {
			// /demo/subdomain/path → /view/subdomain/path
			const viewHref = e.data.href.replace(/^\/demo\//, '/view/');
			window.location.href = viewHref;
		}
	}

	onMount(async () => {
		window.addEventListener('message', handleDemoMessage);

		// Fetch project favicon
		if (subdomain) {
			try {
				const favRes = await fetch(`/api/projects/by-subdomain/${subdomain}/favicon`);
				if (favRes.ok) {
					const favData = await favRes.json();
					faviconUrl = favData.data?.faviconUrl ?? '';
				}
			} catch { /* ignore */ }
		}

		try {
			// If there's a token, verify demo access
			if (accessToken) {
				try {
					await post('/auth/demo-access', {
						accessToken: accessToken,
						password: '',
					});
				} catch {
					// Silent fail — the demo endpoint itself doesn't require auth
				}
			}

			if (demoApiUrl) {
				try {
					const checkRes = await fetch(demoApiUrl, { method: 'HEAD' });
					if (checkRes.ok) {
						iframeUrl = demoApiUrl;
					} else {
						iframeError = true;
						loading = false;
					}
				} catch {
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

	onDestroy(() => {
		window.removeEventListener('message', handleDemoMessage);
	});
</script>

<svelte:head>
	<title>Démo — Lemon Lab</title>
	{#if faviconUrl}
		<link rel="icon" href={faviconUrl} />
	{/if}
	<style>
		body {
			margin: 0;
			padding: 0;
			overflow: hidden;
		}
		@keyframes pulseGlow {
			0%, 100% { box-shadow: 0 4px 16px rgba(250,225,0,.35), 0 1px 3px rgba(0,0,0,.12); }
			50% { box-shadow: 0 4px 24px rgba(250,225,0,.5), 0 1px 3px rgba(0,0,0,.12); }
		}
	</style>
</svelte:head>

<div class="relative h-screen w-screen bg-white">
	<!-- Loading state -->
	{#if loading && !iframeLoaded}
		<div class="absolute inset-0 z-10 flex items-center justify-center bg-white">
			<div class="text-center">
				<Loader2 class="mx-auto h-6 w-6 animate-spin text-gray-400" />
				<p class="mt-3 text-sm text-gray-400">Chargement...</p>
			</div>
		</div>
	{/if}

	<!-- Error state -->
	{#if iframeError}
		<div class="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
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

	<!-- Floating LL badge (bottom-right) — only when loaded successfully -->
	{#if iframeLoaded && !iframeError}
		<div class="ll-badge" title="Lemon Learning">LL</div>
	{/if}
</div>

<style>
	.ll-badge {
		position: fixed;
		bottom: 20px;
		right: 20px;
		z-index: 9990;
		width: 48px;
		height: 48px;
		background: #FAE100;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #1E2737;
		font-weight: 800;
		font-size: 16px;
		letter-spacing: -0.02em;
		cursor: pointer;
		animation: pulseGlow 3s ease-in-out infinite;
		transition: transform .25s cubic-bezier(.34,1.56,.64,1);
	}
	.ll-badge:hover {
		transform: scale(1.1);
	}
	.ll-badge:active {
		transform: scale(1.04);
	}
</style>
