<script lang="ts">
	import { get } from '$lib/api';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import { SearchableSelect } from '$components/ui/searchable-select';
	import { selectedProject, selectedVersionId, versions, selectedVersion, selectVersion } from '$lib/stores/project';
	import {
		PenSquare,
		Search,
		FileText,
		Loader2,
		ArrowRight,
	} from 'lucide-svelte';

	interface PageData {
		id: string;
		versionId: string;
		urlPath: string;
		title: string;
		fileSize: number | null;
		thumbnailPath: string | null;
		healthStatus: 'ok' | 'warning' | 'error';
		createdAt: string;
	}

	let pages: PageData[] = $state([]);
	let loading = $state(false);
	let searchQuery = $state('');

	let filteredPages = $derived(
		searchQuery
			? pages.filter(
					(p) =>
						p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
						p.urlPath.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: pages
	);

	function getHealthDot(status: string): string {
		switch (status) {
			case 'ok': return 'bg-success';
			case 'warning': return 'bg-warning';
			case 'error': return 'bg-destructive';
			default: return 'bg-muted';
		}
	}

	function getVersionStatusLabel(status: string): string {
		switch (status) {
			case 'active': return 'Active';
			case 'draft': return 'Brouillon';
			case 'archived': case 'deprecated': return 'Archivée';
			default: return status;
		}
	}

	async function loadPages(versionId: string) {
		if (!versionId) { pages = []; return; }
		loading = true;
		try {
			const res = await get<{ data: PageData[] }>(`/versions/${versionId}/pages`);
			pages = res.data;
		} catch {
			pages = [];
		} finally {
			loading = false;
		}
	}

	// React to version changes from the store
	$effect(() => {
		if ($selectedVersionId) {
			loadPages($selectedVersionId);
		} else {
			pages = [];
		}
	});
</script>

<svelte:head>
	<title>Éditeur — Lab</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
				<PenSquare class="h-5 w-5 text-primary" />
			</div>
			<div>
				<h1 class="text-lg font-semibold text-foreground">Éditeur de pages</h1>
				<p class="text-sm text-muted-foreground">
					{#if $selectedProject}
						{$selectedProject.toolName}
						{#if $selectedVersion}
							— {$selectedVersion.name}
						{/if}
					{:else}
						Sélectionnez un projet dans la sidebar
					{/if}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-3">
			{#if $versions.length > 0}
				<div class="w-52">
					<SearchableSelect
						value={$selectedVersionId ?? ''}
						onchange={(v) => selectVersion(v)}
						options={$versions.map((v) => ({ value: v.id, label: `${v.name} — ${getVersionStatusLabel(v.status)}` }))}
						placeholder="Version..."
						searchable={$versions.length > 5}
					/>
				</div>
			{/if}
			<div class="relative w-64">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
				<Input
					bind:value={searchQuery}
					placeholder="Rechercher une page..."
					class="pl-9"
				/>
			</div>
		</div>
	</div>

	{#if !$selectedProject}
		<div class="flex flex-col items-center justify-center py-20 text-center">
			<FileText class="h-12 w-12 text-muted" />
			<p class="mt-4 text-sm font-medium text-foreground">Aucun projet sélectionné</p>
			<p class="mt-1 text-sm text-muted-foreground">Cliquez sur un projet dans la sidebar pour commencer.</p>
		</div>
	{:else if loading}
		<div class="flex items-center justify-center py-20">
			<Loader2 class="h-6 w-6 animate-spin text-primary" />
		</div>
	{:else if pages.length === 0}
		<div class="flex flex-col items-center justify-center py-20 text-center">
			<FileText class="h-12 w-12 text-muted" />
			<p class="mt-4 text-sm font-medium text-foreground">Aucune page capturée</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Capturez des pages via l'extension Chrome pour les modifier ici.
			</p>
		</div>
	{:else}
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<span>{filteredPages.length} page{filteredPages.length > 1 ? 's' : ''}</span>
			{#if $selectedVersion}
				<Badge variant="outline" class="text-[10px]">{$selectedVersion.name}</Badge>
			{/if}
		</div>

		{#if filteredPages.length > 0}
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each filteredPages as pg}
					<a
						href="/admin/editor/{pg.id}"
						class="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm"
					>
						<span class="h-2 w-2 shrink-0 rounded-full {getHealthDot(pg.healthStatus)}"></span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-foreground group-hover:text-primary">{pg.title}</p>
							<p class="truncate text-xs text-muted-foreground">/{pg.urlPath}</p>
						</div>
						<ArrowRight class="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
					</a>
				{/each}
			</div>
		{:else if searchQuery}
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<Search class="h-8 w-8 text-muted" />
				<p class="mt-3 text-sm text-muted-foreground">Aucun résultat pour « {searchQuery} »</p>
			</div>
		{/if}
	{/if}
</div>
