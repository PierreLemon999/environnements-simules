<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get } from '$lib/api';
	import { Card, CardContent } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import { Tabs, TabsList, TabsTrigger } from '$components/ui/tabs';
	import { Separator } from '$components/ui/separator';
	import {
		ChevronRight,
		ChevronDown,
		FileText,
		Folder,
		FolderOpen,
		Search,
		Globe,
		HardDrive,
		Calendar,
		Camera,
		Link2,
		ExternalLink,
		Pencil,
		EyeOff,
		Eye,
		Shield,
		BookOpen,
		Layers,
		AlertCircle,
	} from 'lucide-svelte';

	// Types
	interface Page {
		id: string;
		versionId: string;
		urlSource: string;
		urlPath: string;
		title: string;
		filePath: string;
		fileSize: number | null;
		captureMode: 'free' | 'guided' | 'auto';
		thumbnailPath: string | null;
		healthStatus: 'ok' | 'warning' | 'error';
		createdAt: string;
	}

	interface TreeNode {
		name: string;
		path: string;
		page?: Page;
		children: TreeNode[];
	}

	interface Project {
		id: string;
		name: string;
		toolName: string;
		subdomain: string;
		versions: Array<{
			id: string;
			name: string;
			status: 'active' | 'test' | 'deprecated';
		}>;
	}

	interface ObfuscationRule {
		id: string;
		searchValue: string;
		replaceValue: string;
		isRegex: number;
		isActive: number;
	}

	// State
	let projects: Project[] = $state([]);
	let selectedProjectId = $state('');
	let selectedVersionId = $state('');
	let tree: TreeNode | null = $state(null);
	let selectedPage: Page | null = $state(null);
	let obfuscationRules: ObfuscationRule[] = $state([]);
	let loading = $state(true);
	let treeLoading = $state(false);
	let searchQuery = $state('');
	let treeTab = $state('site');
	let expandedPaths = $state<Set<string>>(new Set());

	// Derived
	let selectedProject = $derived(projects.find((p) => p.id === selectedProjectId));
	let versions = $derived(selectedProject?.versions ?? []);
	let selectedVersion = $derived(versions.find((v) => v.id === selectedVersionId));

	// Page statistics from tree
	let pageStats = $derived(() => {
		if (!tree) return { ok: 0, warning: 0, error: 0, total: 0 };
		const stats = { ok: 0, warning: 0, error: 0, total: 0 };
		function walk(node: TreeNode) {
			if (node.page) {
				stats.total++;
				stats[node.page.healthStatus]++;
			}
			node.children.forEach(walk);
		}
		walk(tree);
		return stats;
	});

	// Filter tree by search
	function filterTree(node: TreeNode, query: string): TreeNode | null {
		if (!query.trim()) return node;
		const q = query.toLowerCase();

		const filteredChildren = node.children
			.map((c) => filterTree(c, query))
			.filter((c): c is TreeNode => c !== null);

		const matchesPage =
			node.page &&
			(node.page.title.toLowerCase().includes(q) ||
				node.page.urlPath.toLowerCase().includes(q));

		if (matchesPage || filteredChildren.length > 0) {
			return { ...node, children: filteredChildren };
		}
		return null;
	}

	let filteredTree = $derived(() => {
		if (!tree) return null;
		return filterTree(tree, searchQuery);
	});

	// Status helpers
	function getHealthDot(status: string): string {
		switch (status) {
			case 'ok':
				return 'bg-success';
			case 'warning':
				return 'bg-warning';
			case 'error':
				return 'bg-destructive';
			default:
				return 'bg-muted';
		}
	}

	function getHealthLabel(status: string): string {
		switch (status) {
			case 'ok':
				return 'OK';
			case 'warning':
				return 'Avertissement';
			case 'error':
				return 'Erreur';
			default:
				return status;
		}
	}

	function getCaptureLabel(mode: string): string {
		switch (mode) {
			case 'free':
				return 'Capture libre';
			case 'guided':
				return 'Capture guidée';
			case 'auto':
				return 'Capture automatique';
			default:
				return mode;
		}
	}

	function formatFileSize(bytes: number | null): string {
		if (!bytes) return '—';
		if (bytes < 1024) return `${bytes} o`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	function toggleExpand(path: string) {
		const newSet = new Set(expandedPaths);
		if (newSet.has(path)) {
			newSet.delete(path);
		} else {
			newSet.add(path);
		}
		expandedPaths = newSet;
	}

	function selectPage(page: Page) {
		selectedPage = page;
	}

	function countPages(node: TreeNode): number {
		let count = node.page ? 1 : 0;
		for (const child of node.children) {
			count += countPages(child);
		}
		return count;
	}

	// Data loading
	async function loadProjects() {
		try {
			const res = await get<{ data: Array<{ id: string; name: string; toolName: string; subdomain: string }> }>('/projects');
			// Load full project details with versions
			const detailed = await Promise.all(
				res.data.map((p) =>
					get<{ data: Project }>(`/projects/${p.id}`).then((r) => r.data)
				)
			);
			projects = detailed;

			// Check URL params for pre-selection
			const urlVersion = $page.url.searchParams.get('version');
			if (urlVersion) {
				for (const p of projects) {
					const v = p.versions.find((v) => v.id === urlVersion);
					if (v) {
						selectedProjectId = p.id;
						selectedVersionId = v.id;
						break;
					}
				}
			} else if (projects.length > 0) {
				selectedProjectId = projects[0].id;
				if (projects[0].versions.length > 0) {
					// Prefer active version
					const active = projects[0].versions.find((v) => v.status === 'active');
					selectedVersionId = active?.id ?? projects[0].versions[0].id;
				}
			}
		} catch (err) {
			console.error('Projects fetch error:', err);
		} finally {
			loading = false;
		}
	}

	async function loadTree() {
		if (!selectedVersionId) {
			tree = null;
			return;
		}

		treeLoading = true;
		try {
			const res = await get<{ data: TreeNode }>(`/versions/${selectedVersionId}/tree`);
			tree = res.data;
			// Auto-expand top-level
			if (tree) {
				const newExpanded = new Set<string>();
				tree.children.forEach((c) => newExpanded.add(c.path));
				expandedPaths = newExpanded;
			}
			selectedPage = null;
		} catch (err) {
			console.error('Tree fetch error:', err);
			tree = null;
		} finally {
			treeLoading = false;
		}
	}

	async function loadObfuscationRules() {
		if (!selectedProjectId) return;
		try {
			const res = await get<{ data: ObfuscationRule[] }>(`/projects/${selectedProjectId}/obfuscation`);
			obfuscationRules = res.data;
		} catch {
			obfuscationRules = [];
		}
	}

	// React to project changes
	$effect(() => {
		if (selectedProjectId) {
			const proj = projects.find((p) => p.id === selectedProjectId);
			if (proj && proj.versions.length > 0) {
				const active = proj.versions.find((v) => v.status === 'active');
				selectedVersionId = active?.id ?? proj.versions[0].id;
			} else {
				selectedVersionId = '';
			}
			loadObfuscationRules();
		}
	});

	// React to version changes
	$effect(() => {
		if (selectedVersionId) {
			loadTree();
		}
	});

	onMount(() => {
		loadProjects();
	});
</script>

<svelte:head>
	<title>Arborescence — Environnements Simulés</title>
</svelte:head>

<div class="flex h-[calc(100vh-56px)] overflow-hidden -m-6">
	<!-- Tree Panel (left) -->
	<div class="flex w-72 shrink-0 flex-col border-r border-border bg-card lg:w-80">
		<!-- Tree panel header -->
		<div class="space-y-3 border-b border-border p-3">
			<!-- Project selector -->
			<select
				bind:value={selectedProjectId}
				class="flex h-8 w-full rounded-md border border-border bg-transparent px-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{#if projects.length === 0}
					<option value="">Chargement...</option>
				{:else}
					{#each projects as project}
						<option value={project.id}>{project.name}</option>
					{/each}
				{/if}
			</select>

			<!-- Tabs -->
			<Tabs value={treeTab} onValueChange={(v) => { treeTab = v; }}>
				<TabsList class="w-full">
					<TabsTrigger value="site" class="flex-1 text-xs">Par site</TabsTrigger>
					<TabsTrigger value="guide" class="flex-1 text-xs">Par guide</TabsTrigger>
				</TabsList>
			</Tabs>

			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
				<Input
					bind:value={searchQuery}
					placeholder="Filtrer les pages..."
					class="h-8 pl-8 text-xs"
				/>
			</div>
		</div>

		<!-- Status bar -->
		{#if tree && !treeLoading}
			{@const stats = pageStats()}
			<div class="border-b border-border px-3 py-2">
				<div class="flex items-center gap-3 text-xs">
					<span class="inline-flex items-center gap-1">
						<span class="h-1.5 w-1.5 rounded-full bg-success"></span>
						{stats.ok} OK
					</span>
					<span class="inline-flex items-center gap-1">
						<span class="h-1.5 w-1.5 rounded-full bg-warning"></span>
						{stats.warning} Avert.
					</span>
					<span class="inline-flex items-center gap-1">
						<span class="h-1.5 w-1.5 rounded-full bg-destructive"></span>
						{stats.error} Erreur
					</span>
				</div>
				{#if stats.total > 0}
					<div class="mt-1.5 h-1 overflow-hidden rounded-full bg-accent">
						<div class="flex h-full">
							{#if stats.ok > 0}
								<div
									class="bg-success"
									style="width: {(stats.ok / stats.total) * 100}%"
								></div>
							{/if}
							{#if stats.warning > 0}
								<div
									class="bg-warning"
									style="width: {(stats.warning / stats.total) * 100}%"
								></div>
							{/if}
							{#if stats.error > 0}
								<div
									class="bg-destructive"
									style="width: {(stats.error / stats.total) * 100}%"
								></div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Tree content -->
		<div class="flex-1 overflow-y-auto px-1 py-2">
			{#if loading || treeLoading}
				<div class="space-y-1 px-2">
					{#each Array(8) as _}
						<div class="flex items-center gap-2 py-1.5">
							<div class="skeleton h-3 w-3 rounded"></div>
							<div class="skeleton h-3 w-3 rounded"></div>
							<div class="skeleton h-3 w-24 rounded"></div>
						</div>
					{/each}
				</div>
			{:else if !tree || !filteredTree()}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<FileText class="h-8 w-8 text-muted" />
					<p class="mt-3 text-sm text-muted-foreground">
						{selectedVersionId ? 'Aucune page capturée' : 'Sélectionnez une version'}
					</p>
				</div>
			{:else}
				{#snippet treeNodeSnippet(node: TreeNode, depth: number)}
					{#if node.children.length > 0 && !node.page}
						<!-- Folder node -->
						<button
							class="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent"
							style="padding-left: {depth * 16 + 8}px"
							onclick={() => toggleExpand(node.path)}
						>
							{#if expandedPaths.has(node.path)}
								<ChevronDown class="h-3 w-3 shrink-0 text-muted" />
								<FolderOpen class="h-3.5 w-3.5 shrink-0 text-warning" />
							{:else}
								<ChevronRight class="h-3 w-3 shrink-0 text-muted" />
								<Folder class="h-3.5 w-3.5 shrink-0 text-warning" />
							{/if}
							<span class="truncate text-foreground">{node.name}</span>
							<span class="ml-auto text-[10px] text-muted-foreground">
								{countPages(node)}
							</span>
						</button>
						{#if expandedPaths.has(node.path)}
							{#each node.children as child}
								{@render treeNodeSnippet(child, depth + 1)}
							{/each}
						{/if}
					{:else if node.page}
						<!-- Page node -->
						<button
							class="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent {selectedPage?.id === node.page.id ? 'bg-accent text-primary' : ''}"
							style="padding-left: {depth * 16 + 8}px"
							onclick={() => selectPage(node.page!)}
						>
							<span class="h-1.5 w-1.5 shrink-0 rounded-full {getHealthDot(node.page.healthStatus)}"></span>
							<FileText class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							<span class="truncate {selectedPage?.id === node.page.id ? 'font-medium text-primary' : 'text-foreground'}">
								{node.page.title || node.name}
							</span>
						</button>
						<!-- Also render children if any -->
						{#if node.children.length > 0}
							{#each node.children as child}
								{@render treeNodeSnippet(child, depth + 1)}
							{/each}
						{/if}
					{:else}
						<!-- Empty folder -->
						<button
							class="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent"
							style="padding-left: {depth * 16 + 8}px"
							onclick={() => toggleExpand(node.path)}
						>
							{#if expandedPaths.has(node.path)}
								<ChevronDown class="h-3 w-3 shrink-0 text-muted" />
								<FolderOpen class="h-3.5 w-3.5 shrink-0 text-warning" />
							{:else}
								<ChevronRight class="h-3 w-3 shrink-0 text-muted" />
								<Folder class="h-3.5 w-3.5 shrink-0 text-warning" />
							{/if}
							<span class="truncate text-foreground">{node.name}</span>
						</button>
						{#if expandedPaths.has(node.path)}
							{#each node.children as child}
								{@render treeNodeSnippet(child, depth + 1)}
							{/each}
						{/if}
					{/if}
				{/snippet}

				{#each filteredTree()!.children as child}
					{@render treeNodeSnippet(child, 0)}
				{/each}
			{/if}
		</div>

		<!-- Tree footer -->
		<div class="border-t border-border px-3 py-2">
			<div class="flex items-center justify-between">
				<!-- Version selector -->
				<select
					bind:value={selectedVersionId}
					class="h-7 rounded border border-border bg-transparent px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{#each versions as version}
						<option value={version.id}>{version.name}</option>
					{/each}
				</select>
				<span class="text-xs text-muted-foreground">
					{pageStats().total} page{pageStats().total !== 1 ? 's' : ''}
				</span>
			</div>
		</div>
	</div>

	<!-- Detail Panel (right) -->
	<div class="flex-1 overflow-y-auto bg-background p-6">
		{#if selectedPage}
			<!-- Breadcrumb -->
			<nav class="mb-4 flex items-center gap-1 text-sm">
				<span class="text-muted-foreground">{selectedProject?.name ?? 'Projet'}</span>
				<ChevronRight class="h-3.5 w-3.5 text-muted" />
				{#each selectedPage.urlPath.split('/').filter(Boolean) as segment, i}
					{#if i < selectedPage.urlPath.split('/').filter(Boolean).length - 1}
						<span class="text-muted-foreground">{segment}</span>
						<ChevronRight class="h-3.5 w-3.5 text-muted" />
					{:else}
						<span class="font-medium text-foreground">{segment}</span>
					{/if}
				{/each}
			</nav>

			<!-- Page title and actions -->
			<div class="mb-6 flex items-start justify-between">
				<div>
					<h2 class="text-lg font-semibold text-foreground">{selectedPage.title}</h2>
					<p class="mt-1 text-sm text-muted-foreground">/{selectedPage.urlPath}</p>
				</div>
				<div class="flex items-center gap-2">
					<a href="/admin/live-edit/{selectedPage.id}">
						<Button variant="outline" size="sm" class="gap-1.5">
							<Pencil class="h-3.5 w-3.5" />
							Édition en direct
						</Button>
					</a>
					<a href="/admin/editor/{selectedPage.id}">
						<Button variant="outline" size="sm" class="gap-1.5">
							<FileText class="h-3.5 w-3.5" />
							Éditeur HTML
						</Button>
					</a>
					<Button variant="outline" size="sm" class="gap-1.5">
						<EyeOff class="h-3.5 w-3.5" />
						Obfuscation
					</Button>
					<Button size="sm" class="gap-1.5 bg-success text-white hover:bg-success/90" onclick={() => {
						if (selectedProject?.subdomain && selectedPage) {
							window.open(`/demo/${selectedProject.subdomain}/${selectedPage.urlPath}`, '_blank');
						}
					}}>
						<ExternalLink class="h-3.5 w-3.5" />
						Ouvrir démo
					</Button>
				</div>
			</div>

			<!-- Metadata grid -->
			<div class="grid gap-6 lg:grid-cols-2">
				<!-- Page information -->
				<Card>
					<CardContent class="p-5">
						<h3 class="mb-4 text-sm font-semibold text-foreground">Informations</h3>
						<dl class="space-y-3">
							<div class="flex items-start justify-between">
								<dt class="flex items-center gap-2 text-sm text-muted-foreground">
									<Globe class="h-3.5 w-3.5" />
									URL source
								</dt>
								<dd class="max-w-[60%] text-right text-sm text-foreground">
									<a href={selectedPage.urlSource} target="_blank" rel="noopener" class="text-primary hover:underline">
										{selectedPage.urlSource}
									</a>
								</dd>
							</div>
							<Separator />
							<div class="flex items-center justify-between">
								<dt class="flex items-center gap-2 text-sm text-muted-foreground">
									<HardDrive class="h-3.5 w-3.5" />
									Taille du fichier
								</dt>
								<dd class="text-sm text-foreground">{formatFileSize(selectedPage.fileSize)}</dd>
							</div>
							<Separator />
							<div class="flex items-center justify-between">
								<dt class="flex items-center gap-2 text-sm text-muted-foreground">
									<Calendar class="h-3.5 w-3.5" />
									Date de capture
								</dt>
								<dd class="text-sm text-foreground">{formatDate(selectedPage.createdAt)}</dd>
							</div>
							<Separator />
							<div class="flex items-center justify-between">
								<dt class="flex items-center gap-2 text-sm text-muted-foreground">
									<Camera class="h-3.5 w-3.5" />
									Mode de capture
								</dt>
								<dd class="text-sm text-foreground">{getCaptureLabel(selectedPage.captureMode)}</dd>
							</div>
							<Separator />
							<div class="flex items-center justify-between">
								<dt class="flex items-center gap-2 text-sm text-muted-foreground">
									<AlertCircle class="h-3.5 w-3.5" />
									Statut
								</dt>
								<dd>
									<Badge variant={selectedPage.healthStatus === 'ok' ? 'success' : selectedPage.healthStatus === 'warning' ? 'warning' : 'destructive'}>
										<span class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current"></span>
										{getHealthLabel(selectedPage.healthStatus)}
									</Badge>
								</dd>
							</div>
						</dl>
					</CardContent>
				</Card>

				<!-- Obfuscation rules -->
				<Card>
					<CardContent class="p-5">
						<h3 class="mb-4 text-sm font-semibold text-foreground">Règles d'obfuscation actives</h3>
						{#if obfuscationRules.filter((r) => r.isActive).length === 0}
							<p class="text-sm text-muted-foreground">Aucune règle active pour ce projet.</p>
						{:else}
							<div class="flex flex-wrap gap-2">
								{#each obfuscationRules.filter((r) => r.isActive) as rule}
									<div class="inline-flex items-center gap-1.5 rounded-md border border-border bg-accent px-2.5 py-1 text-xs">
										<Shield class="h-3 w-3 text-muted-foreground" />
										<span class="text-muted-foreground">{rule.searchValue}</span>
										<span class="text-muted">→</span>
										<span class="font-medium text-foreground">{rule.replaceValue}</span>
									</div>
								{/each}
							</div>
						{/if}
					</CardContent>
				</Card>
			</div>
		{:else}
			<!-- Empty state -->
			<div class="flex h-full flex-col items-center justify-center text-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
					<Eye class="h-8 w-8 text-muted" />
				</div>
				<h2 class="mt-4 text-base font-medium text-foreground">Sélectionnez une page</h2>
				<p class="mt-1 max-w-sm text-sm text-muted-foreground">
					Cliquez sur une page dans l'arborescence pour voir ses détails, ses métadonnées et les règles d'obfuscation actives.
				</p>
			</div>
		{/if}
	</div>
</div>
