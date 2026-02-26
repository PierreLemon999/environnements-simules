<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get } from '$lib/api';
	import { user } from '$lib/stores/auth';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import {
		Share2,
		Copy,
		ExternalLink,
		Settings,
		FileText,
		Users,
		Clock,
		ChevronDown,
		Check,
		Loader2,
		X,
		Lock,
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
	let pagePath = $derived(pathSegments.slice(1).join('/') || '');

	// State
	let currentProject: Project | null = $state(null);
	let currentPages: PageInfo[] = $state([]);
	let selectedVersionId = $state('');
	let loading = $state(true);
	let iframeUrl = $state('');
	let iframeError = $state(false);
	let copiedUrl = $state(false);

	// Share dialog
	let shareDialogOpen = $state(false);
	let shareLinkDuration = $state(90);
	let shareLinkPassword = $state('');
	let shareGeneratedUrl = $state('');
	let shareCopied = $state(false);

	// Dropdowns
	let projectDropdownOpen = $state(false);
	let pageDropdownOpen = $state(false);

	// Stats from project
	let totalPages = $derived(currentPages.length);

	// Demo URL construction — use proxy path instead of hardcoded localhost
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

	function copyUrl() {
		const url = window.location.href;
		navigator.clipboard.writeText(url);
		copiedUrl = true;
		setTimeout(() => { copiedUrl = false; }, 2000);
	}

	function openShareDialog() {
		shareDialogOpen = true;
		shareGeneratedUrl = window.location.href;
		shareCopied = false;
	}

	function copyShareLink() {
		navigator.clipboard.writeText(shareGeneratedUrl);
		shareCopied = true;
		setTimeout(() => { shareCopied = false; }, 2000);
	}

	function openAsClient() {
		window.open(`/view/${fullPath}`, '_blank');
	}

	function navigateToPage(pageUrlPath: string) {
		window.location.href = `/demo/${subdomain}/${pageUrlPath}`;
		pageDropdownOpen = false;
	}

	onMount(async () => {
		try {
			const res = await get<{ data: Array<{ id: string; name: string; toolName: string; subdomain: string }> }>('/projects');

			const match = res.data.find((p) => p.subdomain === subdomain);
			if (match) {
				const detail = await get<{ data: Project }>(`/projects/${match.id}`);
				currentProject = detail.data;

				const activeVersion = currentProject.versions?.find((v) => v.status === 'active');
				selectedVersionId = activeVersion?.id ?? currentProject.versions?.[0]?.id ?? '';

				if (selectedVersionId) {
					const pagesRes = await get<{ data: PageInfo[] }>(`/versions/${selectedVersionId}/pages`);
					currentPages = pagesRes.data;
				}
			}

			iframeUrl = demoApiUrl;
		} catch (err) {
			console.error('Demo viewer init error:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Démo {currentProject?.toolName ?? ''} — Environnements Simulés</title>
</svelte:head>

<div class="flex h-screen flex-col bg-[#1a1a2e]">
	<!-- Dark top header -->
	<header class="flex h-12 shrink-0 items-center gap-4 border-b border-white/10 bg-[#16162a] px-4">
		<div class="flex items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-md bg-[#f5a623] text-xs font-bold text-white">
				LL
			</div>
			<span class="text-sm font-semibold text-white">Demo</span>
		</div>

		<div class="h-5 w-px bg-white/20"></div>

		<span class="text-sm text-white/80">
			{#if currentProject}
				Démo {currentProject.toolName}
			{:else}
				Chargement...
			{/if}
		</span>

		<div class="h-5 w-px bg-white/20"></div>

		<span class="text-sm text-white/60">{currentPageTitle()}</span>

		<div class="flex-1"></div>

		{#if $user}
			<span class="text-xs text-white/40">{$user.name}</span>
		{/if}
	</header>

	<!-- Action toolbar -->
	<div class="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#1e1e3a] px-4 py-2">
		<!-- Project dropdown -->
		<div class="relative">
			<button
				class="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10"
				onclick={() => { projectDropdownOpen = !projectDropdownOpen; pageDropdownOpen = false; }}
			>
				{currentProject?.name ?? 'Projet'}
				<ChevronDown class="h-3 w-3" />
			</button>
		</div>

		<!-- Page dropdown -->
		<div class="relative">
			<button
				class="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10"
				onclick={() => { pageDropdownOpen = !pageDropdownOpen; projectDropdownOpen = false; }}
			>
				{currentPageTitle()}
				<ChevronDown class="h-3 w-3" />
			</button>
			{#if pageDropdownOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="absolute left-0 top-full z-50 mt-1 max-h-64 w-72 overflow-y-auto rounded-lg border border-white/20 bg-[#1e1e3a] py-1 shadow-lg"
					onkeydown={() => {}}
				>
					{#each currentPages as pg}
						<button
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
							onclick={() => navigateToPage(pg.urlPath)}
						>
							<FileText class="h-3.5 w-3.5 text-white/40" />
							<div class="min-w-0 flex-1">
								<span class="block truncate">{pg.title}</span>
								<span class="block truncate text-xs text-white/40">/{pg.urlPath}</span>
							</div>
						</button>
					{/each}
					{#if currentPages.length === 0}
						<p class="px-3 py-4 text-center text-xs text-white/40">Aucune page</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Version badge -->
		{#if currentProject?.versions}
			{@const version = currentProject.versions.find((v) => v.id === selectedVersionId)}
			{#if version}
				<Badge variant={version.status === 'active' ? 'success' : version.status === 'test' ? 'warning' : 'default'} class="text-[10px]">
					{version.name} — {version.status === 'active' ? 'Production' : version.status === 'test' ? 'Test' : 'Déprécié'}
				</Badge>
			{/if}
		{/if}

		<div class="flex-1"></div>

		<!-- Stats row (Issue 31) -->
		<div class="hidden items-center gap-4 text-xs text-white/50 sm:flex">
			<span class="inline-flex items-center gap-1.5">
				<FileText class="h-3 w-3" />
				{totalPages} Page{totalPages !== 1 ? 's' : ''} capturée{totalPages !== 1 ? 's' : ''}
			</span>
			<span class="inline-flex items-center gap-1.5">
				<Users class="h-3 w-3" />
				3 Clients connectés
			</span>
			<span class="inline-flex items-center gap-1.5">
				<Clock class="h-3 w-3" />
				il y a 2 min
			</span>
		</div>

		<div class="h-5 w-px bg-white/20"></div>

		<!-- Styled action buttons (Issue 32) -->
		<button
			class="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
			onclick={openShareDialog}
		>
			<Share2 class="h-3.5 w-3.5" />
			<span class="hidden sm:inline">Partager le lien</span>
		</button>

		<button
			class="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10"
			onclick={copyUrl}
		>
			{#if copiedUrl}
				<Check class="h-3.5 w-3.5 text-green-400" />
				<span class="hidden text-green-400 sm:inline">Copié</span>
			{:else}
				<Copy class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Copier l'URL</span>
			{/if}
		</button>

		<button
			class="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10"
			onclick={openAsClient}
		>
			<ExternalLink class="h-3.5 w-3.5" />
			<span class="hidden sm:inline">Ouvrir en tant que client</span>
		</button>

		<button
			class="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10"
		>
			<Settings class="h-3.5 w-3.5" />
			<span class="hidden sm:inline">Paramètres</span>
		</button>
	</div>

	<!-- Demo iframe -->
	<div class="flex-1 bg-white">
		{#if loading}
			<div class="flex h-full items-center justify-center bg-background">
				<div class="text-center">
					<Loader2 class="mx-auto h-8 w-8 animate-spin text-primary" />
					<p class="mt-3 text-sm text-muted-foreground">Chargement de la démo...</p>
				</div>
			</div>
		{:else if iframeError}
			<div class="flex h-full items-center justify-center bg-background">
				<div class="text-center">
					<FileText class="mx-auto h-10 w-10 text-muted" />
					<p class="mt-3 text-sm font-medium text-foreground">Erreur de chargement</p>
					<p class="mt-1 text-sm text-muted-foreground">La démo n'a pas pu être chargée. Vérifiez que le backend est démarré.</p>
				</div>
			</div>
		{:else if iframeUrl}
			<iframe
				src={iframeUrl}
				class="h-full w-full border-0"
				title="Aperçu de la démo"
				sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
			></iframe>
		{:else}
			<div class="flex h-full items-center justify-center bg-background">
				<div class="text-center">
					<FileText class="mx-auto h-10 w-10 text-muted" />
					<p class="mt-3 text-sm font-medium text-foreground">Page introuvable</p>
					<p class="mt-1 text-sm text-muted-foreground">La démo demandée n'existe pas ou n'est pas disponible.</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Share dialog (Issue 33) -->
{#if shareDialogOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
		onmousedown={() => { shareDialogOpen = false; }}
		onkeydown={(e) => { if (e.key === 'Escape') shareDialogOpen = false; }}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
			onmousedown={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-base font-semibold text-foreground">Partager le lien</h3>
				<button class="rounded-md p-1 text-muted hover:text-foreground" onclick={() => { shareDialogOpen = false; }}>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="space-y-4">
				<div class="space-y-1.5">
					<label class="text-xs font-medium text-foreground">Durée de validité</label>
					<select
						bind:value={shareLinkDuration}
						class="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
					<label class="text-xs font-medium text-foreground">
						Mot de passe <span class="text-muted-foreground">(optionnel)</span>
					</label>
					<div class="relative">
						<Lock class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
						<input
							type="password"
							bind:value={shareLinkPassword}
							placeholder="Laisser vide pour aucun"
							class="flex h-9 w-full rounded-md border border-border bg-transparent pl-8 pr-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
						/>
					</div>
				</div>

				<div class="rounded-lg border border-border bg-accent/50 p-3">
					<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lien généré</p>
					<div class="flex items-center gap-2">
						<code class="flex-1 truncate font-mono text-xs text-foreground">{shareGeneratedUrl}</code>
						<button onclick={copyShareLink} class="shrink-0 rounded p-1.5 hover:bg-background">
							{#if shareCopied}
								<Check class="h-3.5 w-3.5 text-emerald-500" />
							{:else}
								<Copy class="h-3.5 w-3.5 text-muted-foreground" />
							{/if}
						</button>
					</div>
				</div>

				<button
					class="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
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

<svelte:window onclick={() => { projectDropdownOpen = false; pageDropdownOpen = false; }} />
