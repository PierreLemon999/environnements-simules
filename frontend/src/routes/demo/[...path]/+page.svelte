<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get } from '$lib/api';
	import {
		Share2,
		Copy,
		ExternalLink,
		Settings,
		Users,
		Search,
		Check,
		Loader2,
		X,
		Lock,
		AlertTriangle,
		ChevronUp,
	} from 'lucide-svelte';

	// Types
	interface Project {
		id: string;
		name: string;
		toolName: string;
		subdomain: string;
		versions: Array<{
			id: string;
			name: string;
			status: string;
			pageCount?: number;
		}>;
	}

	interface PageInfo {
		id: string;
		title: string;
		urlPath: string;
		healthStatus: string;
	}

	// Parse the URL path to get subdomain and page path
	let fullPath = $derived($page.params.path ?? '');
	let pathSegments = $derived(fullPath.split('/'));
	let subdomain = $derived(pathSegments[0] ?? '');
	let pagePath = $derived(pathSegments.slice(1).join('/'));

	// State
	let currentProject: Project | null = $state(null);
	let currentPages: PageInfo[] = $state([]);
	let selectedVersionId = $state('');
	let loading = $state(true);
	let iframeUrl = $state('');
	let iframeError = $state(false);
	let iframeLoaded = $state(false);
	let copiedUrl = $state(false);

	// Floating card state
	let cardOpen = $state(false);
	let searchQuery = $state('');

	// Share dialog
	let shareDialogOpen = $state(false);
	let shareLinkDuration = $state(90);
	let shareLinkPassword = $state('');
	let shareGeneratedUrl = $state('');
	let shareCopied = $state(false);

	// Stats from project
	let totalPages = $derived(currentPages.length);

	// Demo URL construction — use proxy path; ensure trailing slash for root page
	let demoApiUrl = $derived(
		subdomain ? `/demo-api/${subdomain}/${pagePath}` : ''
	);

	// Current page title
	let currentPageTitle = $derived(() => {
		const match = currentPages.find(
			(p) => p.urlPath === pagePath || `/${p.urlPath}` === `/${pagePath}`
		);
		return match?.title ?? (pagePath || 'Accueil');
	});

	// Filtered pages for search
	let filteredPages = $derived(() => {
		if (!searchQuery.trim()) return currentPages;
		const q = searchQuery.toLowerCase();
		return currentPages.filter(
			(p) =>
				p.title.toLowerCase().includes(q) ||
				p.urlPath.toLowerCase().includes(q)
		);
	});

	function copyUrl() {
		const url = window.location.href;
		navigator.clipboard.writeText(url);
		copiedUrl = true;
		setTimeout(() => {
			copiedUrl = false;
		}, 2000);
	}

	function openShareDialog() {
		cardOpen = false;
		shareDialogOpen = true;
		shareGeneratedUrl = window.location.href;
		shareCopied = false;
	}

	function copyShareLink() {
		navigator.clipboard.writeText(shareGeneratedUrl);
		shareCopied = true;
		setTimeout(() => {
			shareCopied = false;
		}, 2000);
	}

	function openAsClient() {
		window.open(`/view/${fullPath}`, '_blank');
	}

	function navigateToPage(pageUrlPath: string) {
		window.location.href = `/demo/${subdomain}/${pageUrlPath}`;
	}

	function handleIframeLoad() {
		iframeLoaded = true;
		iframeError = false;
	}

	function handleIframeError() {
		iframeError = true;
		iframeLoaded = false;
		loading = false;
	}

	onMount(async () => {
		try {
			// Pre-check that the demo URL responds OK before loading iframe
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
					// HEAD may not be supported, try loading iframe anyway
					iframeUrl = demoApiUrl;
				}
			} else {
				iframeError = true;
				loading = false;
			}

			// Fetch project metadata in background (non-blocking for iframe)
			const res = await get<{
				data: Array<{
					id: string;
					name: string;
					toolName: string;
					subdomain: string;
				}>;
			}>('/projects');

			const match = res.data.find((p) => p.subdomain === subdomain);
			if (match) {
				const detail = await get<{ data: Project }>(
					`/projects/${match.id}`
				);
				currentProject = detail.data;

				const activeVersion = currentProject.versions?.find(
					(v) => v.status === 'active'
				);
				selectedVersionId =
					activeVersion?.id ??
					currentProject.versions?.[0]?.id ??
					'';

				if (selectedVersionId) {
					const pagesRes = await get<{ data: PageInfo[] }>(
						`/versions/${selectedVersionId}/pages`
					);
					currentPages = pagesRes.data;
				}
			}
		} catch (err) {
			console.error('Demo viewer init error:', err);
			// Don't set iframeError — the iframe may still work even if metadata fails
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title
		>Démo {currentProject?.toolName ?? ''} — Environnements Simulés</title
	>
</svelte:head>

<!-- Full-screen container -->
<div class="relative flex h-screen w-screen flex-col overflow-hidden bg-white">
	<!-- Admin toolbar at top (R010 mockup) -->
	{#if currentProject && iframeLoaded && !iframeError}
		<div class="z-20 flex shrink-0 items-center justify-between bg-[#1a1a2e] px-4 py-2">
			<div class="flex items-center gap-3">
				<div class="flex h-6 w-6 items-center justify-center rounded-md bg-[#f5a623] text-[10px] font-bold text-white">
					LL
				</div>
				<span class="text-sm font-semibold text-white">Démo {currentProject.toolName}</span>
				{#if currentProject.versions?.length > 0}
					{@const activeVersion = currentProject.versions.find(v => v.status === 'active') ?? currentProject.versions[0]}
					<span class="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">
						{activeVersion.name}
					</span>
				{/if}
				<span class="text-xs text-white/40">{totalPages} page{totalPages !== 1 ? 's' : ''}</span>
			</div>
			<div class="flex items-center gap-2">
				<button
					class="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
					onclick={openShareDialog}
				>
					<Share2 class="h-3.5 w-3.5" />
					Partager le lien
				</button>
				<button
					class="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
					onclick={copyUrl}
				>
					{#if copiedUrl}
						<Check class="h-3.5 w-3.5" />
						Copié !
					{:else}
						<Copy class="h-3.5 w-3.5" />
						Copier l'URL
					{/if}
				</button>
				<button
					class="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
					onclick={openAsClient}
				>
					<ExternalLink class="h-3.5 w-3.5" />
					Ouvrir en tant que client
				</button>
			</div>
		</div>
	{/if}

	<!-- Demo iframe — fills remaining viewport -->
	{#if iframeError && !iframeUrl}
		<div class="flex h-full items-center justify-center bg-gray-50">
			<div class="text-center">
				<AlertTriangle class="mx-auto h-10 w-10 text-gray-300" />
				<p class="mt-3 text-sm font-medium text-gray-700">
					Erreur de chargement
				</p>
				<p class="mt-1 max-w-sm text-sm text-gray-400">
					La démo n'a pas pu être chargée. Vérifiez que le projet
					existe et que le backend est démarré.
				</p>
				<button
					class="mt-4 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
					onclick={() => window.location.reload()}
				>
					Réessayer
				</button>
			</div>
		</div>
	{:else if iframeUrl}
		{#if loading || !iframeLoaded}
			<div
				class="absolute inset-0 z-10 flex items-center justify-center bg-white"
			>
				<div class="text-center">
					<Loader2
						class="mx-auto h-8 w-8 animate-spin text-blue-500"
					/>
					<p class="mt-3 text-sm text-gray-400">
						Chargement de la démo...
					</p>
				</div>
			</div>
		{/if}

		{#if iframeError}
			<div
				class="absolute inset-0 z-10 flex items-center justify-center bg-gray-50"
			>
				<div class="text-center">
					<AlertTriangle class="mx-auto h-10 w-10 text-gray-300" />
					<p class="mt-3 text-sm font-medium text-gray-700">
						Impossible de charger la démo
					</p>
					<p class="mt-1 max-w-sm text-sm text-gray-400">
						Le contenu n'a pas pu être affiché. Vérifiez que le
						backend est démarré et que la page existe.
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

		<iframe
			src={iframeUrl}
			class="min-h-0 flex-1 w-full border-0"
			title="Aperçu de la démo"
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
			onload={handleIframeLoad}
			onerror={handleIframeError}
		></iframe>
	{:else}
		<div class="flex h-full items-center justify-center bg-gray-50">
			<div class="text-center">
				<Loader2
					class="mx-auto h-8 w-8 animate-spin text-blue-500"
				/>
				<p class="mt-3 text-sm text-gray-400">
					Chargement de la démo...
				</p>
			</div>
		</div>
	{/if}

	<!-- Floating "LL" badge at bottom-right — only when loaded successfully -->
	{#if iframeLoaded && !iframeError}
	<div class="fixed bottom-5 right-5 z-50">
		{#if !cardOpen}
			<button
				class="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5a623] text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
				onclick={() => {
					cardOpen = true;
				}}
				title="Lemon Learning"
			>
				LL
			</button>
		{/if}
	</div>

	<!-- Floating card (expanded) -->
	{#if cardOpen}
		<div class="fixed bottom-20 right-5 z-50">
			<div
				class="w-[560px] max-w-[90vw] rounded-xl bg-[#1a1a2e] shadow-2xl"
			>
				<!-- Card header -->
				<div
					class="flex items-center justify-between border-b border-white/10 px-4 py-2.5"
				>
					<div class="flex items-center gap-2">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-md bg-[#f5a623] text-[10px] font-bold text-white"
						>
							LL
						</div>
						<div>
							<span class="text-sm font-semibold text-white"
								>{currentProject?.toolName ?? 'Démo'}</span
							>
							{#if currentProject}
								<span class="ml-2 text-xs text-white/40"
									>{currentPageTitle()}</span
								>
							{/if}
						</div>
					</div>
					<button
						class="rounded-md p-1 text-white/40 transition-colors hover:text-white"
						onclick={() => {
							cardOpen = false;
						}}
					>
						<X class="h-4 w-4" />
					</button>
				</div>

				<!-- Search field -->
				<div class="border-b border-white/10 px-4 py-2.5">
					<div class="relative">
						<Search
							class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30"
						/>
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Rechercher une page..."
							class="w-full rounded-md border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-white/20 focus:bg-white/10"
						/>
					</div>
					{#if searchQuery.trim() && filteredPages().length > 0}
						<div
							class="mt-2 max-h-40 overflow-y-auto rounded-md border border-white/10 bg-white/5"
						>
							{#each filteredPages() as pg}
								<button
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/10"
									onclick={() => navigateToPage(pg.urlPath)}
								>
									<span class="truncate">{pg.title}</span>
									<span
										class="ml-auto shrink-0 text-[10px] text-white/30"
										>/{pg.urlPath}</span
									>
								</button>
							{/each}
						</div>
					{:else if searchQuery.trim()}
						<p class="mt-2 text-center text-xs text-white/30">
							Aucun résultat
						</p>
					{/if}
				</div>

				<!-- Action grid -->
				<div class="grid grid-cols-4 gap-1 px-4 py-3">
					<button
						class="flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
						onclick={openShareDialog}
					>
						<Share2 class="h-4 w-4" />
						<span class="text-[10px] font-medium">Partager</span>
					</button>

					<button
						class="flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
						onclick={copyUrl}
					>
						{#if copiedUrl}
							<Check class="h-4 w-4 text-emerald-400" />
							<span
								class="text-[10px] font-medium text-emerald-400"
								>Copié !</span
							>
						{:else}
							<Copy class="h-4 w-4" />
							<span class="text-[10px] font-medium"
								>Copier l'URL</span
							>
						{/if}
					</button>

					<button
						class="flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
						onclick={openAsClient}
					>
						<ExternalLink class="h-4 w-4" />
						<span class="text-[10px] font-medium">Vue client</span>
					</button>

					<button
						class="flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
					>
						<Settings class="h-4 w-4" />
						<span class="text-[10px] font-medium">Paramètres</span>
					</button>
				</div>

				<!-- Bottom info bar -->
				<div
					class="flex items-center justify-between border-t border-white/10 px-4 py-2"
				>
					<div class="flex items-center gap-1.5 text-white/40">
						<Users class="h-3 w-3" />
						<span class="text-[10px]">3 en ligne</span>
					</div>
					<div class="text-[10px] text-white/30">
						{#if currentProject}
							{currentProject.name} — {totalPages} page{totalPages !==
							1
								? 's'
								: ''}
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Backdrop to close card -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-40"
			onclick={() => {
				cardOpen = false;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape') cardOpen = false;
			}}
		></div>
	{/if}
	{/if}
</div>

<!-- Share dialog -->
{#if shareDialogOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
		onmousedown={() => {
			shareDialogOpen = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') shareDialogOpen = false;
		}}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
			onmousedown={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-base font-semibold text-gray-900">
					Partager le lien
				</h3>
				<button
					class="rounded-md p-1 text-gray-400 hover:text-gray-600"
					onclick={() => {
						shareDialogOpen = false;
					}}
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="space-y-4">
				<div class="space-y-1.5">
					<label class="text-xs font-medium text-gray-700"
						>Durée de validité</label
					>
					<select
						bind:value={shareLinkDuration}
						class="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
					>
						<option value={7}>7 jours</option>
						<option value={30}>1 mois</option>
						<option value={90}>3 mois</option>
						<option value={180}>6 mois</option>
						<option value={365}>1 an</option>
						<option value={730}>2 ans</option>
					</select>
				</div>

				<div class="space-y-1.5">
					<label class="text-xs font-medium text-gray-700">
						Mot de passe <span class="text-gray-400"
							>(optionnel)</span
						>
					</label>
					<div class="relative">
						<Lock
							class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
						/>
						<input
							type="password"
							bind:value={shareLinkPassword}
							placeholder="Laisser vide pour aucun"
							class="flex h-9 w-full rounded-md border border-gray-200 bg-white pl-8 pr-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
						/>
					</div>
				</div>

				<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
					<p
						class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
					>
						Lien généré
					</p>
					<div class="flex items-center gap-2">
						<code
							class="flex-1 truncate font-mono text-xs text-gray-700"
							>{shareGeneratedUrl}</code
						>
						<button
							onclick={copyShareLink}
							class="shrink-0 rounded p-1.5 hover:bg-white"
						>
							{#if shareCopied}
								<Check class="h-3.5 w-3.5 text-emerald-500" />
							{:else}
								<Copy class="h-3.5 w-3.5 text-gray-400" />
							{/if}
						</button>
					</div>
				</div>

				<button
					class="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
					onclick={copyShareLink}
				>
					{#if shareCopied}
						<Check class="h-4 w-4" />
						Lien copié !
					{:else}
						<Copy class="h-4 w-4" />
						Copier le lien
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			cardOpen = false;
			shareDialogOpen = false;
		}
	}}
/>
