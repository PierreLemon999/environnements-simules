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
		Activity,
		ChevronDown,
		Check,
		Loader2,
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
	let projects: Project[] = $state([]);
	let currentProject: Project | null = $state(null);
	let currentPages: PageInfo[] = $state([]);
	let selectedVersionId = $state('');
	let loading = $state(true);
	let iframeUrl = $state('');
	let copiedUrl = $state(false);

	// Dropdowns
	let projectDropdownOpen = $state(false);
	let pageDropdownOpen = $state(false);

	// Stats from project
	let totalPages = $derived(currentPages.length);

	// Demo URL construction
	let demoApiUrl = $derived(
		subdomain ? `http://localhost:3001/demo/${subdomain}/${pagePath}` : ''
	);

	// Current page title from header
	let currentPageTitle = $derived(() => {
		const match = currentPages.find(
			(p) => p.urlPath === pagePath || p.urlPath === pagePath || `/${p.urlPath}` === `/${pagePath}`
		);
		return match?.title ?? (pagePath || 'Accueil');
	});

	function copyUrl() {
		const url = window.location.href;
		navigator.clipboard.writeText(url);
		copiedUrl = true;
		setTimeout(() => { copiedUrl = false; }, 2000);
	}

	function shareLink() {
		if (navigator.share) {
			navigator.share({
				title: `Démo ${currentProject?.toolName ?? ''}`,
				url: window.location.href,
			});
		} else {
			copyUrl();
		}
	}

	function openAsClient() {
		// Navigate to prospect view equivalent
		window.open(`/view/${fullPath}`, '_blank');
	}

	function navigateToPage(pageUrlPath: string) {
		window.location.href = `/demo/${subdomain}/${pageUrlPath}`;
		pageDropdownOpen = false;
	}

	onMount(async () => {
		try {
			// Load projects for dropdown
			const res = await get<{ data: Array<{ id: string; name: string; toolName: string; subdomain: string }> }>('/projects');

			// Find current project by subdomain
			const match = res.data.find((p) => p.subdomain === subdomain);
			if (match) {
				const detail = await get<{ data: Project }>(`/projects/${match.id}`);
				currentProject = detail.data;

				// Find active version
				const activeVersion = currentProject.versions?.find((v) => v.status === 'active');
				selectedVersionId = activeVersion?.id ?? currentProject.versions?.[0]?.id ?? '';

				// Load pages for this version
				if (selectedVersionId) {
					const pagesRes = await get<{ data: PageInfo[] }>(`/versions/${selectedVersionId}/pages`);
					currentPages = pagesRes.data;
				}
			}

			// Set iframe URL to load demo content from backend
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
		<!-- Logo -->
		<div class="flex items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-md bg-[#f5a623] text-xs font-bold text-white">
				LL
			</div>
			<span class="text-sm font-semibold text-white">Demo</span>
		</div>

		<div class="h-5 w-px bg-white/20"></div>

		<!-- Demo title -->
		<span class="text-sm text-white/80">
			{currentProject?.toolName ?? 'Chargement...'}
		</span>

		<div class="h-5 w-px bg-white/20"></div>

		<!-- Current page name -->
		<span class="text-sm text-white/60">{currentPageTitle()}</span>

		<div class="flex-1"></div>

		<!-- User info (admin only) -->
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
					{version.status === 'active' ? 'Actif' : version.status === 'test' ? 'Test' : 'Déprécié'}
				</Badge>
			{/if}
		{/if}

		<div class="flex-1"></div>

		<!-- Stats -->
		<div class="hidden items-center gap-4 text-xs text-white/50 sm:flex">
			<span class="inline-flex items-center gap-1">
				<FileText class="h-3 w-3" />
				{totalPages} page{totalPages !== 1 ? 's' : ''}
			</span>
		</div>

		<div class="h-5 w-px bg-white/20"></div>

		<!-- Action buttons -->
		<button
			class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
			onclick={shareLink}
			title="Partager le lien"
		>
			<Share2 class="h-3.5 w-3.5" />
			<span class="hidden sm:inline">Partager</span>
		</button>

		<button
			class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
			onclick={copyUrl}
			title="Copier l'URL"
		>
			{#if copiedUrl}
				<Check class="h-3.5 w-3.5 text-green-400" />
				<span class="hidden text-green-400 sm:inline">Copié</span>
			{:else}
				<Copy class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Copier</span>
			{/if}
		</button>

		<button
			class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
			onclick={openAsClient}
			title="Ouvrir en tant que client"
		>
			<ExternalLink class="h-3.5 w-3.5" />
			<span class="hidden sm:inline">Vue client</span>
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

<!-- Close dropdowns on click outside -->
<svelte:window onclick={() => { projectDropdownOpen = false; pageDropdownOpen = false; }} />
