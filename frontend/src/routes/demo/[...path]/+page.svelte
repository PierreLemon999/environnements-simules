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
		ChevronDown,
		ChevronUp,
		Clock,
		ArrowLeft,
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
	let cardClosing = $state(false);
	let searchQuery = $state('');

	// Share view inside card
	let shareView = $state(false);
	let shareLinkDuration = $state('7d');
	let sharePasswordEnabled = $state(false);
	let shareLinkPassword = $state('');
	let shareGeneratedUrl = $state('');
	let shareCopied = $state(false);

	// Toast state
	let toastMessage = $state('');
	let toastHiding = $state(false);
	let toastTimeout: ReturnType<typeof setTimeout> | null = $state(null);

	// Stats from project
	let totalPages = $derived(currentPages.length);

	// Demo URL construction
	let demoApiUrl = $derived(
		subdomain ? `/demo-api/${subdomain}/${pagePath}` : ''
	);

	// Active version
	let activeVersion = $derived(() => {
		return currentProject?.versions?.find(v => v.status === 'active') ?? currentProject?.versions?.[0];
	});

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

	function showToast(msg: string) {
		if (toastTimeout) clearTimeout(toastTimeout);
		toastMessage = msg;
		toastHiding = false;
		toastTimeout = setTimeout(() => {
			toastHiding = true;
			setTimeout(() => { toastMessage = ''; }, 200);
		}, 2000);
	}

	function copyUrl() {
		const url = window.location.href;
		navigator.clipboard.writeText(url);
		copiedUrl = true;
		showToast('URL copiée');
		setTimeout(() => { copiedUrl = false; }, 2000);
	}

	function openShareView() {
		shareView = true;
		shareGeneratedUrl = window.location.href;
		shareCopied = false;
	}

	function copyShareLink() {
		navigator.clipboard.writeText(shareGeneratedUrl);
		shareCopied = true;
		showToast('Lien copié');
		setTimeout(() => { shareCopied = false; }, 2000);
	}

	function openAsClient() {
		window.open(`/view/${fullPath}`, '_blank');
	}

	function openCard() {
		cardOpen = true;
		cardClosing = false;
		shareView = false;
		searchQuery = '';
	}

	function closeCard() {
		cardClosing = true;
		setTimeout(() => {
			cardOpen = false;
			cardClosing = false;
			shareView = false;
			searchQuery = '';
		}, 250);
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

				const av = currentProject.versions?.find(
					(v) => v.status === 'active'
				);
				selectedVersionId =
					av?.id ?? currentProject.versions?.[0]?.id ?? '';

				if (selectedVersionId) {
					const pagesRes = await get<{ data: PageInfo[] }>(
						`/versions/${selectedVersionId}/pages`
					);
					currentPages = pagesRes.data;
				}
			}
		} catch (err) {
			console.error('Demo viewer init error:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Démo {currentProject?.toolName ?? ''} — Environnements Simulés</title>
	<style>
		body { margin: 0; padding: 0; overflow: hidden; }

		@keyframes cardDropIn {
			from { opacity: 0; transform: translate(-50%, -100%); }
			to { opacity: 1; transform: translate(-50%, 0); }
		}
		@keyframes cardSlideOut {
			from { opacity: 1; transform: translate(-50%, 0); }
			to { opacity: 0; transform: translate(-50%, -100%); }
		}
		@keyframes toastIn {
			0% { opacity: 0; transform: translate(-50%, 10px); }
			100% { opacity: 1; transform: translate(-50%, 0); }
		}
		@keyframes toastOut {
			0% { opacity: 1; transform: translate(-50%, 0); }
			100% { opacity: 0; transform: translate(-50%, -8px); }
		}
		@keyframes pulseGlow {
			0%, 100% { box-shadow: 0 4px 16px rgba(251,191,36,.35), 0 1px 3px rgba(0,0,0,.12); }
			50% { box-shadow: 0 4px 24px rgba(251,191,36,.5), 0 1px 3px rgba(0,0,0,.12); }
		}
		@keyframes pulseDot {
			0%, 100% { opacity: 1; }
			50% { opacity: .4; }
		}
		@keyframes fadeShareIn {
			from { opacity: 0; transform: translateX(12px); }
			to { opacity: 1; transform: translateX(0); }
		}
	</style>
</svelte:head>

<!-- Full-screen container -->
<div class="relative h-screen w-screen overflow-hidden bg-white">
	<!-- Demo iframe — fills entire viewport -->
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
			<div class="absolute inset-0 z-10 flex items-center justify-center bg-white">
				<div class="text-center">
					<Loader2 class="mx-auto h-8 w-8 animate-spin text-blue-500" />
					<p class="mt-3 text-sm text-gray-400">Chargement de la démo...</p>
				</div>
			</div>
		{/if}

		{#if iframeError}
			<div class="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
				<div class="text-center">
					<AlertTriangle class="mx-auto h-10 w-10 text-gray-300" />
					<p class="mt-3 text-sm font-medium text-gray-700">Impossible de charger la démo</p>
					<p class="mt-1 max-w-sm text-sm text-gray-400">
						Le contenu n'a pas pu être affiché. Vérifiez que le backend est démarré et que la page existe.
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
			class="h-full w-full border-0"
			title="Aperçu de la démo"
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
			onload={handleIframeLoad}
			onerror={handleIframeError}
		></iframe>
	{:else}
		<div class="flex h-full items-center justify-center bg-gray-50">
			<div class="text-center">
				<Loader2 class="mx-auto h-8 w-8 animate-spin text-blue-500" />
				<p class="mt-3 text-sm text-gray-400">Chargement de la démo...</p>
			</div>
		</div>
	{/if}

	<!-- ================================================ -->
	<!--  TONGUE TAB (collapsed state) — top center       -->
	<!-- ================================================ -->
	{#if iframeLoaded && !iframeError && !cardOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="tongue-tab"
			onclick={openCard}
			onkeydown={(e) => { if (e.key === 'Enter') openCard(); }}
		>
			<span class="tongue-label">LL</span>
			<span class="tongue-chevron">
				<ChevronDown class="h-2 w-2" />
			</span>
		</div>
	{/if}

	<!-- ================================================ -->
	<!--  BACKDROP (click outside to close)               -->
	<!-- ================================================ -->
	{#if cardOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[9999]"
			onclick={closeCard}
			onkeydown={(e) => { if (e.key === 'Escape') closeCard(); }}
		></div>
	{/if}

	<!-- ================================================ -->
	<!--  FLOATING DROP-DOWN CARD                         -->
	<!-- ================================================ -->
	{#if cardOpen}
		<div
			class="dropdown-card"
			class:open={cardOpen && !cardClosing}
			class:closing={cardClosing}
		>
			{#if !shareView}
			<!-- ========== MAIN VIEW ========== -->
			<div>
				<!-- Header row -->
				<div class="card-header">
					<div class="card-logo">
						<div class="card-logo-icon">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
								<path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
							</svg>
						</div>
						LL Demo
					</div>
					<div class="card-project-name">
						{currentProject?.toolName ?? 'Démo'}
						{#if currentProject}
							— {currentPageTitle()}
						{/if}
					</div>
					<div class="card-header-right">
						<div class="card-activity">
							<Clock class="h-[11px] w-[11px]" />
							il y a 2 min
						</div>
						{#if activeVersion()}
							<div class="card-version-badge">
								<span class="dot"></span>
								{activeVersion()?.name}
							</div>
						{/if}
						<button class="card-close-btn" onclick={closeCard} title="Fermer">
							<X class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>

				<!-- Search bar -->
				<div class="card-search-bar">
					<div class="card-search-wrap">
						<Search class="card-search-icon" />
						<input
							class="card-search-input"
							type="text"
							bind:value={searchQuery}
							placeholder="Rechercher une page, un guide, une action..."
						/>
					</div>
					{#if searchQuery.trim() && filteredPages().length > 0}
						<div class="mt-2 max-h-40 overflow-y-auto rounded-md border border-white/10 bg-white/5">
							{#each filteredPages() as pg}
								<button
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/10"
									onclick={() => navigateToPage(pg.urlPath)}
								>
									<span class="truncate">{pg.title}</span>
									<span class="ml-auto shrink-0 text-[10px] text-white/30">/{pg.urlPath}</span>
								</button>
							{/each}
						</div>
					{:else if searchQuery.trim()}
						<p class="mt-2 text-center text-xs text-white/30">Aucun résultat</p>
					{/if}
				</div>

				<!-- Action grid: 2 rows x 3 columns -->
				<div class="card-actions-grid">
					<!-- Row 1 -->
					<button class="card-action-tile primary" onclick={openShareView}>
						<div class="tile-icon">
							<Share2 class="h-3.5 w-3.5" />
						</div>
						<span class="tile-label">Partager</span>
					</button>
					<button class="card-action-tile" onclick={copyUrl}>
						<div class="tile-icon">
							{#if copiedUrl}
								<Check class="h-3.5 w-3.5" />
							{:else}
								<Copy class="h-3.5 w-3.5" />
							{/if}
						</div>
						<span class="tile-label">{copiedUrl ? 'Copié !' : "Copier l'URL"}</span>
					</button>
					<button class="card-action-tile" onclick={openAsClient}>
						<div class="tile-icon">
							<ExternalLink class="h-3.5 w-3.5" />
						</div>
						<span class="tile-label">Vue client</span>
					</button>

					<!-- Row 2 -->
					<button class="card-action-tile">
						<div class="tile-icon">
							<Settings class="h-3.5 w-3.5" />
						</div>
						<span class="tile-label">Paramètres</span>
					</button>
					<button class="card-action-tile">
						<div class="tile-icon">
							<Users class="h-3.5 w-3.5" />
						</div>
						<span class="tile-label">3 en ligne</span>
						<span class="tile-live-dot"></span>
					</button>
					<button class="card-action-tile">
						<div class="tile-icon">
							<Search class="h-3.5 w-3.5" />
						</div>
						<span class="tile-label">Rechercher</span>
					</button>
				</div>
			</div>

			{:else}
			<!-- ========== SHARE VIEW ========== -->
			<div style="animation: fadeShareIn 0.25s ease forwards;">
				<div class="share-header">
					<button class="share-back-btn" onclick={() => { shareView = false; }} title="Retour">
						<ArrowLeft class="h-4 w-4" />
					</button>
					<div class="share-title">Partager le lien</div>
				</div>
				<div class="share-body">
					<!-- URL -->
					<div class="share-field">
						<div class="share-field-label">Lien de partage</div>
						<div class="share-url-row">
							<input class="share-url-input" type="text" value={shareGeneratedUrl} readonly />
							<button class="share-copy-btn" onclick={copyShareLink} title="Copier">
								{#if shareCopied}
									<Check class="h-3.5 w-3.5" />
								{:else}
									<Copy class="h-3.5 w-3.5" />
								{/if}
							</button>
						</div>
					</div>

					<!-- Duration -->
					<div class="share-field">
						<div class="share-field-label">Durée de validité</div>
						<select class="share-select" bind:value={shareLinkDuration}>
							<option value="24h">24 heures</option>
							<option value="7d">7 jours</option>
							<option value="30d">30 jours</option>
							<option value="permanent">Permanent</option>
						</select>
					</div>

					<!-- Password -->
					<div class="share-field">
						<div class="share-field-label">Mot de passe</div>
						<div class="share-password-row">
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="share-password-toggle"
								class:on={sharePasswordEnabled}
								onclick={() => { sharePasswordEnabled = !sharePasswordEnabled; }}
								onkeydown={(e) => { if (e.key === 'Enter') sharePasswordEnabled = !sharePasswordEnabled; }}
								role="switch"
								aria-checked={sharePasswordEnabled}
								tabindex="0"
							></div>
							<input
								class="share-password-input"
								type="password"
								placeholder="Mot de passe..."
								disabled={!sharePasswordEnabled}
								bind:value={shareLinkPassword}
							/>
						</div>
					</div>

					<!-- Generate button -->
					<button class="share-generate-btn" onclick={copyShareLink}>
						{shareCopied ? 'Lien copié !' : 'Copier le lien de partage'}
					</button>
				</div>
			</div>
			{/if}

			<!-- Bottom tab (close handle) -->
			<div class="card-bottom-tab" onclick={closeCard}>
				<ChevronUp class="h-3 w-3" />
			</div>
		</div>
	{/if}

	<!-- ================================================ -->
	<!--  LL BADGE — bottom-right                         -->
	<!-- ================================================ -->
	{#if iframeLoaded && !iframeError}
		<div class="ll-badge" title="Lemon Learning">LL</div>
	{/if}

	<!-- ================================================ -->
	<!--  TOAST NOTIFICATION                              -->
	<!-- ================================================ -->
	{#if toastMessage}
		<div
			class="toast"
			class:hiding={toastHiding}
		>
			<Check class="h-4 w-4 text-emerald-400" />
			{toastMessage}
		</div>
	{/if}
</div>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			if (shareView) {
				shareView = false;
			} else if (cardOpen) {
				closeCard();
			}
		}
	}}
/>

<style>
	/* ============================== */
	/*  TONGUE TAB (CLOSED STATE)     */
	/* ============================== */
	.tongue-tab {
		position: fixed;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10001;
		width: 60px;
		height: 14px;
		background: rgba(12, 10, 9, 0.7);
		border-left: 2px solid #fbbf24;
		border-radius: 0 0 8px 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		cursor: pointer;
		transition: width 0.2s ease, height 0.2s ease, background 0.2s ease;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
	.tongue-tab:hover {
		width: 72px;
		height: 16px;
		background: rgba(12, 10, 9, 0.85);
	}
	.tongue-label {
		font-size: 9px;
		font-weight: 700;
		color: #fbbf24;
		opacity: 0.5;
		letter-spacing: -0.02em;
		line-height: 1;
	}
	.tongue-tab:hover .tongue-label { opacity: 0.8; }
	.tongue-chevron {
		color: #fbbf24;
		opacity: 0.4;
		display: flex;
		align-items: center;
	}
	.tongue-tab:hover .tongue-chevron { opacity: 0.7; }

	/* ============================== */
	/*  FLOATING DROP-DOWN CARD       */
	/* ============================== */
	.dropdown-card {
		position: fixed;
		top: 8px;
		left: 50%;
		transform: translate(-50%, -100%);
		z-index: 10000;
		width: 600px;
		max-width: 90vw;
		max-height: 360px;
		background: rgba(12, 10, 9, 0.95);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border: 1px solid rgba(255,255,255,.08);
		border-radius: 12px;
		box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.15);
		color: #fff;
		font-size: 13px;
		opacity: 0;
		pointer-events: none;
		overflow: hidden;
	}
	.dropdown-card.open {
		opacity: 1;
		transform: translate(-50%, 0);
		pointer-events: all;
		animation: cardDropIn 0.35s cubic-bezier(.4,0,.2,1) forwards;
	}
	.dropdown-card.closing {
		animation: cardSlideOut 0.25s cubic-bezier(.4,0,.2,1) forwards;
		pointer-events: none;
	}

	/* Card bottom tab/handle */
	.card-bottom-tab {
		position: absolute;
		bottom: -18px;
		left: 50%;
		transform: translateX(-50%);
		width: 52px;
		height: 18px;
		background: rgba(12, 10, 9, 0.95);
		border: 1px solid rgba(255,255,255,.08);
		border-top: none;
		border-radius: 0 0 8px 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		color: rgba(255,255,255,0.4);
	}
	.card-bottom-tab:hover {
		background: rgba(30, 28, 27, 0.98);
		color: rgba(255,255,255,0.7);
	}

	/* ============================== */
	/*  CARD — HEADER ROW             */
	/* ============================== */
	.card-header {
		height: 40px;
		display: flex;
		align-items: center;
		padding: 0 16px;
		gap: 10px;
		border-bottom: 1px solid rgba(255,255,255,.08);
		flex-shrink: 0;
	}
	.card-logo {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 700;
		font-size: 12px;
		color: #fbbf24;
		letter-spacing: -0.01em;
		flex-shrink: 0;
	}
	.card-logo-icon {
		width: 22px;
		height: 22px;
		background: rgba(251,191,36,.15);
		border-radius: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fbbf24;
	}
	:global(.card-logo-icon svg) { width: 12px; height: 12px; }

	.card-project-name {
		font-weight: 500;
		font-size: 12px;
		color: rgba(255,255,255,.75);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		min-width: 0;
	}

	.card-header-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
		margin-left: auto;
	}

	.card-activity {
		font-size: 10.5px;
		color: rgba(255,255,255,.4);
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.card-version-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		background: rgba(251,191,36,.1);
		border: 1px solid rgba(251,191,36,.18);
		border-radius: 5px;
		font-size: 10.5px;
		font-weight: 600;
		color: #fbbf24;
		white-space: nowrap;
	}
	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #22c55e;
		display: inline-block;
	}

	.card-close-btn {
		width: 26px;
		height: 26px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: rgba(255,255,255,.4);
		background: none;
		border: none;
		transition: background .15s, color .15s;
	}
	.card-close-btn:hover {
		background: rgba(255,255,255,.1);
		color: #fff;
	}

	/* ============================== */
	/*  CARD — SEARCH BAR             */
	/* ============================== */
	.card-search-bar {
		padding: 8px 16px;
		border-bottom: 1px solid rgba(255,255,255,.08);
		flex-shrink: 0;
	}
	.card-search-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	:global(.card-search-icon) {
		position: absolute;
		left: 10px;
		width: 14px !important;
		height: 14px !important;
		color: rgba(255,255,255,.35);
		pointer-events: none;
	}
	.card-search-input {
		width: 100%;
		height: 36px;
		background: rgba(255,255,255,.06);
		border: 1px solid rgba(255,255,255,.1);
		border-radius: 8px;
		padding: 0 12px 0 32px;
		color: #fff;
		font-size: 12.5px;
		font-family: inherit;
		outline: none;
		transition: background .15s, border-color .15s;
	}
	.card-search-input:focus {
		background: rgba(255,255,255,.1);
		border-color: rgba(251,191,36,.35);
	}
	.card-search-input::placeholder {
		color: rgba(255,255,255,.35);
	}

	/* ============================== */
	/*  CARD — ACTION GRID            */
	/* ============================== */
	.card-actions-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
		padding: 10px 16px 14px;
	}

	.card-action-tile {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(255,255,255,.04);
		border: 1px solid rgba(255,255,255,.06);
		cursor: pointer;
		transition: background .15s, border-color .15s;
		font-family: inherit;
		color: #fff;
	}
	.card-action-tile:hover {
		background: rgba(255,255,255,.1);
		border-color: rgba(255,255,255,.14);
	}
	.card-action-tile.primary {
		background: rgba(251,191,36,.1);
		border-color: rgba(251,191,36,.18);
	}
	.card-action-tile.primary:hover {
		background: rgba(251,191,36,.18);
		border-color: rgba(251,191,36,.3);
	}

	.tile-icon {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: rgba(255,255,255,.06);
		color: rgba(255,255,255,.6);
	}
	.card-action-tile.primary .tile-icon {
		background: rgba(251,191,36,.15);
		color: #fbbf24;
	}

	.tile-label {
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.card-action-tile.primary .tile-label {
		color: #fbbf24;
		font-weight: 600;
	}

	.tile-live-dot {
		width: 6px;
		height: 6px;
		background: #22c55e;
		border-radius: 50%;
		flex-shrink: 0;
		animation: pulseDot 2s ease-in-out infinite;
		margin-left: -4px;
	}

	/* ============================== */
	/*  CARD — SHARE VIEW             */
	/* ============================== */
	.share-header {
		height: 40px;
		display: flex;
		align-items: center;
		padding: 0 16px;
		gap: 10px;
		border-bottom: 1px solid rgba(255,255,255,.08);
	}
	.share-back-btn {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: rgba(255,255,255,.5);
		background: none;
		border: none;
		transition: background .15s, color .15s;
	}
	.share-back-btn:hover {
		background: rgba(255,255,255,.1);
		color: #fff;
	}
	.share-title {
		font-size: 13px;
		font-weight: 600;
		color: #fff;
	}

	.share-body {
		padding: 12px 16px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: 280px;
		overflow-y: auto;
	}

	.share-field {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.share-field-label {
		font-size: 11px;
		font-weight: 600;
		color: rgba(255,255,255,.45);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.share-url-row {
		display: flex;
		gap: 6px;
	}
	.share-url-input {
		flex: 1;
		height: 34px;
		background: rgba(255,255,255,.06);
		border: 1px solid rgba(255,255,255,.1);
		border-radius: 7px;
		padding: 0 10px;
		color: rgba(255,255,255,.6);
		font-size: 11.5px;
		font-family: ui-monospace, monospace;
		outline: none;
	}
	.share-copy-btn {
		width: 34px;
		height: 34px;
		border-radius: 7px;
		border: 1px solid rgba(255,255,255,.1);
		background: rgba(255,255,255,.06);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: rgba(255,255,255,.5);
		transition: background .15s, color .15s;
		flex-shrink: 0;
	}
	.share-copy-btn:hover {
		background: rgba(255,255,255,.12);
		color: #fff;
	}

	.share-select {
		appearance: none;
		height: 34px;
		background: rgba(255,255,255,.06);
		border: 1px solid rgba(255,255,255,.1);
		border-radius: 7px;
		padding: 0 32px 0 10px;
		color: #fff;
		font-size: 12px;
		font-family: inherit;
		font-weight: 500;
		cursor: pointer;
		outline: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 10px center;
	}
	.share-select option {
		background: #1a1a1a;
		color: #fff;
	}

	.share-password-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.share-password-toggle {
		width: 36px;
		height: 20px;
		background: #444;
		border-radius: 10px;
		position: relative;
		cursor: pointer;
		transition: background .2s;
		flex-shrink: 0;
	}
	.share-password-toggle.on {
		background: #fbbf24;
	}
	.share-password-toggle::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: #fff;
		border-radius: 50%;
		transition: transform .2s;
		box-shadow: 0 1px 3px rgba(0,0,0,.2);
	}
	.share-password-toggle.on::after {
		transform: translateX(16px);
	}

	.share-password-input {
		flex: 1;
		height: 34px;
		background: rgba(255,255,255,.06);
		border: 1px solid rgba(255,255,255,.1);
		border-radius: 7px;
		padding: 0 10px;
		color: #fff;
		font-size: 12px;
		font-family: inherit;
		outline: none;
	}
	.share-password-input:disabled {
		opacity: 0.3;
	}
	.share-password-input::placeholder {
		color: rgba(255,255,255,.3);
	}

	.share-generate-btn {
		width: 100%;
		height: 38px;
		border: none;
		border-radius: 8px;
		background: #fbbf24;
		color: #171717;
		font-size: 13px;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		transition: background .15s;
		margin-top: 2px;
	}
	.share-generate-btn:hover {
		background: #f59e0b;
	}

	/* ============================== */
	/*  LL BADGE — bottom-right       */
	/* ============================== */
	.ll-badge {
		position: fixed;
		bottom: 20px;
		right: 20px;
		z-index: 9990;
		width: 48px;
		height: 48px;
		background: #fbbf24;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #171717;
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

	/* ============================== */
	/*  TOAST NOTIFICATION            */
	/* ============================== */
	.toast {
		position: fixed;
		bottom: 80px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(15,15,15,.92);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgba(255,255,255,.1);
		color: #fff;
		padding: 10px 20px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 500;
		z-index: 20000;
		pointer-events: none;
		display: flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
		animation: toastIn .25s ease-out;
	}
	.toast.hiding {
		animation: toastOut .2s ease-in forwards;
	}
</style>
