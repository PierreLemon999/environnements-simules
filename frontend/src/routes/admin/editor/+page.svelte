<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { get } from '$lib/api';
	import { Card, CardContent } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
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
		healthStatus: 'ok' | 'warning' | 'error';
		createdAt: string;
	}

	interface Project {
		id: string;
		name: string;
		toolName: string;
		subdomain: string;
		versions: Array<{
			id: string;
			name: string;
			status: string;
		}>;
	}

	let projects: Project[] = $state([]);
	let pagesByVersion = $state<Record<string, PageData[]>>({});
	let loading = $state(true);
	let searchQuery = $state('');

	let allPages = $derived(
		Object.values(pagesByVersion).flat()
	);

	let filteredPages = $derived(
		searchQuery
			? allPages.filter(
					(p) =>
						p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
						p.urlPath.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: allPages
	);

	function getProjectForVersion(versionId: string): Project | undefined {
		return projects.find((p) => p.versions.some((v) => v.id === versionId));
	}

	function getVersionName(versionId: string): string {
		for (const p of projects) {
			const v = p.versions.find((v) => v.id === versionId);
			if (v) return v.name;
		}
		return '';
	}

	function getHealthDot(status: string): string {
		switch (status) {
			case 'ok': return 'bg-success';
			case 'warning': return 'bg-warning';
			case 'error': return 'bg-destructive';
			default: return 'bg-muted';
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	onMount(async () => {
		try {
			const projectsRes = await get<{ data: Array<{ id: string; name: string; toolName: string; subdomain: string }> }>('/projects');
			const detailed = await Promise.all(
				projectsRes.data.map((p) =>
					get<{ data: Project }>(`/projects/${p.id}`).then((r) => r.data)
				)
			);
			projects = detailed;

			// Load pages for each active version
			for (const project of projects) {
				const activeVersion = project.versions.find((v) => v.status === 'active');
				if (activeVersion) {
					try {
						const res = await get<{ data: PageData[] }>(`/versions/${activeVersion.id}/pages`);
						pagesByVersion[activeVersion.id] = res.data;
					} catch {
						// skip
					}
				}
			}
		} catch {
			// silently fail
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Éditeur — Lemon Lab</title>
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
				<p class="text-sm text-muted-foreground">Sélectionnez une page capturée à modifier</p>
			</div>
		</div>
		<div class="relative w-64">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
			<Input
				bind:value={searchQuery}
				placeholder="Rechercher une page..."
				class="pl-9"
			/>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-20">
			<Loader2 class="h-6 w-6 animate-spin text-primary" />
		</div>
	{:else if allPages.length === 0}
		<div class="flex flex-col items-center justify-center py-20 text-center">
			<FileText class="h-12 w-12 text-muted" />
			<p class="mt-4 text-sm font-medium text-foreground">Aucune page capturée</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Capturez des pages via l'extension Chrome pour les modifier ici.
			</p>
		</div>
	{:else}
		<!-- Group pages by project -->
		{#each projects as project}
			{@const activeVersion = project.versions.find((v) => v.status === 'active')}
			{@const versionPages = activeVersion ? (pagesByVersion[activeVersion.id] ?? []) : []}
			{@const filtered = searchQuery
				? versionPages.filter(
						(p) =>
							p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
							p.urlPath.toLowerCase().includes(searchQuery.toLowerCase())
					)
				: versionPages}
			{#if filtered.length > 0}
				<div>
					<div class="mb-3 flex items-center gap-2">
						<h2 class="text-sm font-semibold text-foreground">{project.toolName}</h2>
						{#if activeVersion}
							<Badge variant="outline" class="text-[10px]">{activeVersion.name}</Badge>
						{/if}
						<span class="text-xs text-muted-foreground">{filtered.length} page{filtered.length > 1 ? 's' : ''}</span>
					</div>
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{#each filtered as pg}
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
				</div>
			{/if}
		{/each}

		{#if filteredPages.length === 0 && searchQuery}
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<Search class="h-8 w-8 text-muted" />
				<p class="mt-3 text-sm text-muted-foreground">Aucun résultat pour « {searchQuery} »</p>
			</div>
		{/if}
	{/if}
</div>
