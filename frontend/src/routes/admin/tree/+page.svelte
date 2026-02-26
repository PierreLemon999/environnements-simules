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
		ChevronLeft,
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
		LinkIcon,
		ExternalLink,
		Pencil,
		EyeOff,
		Eye,
		Shield,
		BookOpen,
		Layers,
		AlertCircle,
		GripVertical,
		GitCompare,
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

	interface Guide {
		id: string;
		versionId: string;
		name: string;
		description: string | null;
		pageCount: number;
		playCount: number;
		completionCount: number;
	}

	// State
	let projects: Project[] = $state([]);
	let selectedProjectId = $state('');
	let selectedVersionId = $state('');
	let tree: TreeNode | null = $state(null);
	let selectedPage: Page | null = $state(null);
	let obfuscationRules: ObfuscationRule[] = $state([]);
	let guides: Guide[] = $state([]);
	let loading = $state(true);
	let treeLoading = $state(false);
	let searchQuery = $state('');
	let treeTab = $state('site');
	let treeSubTab = $state<'site' | 'guide'>('site');
	let detailSubTab = $state('preview');

	// Resizable tree panel
	let treePanelWidth = $state(320);
	let isResizing = $state(false);
	let expandedPaths = $state<Set<string>>(new Set());
	let fullyExpandedSections = $state<Set<string>>(new Set());
	const SECTION_PAGE_LIMIT = 5;

	// Derived
	let selectedProject = $derived(projects.find((p) => p.id === selectedProjectId));
	let versions = $derived(selectedProject?.versions ?? []);
	let selectedVersion = $derived(versions.find((v) => v.id === selectedVersionId));

	// Page statistics from tree
	let pageStats = $derived(() => {
		if (!tree) return { ok: 0, warning: 0, error: 0, total: 0, modals: 0 };
		const stats = { ok: 0, warning: 0, error: 0, total: 0, modals: 0 };
		function walk(node: TreeNode) {
			if (node.page) {
				stats.total++;
				stats[node.page.healthStatus]++;
				if (node.page.captureMode === 'guided') {
					stats.modals++;
				}
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

	// Category color palette for tree sections (cycles through for dynamic sections)
	const sectionColors = [
		'#3B82F6', // blue (Dashboard)
		'#14B8A6', // teal (Contacts)
		'#F59E0B', // orange (Opportunités)
		'#8B5CF6', // purple (Rapports)
		'#EF4444', // red (Administration)
		'#10B981', // green (Paramètres)
		'#EC4899', // pink
		'#06B6D4', // cyan
		'#F97316', // dark orange
		'#6366F1', // indigo
	];

	function getSectionColor(index: number): string {
		return sectionColors[index % sectionColors.length];
	}

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

	function startResize(e: MouseEvent) {
		isResizing = true;
		const startX = e.clientX;
		const startWidth = treePanelWidth;
		function onMove(e: MouseEvent) {
			const delta = e.clientX - startX;
			treePanelWidth = Math.max(240, Math.min(600, startWidth + delta));
		}
		function onUp() {
			isResizing = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	function getVersionStatusVariant(status: string): 'success' | 'warning' | 'secondary' {
		switch (status) {
			case 'active': return 'success';
			case 'test': return 'warning';
			case 'deprecated': return 'secondary';
			default: return 'secondary';
		}
	}

	function getVersionStatusLabel(status: string): string {
		switch (status) {
			case 'active': return 'Active';
			case 'test': return 'Test';
			case 'deprecated': return 'Archivée';
			default: return status;
		}
	}

	function navigateVersion(direction: -1 | 1) {
		const idx = versions.findIndex((v) => v.id === selectedVersionId);
		const nextIdx = idx + direction;
		if (nextIdx >= 0 && nextIdx < versions.length) {
			selectedVersionId = versions[nextIdx].id;
		}
	}

	// Build breadcrumb trail for a page by walking the tree hierarchy
	function buildBreadcrumb(targetPage: Page, node: TreeNode, trail: string[]): string[] | null {
		if (node.page?.id === targetPage.id) {
			return [...trail, node.page.title || node.name];
		}
		for (const child of node.children) {
			const childTrail = child.page ? trail : [...trail, child.name];
			const result = buildBreadcrumb(targetPage, child, childTrail);
			if (result) return result;
		}
		return null;
	}

	let selectedPageBreadcrumb = $derived(() => {
		if (!selectedPage || !tree) return [];
		const result = buildBreadcrumb(selectedPage, tree, []);
		return result ?? selectedPage.urlPath.split('/').filter(Boolean);
	});

	// Preview URL for the iframe
	let previewUrl = $derived(() => {
		if (!selectedPage || !selectedProject?.subdomain) return '';
		return `/demo-api/${selectedProject.subdomain}/${selectedPage.urlPath}`;
	});

	function toggleFullExpand(path: string) {
		const newSet = new Set(fullyExpandedSections);
		if (newSet.has(path)) {
			newSet.delete(path);
		} else {
			newSet.add(path);
		}
		fullyExpandedSections = newSet;
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

	async function loadGuides() {
		try {
			const res = await get<{ data: Guide[] }>('/analytics/guides');
			guides = res.data.filter((g) => g.versionId === selectedVersionId);
		} catch {
			guides = [];
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
			loadGuides();
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
	<div class="relative flex shrink-0 flex-col border-r border-border bg-card" style="width: {treePanelWidth}px">
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
					<TabsTrigger value="site" class="flex-1 text-xs">Arborescence</TabsTrigger>
					<TabsTrigger value="list" class="flex-1 text-xs">Liste</TabsTrigger>
					<TabsTrigger value="map" class="flex-1 text-xs">Carte du site</TabsTrigger>
				</TabsList>
			</Tabs>

			<!-- Sub-tabs for Arborescence: Par site / Par guide -->
			{#if treeTab === 'site'}
				<div class="flex gap-1 rounded-md bg-accent/50 p-0.5">
					<button
						class="flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors {treeSubTab === 'site' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => { treeSubTab = 'site'; }}
					>
						Par site
					</button>
					<button
						class="flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors {treeSubTab === 'guide' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => { treeSubTab = 'guide'; }}
					>
						Par guide
					</button>
				</div>
			{/if}

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
			<div class="border-b border-border px-3 py-2 space-y-1.5">
				<div class="text-xs font-medium text-muted-foreground">
					{stats.total} page{stats.total !== 1 ? 's' : ''} · {stats.modals} modale{stats.modals !== 1 ? 's' : ''} · {stats.error} erreur{stats.error !== 1 ? 's' : ''}
				</div>
				<div class="flex items-center gap-3 text-xs text-muted-foreground">
					<span class="inline-flex items-center gap-1">
						<span class="h-2 w-2 rounded-full bg-success"></span>
						{stats.ok} OK
					</span>
					<span class="inline-flex items-center gap-1">
						<span class="h-2 w-2 rounded-full bg-warning"></span>
						{stats.warning} Avert.
					</span>
					<span class="inline-flex items-center gap-1">
						<span class="h-2 w-2 rounded-full bg-destructive"></span>
						{stats.error} Erreur{stats.error !== 1 ? 's' : ''}
					</span>
				</div>
				<!-- Proportional health progress bar -->
				{#if stats.total > 0}
					<div class="flex h-1.5 w-full overflow-hidden rounded-full bg-accent">
						{#if stats.ok > 0}
							<div class="bg-success" style="width: {(stats.ok / stats.total) * 100}%"></div>
						{/if}
						{#if stats.warning > 0}
							<div class="bg-warning" style="width: {(stats.warning / stats.total) * 100}%"></div>
						{/if}
						{#if stats.error > 0}
							<div class="bg-destructive" style="width: {(stats.error / stats.total) * 100}%"></div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Tree content -->
		<div class="flex-1 overflow-y-auto px-1 py-2">
			{#if treeTab === 'site' && treeSubTab === 'guide'}
				<!-- Par guide sub-view -->
				<div class="px-2 py-3">
					{#if loading || treeLoading}
						<div class="space-y-2 px-2">
							{#each Array(3) as _}
								<div class="skeleton h-16 w-full rounded-lg"></div>
							{/each}
						</div>
					{:else if guides.length === 0}
						<div class="flex flex-col items-center justify-center py-12 text-center">
							<BookOpen class="h-8 w-8 text-muted" />
							<p class="mt-3 text-sm text-muted-foreground">Aucun guide pour cette version</p>
							<p class="mt-1 text-xs text-muted">Les guides apparaîtront ici une fois créés.</p>
						</div>
					{:else}
						<div class="space-y-1">
							{#each guides as guide}
								<div class="rounded-lg border border-border p-3 transition-colors hover:bg-accent/50">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											<BookOpen class="h-4 w-4 text-primary" />
											<span class="text-sm font-medium text-foreground">{guide.name}</span>
										</div>
										<span class="text-xs text-muted-foreground">{guide.pageCount} page{guide.pageCount !== 1 ? 's' : ''}</span>
									</div>
									{#if guide.description}
										<p class="mt-1 ml-6 text-xs text-muted-foreground">{guide.description}</p>
									{/if}
									<div class="mt-2 ml-6 flex items-center gap-3 text-[10px] text-muted">
										<span>{guide.playCount} lecture{guide.playCount !== 1 ? 's' : ''}</span>
										<span>{guide.completionCount} terminé{guide.completionCount !== 1 ? 's' : ''}</span>
										{#if guide.playCount > 0}
											<span class="text-primary">{Math.round((guide.completionCount / guide.playCount) * 100)}% complétion</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if treeTab === 'list'}
				<!-- Flat list view of all pages -->
				<div class="px-2 py-2">
					{#if loading || treeLoading}
						<div class="space-y-1 px-2">
							{#each Array(8) as _}
								<div class="skeleton h-8 w-full rounded"></div>
							{/each}
						</div>
					{:else if !tree}
						<div class="flex flex-col items-center justify-center py-12 text-center">
							<FileText class="h-8 w-8 text-muted" />
							<p class="mt-3 text-sm text-muted-foreground">
								{selectedVersionId ? 'Aucune page capturée' : 'Sélectionnez une version'}
							</p>
						</div>
					{:else}
						{@const allPages = (() => {
							const pages: Page[] = [];
							function walk(node: TreeNode) {
								if (node.page) pages.push(node.page);
								node.children.forEach(walk);
							}
							walk(tree);
							return pages.filter(p => {
								if (!searchQuery.trim()) return true;
								const q = searchQuery.toLowerCase();
								return p.title.toLowerCase().includes(q) || p.urlPath.toLowerCase().includes(q);
							});
						})()}
						{#if allPages.length === 0}
							<p class="py-8 text-center text-sm text-muted-foreground">Aucune page trouvée.</p>
						{:else}
							<div class="space-y-0">
								{#each allPages as page}
									<button
										class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent {selectedPage?.id === page.id ? 'bg-accent text-primary' : ''}"
										onclick={() => selectPage(page)}
									>
										<span class="h-1.5 w-1.5 shrink-0 rounded-full {getHealthDot(page.healthStatus)}"></span>
										<FileText class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
										<span class="truncate {selectedPage?.id === page.id ? 'font-medium text-primary' : 'text-foreground'}">{page.title}</span>
										<span class="ml-auto shrink-0 text-[10px] text-muted">/{page.urlPath}</span>
									</button>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			{:else if treeTab === 'map'}
				<!-- Carte du site (site map visualization) — placeholder -->
				<div class="flex flex-col items-center justify-center py-12 px-4 text-center">
					<div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
						<Globe class="h-6 w-6 text-muted" />
					</div>
					<p class="mt-3 text-sm font-medium text-foreground">Carte du site</p>
					<p class="mt-1 text-xs text-muted-foreground">
						La visualisation interactive du graphe de navigation sera bientôt disponible.
					</p>
				</div>
			{:else if loading || treeLoading}
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
				{#snippet treeNodeSnippet(node: TreeNode, depth: number, color: string)}
					{#if node.children.length > 0 && !node.page}
						<!-- Folder node -->
						<button
							class="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent"
							style="padding-left: {depth * 16 + 8}px"
							onclick={() => toggleExpand(node.path)}
						>
							{#if expandedPaths.has(node.path)}
								<ChevronDown class="h-3 w-3 shrink-0 text-muted" />
								<FolderOpen class="h-3.5 w-3.5 shrink-0" style="color: {color}" />
							{:else}
								<ChevronRight class="h-3 w-3 shrink-0 text-muted" />
								<Folder class="h-3.5 w-3.5 shrink-0" style="color: {color}" />
							{/if}
							<span class="truncate text-foreground">{node.name}</span>
							<span class="ml-auto text-[10px] text-muted-foreground">
								({countPages(node)})
							</span>
						</button>
						{#if expandedPaths.has(node.path)}
							{@const isFullyExpanded = fullyExpandedSections.has(node.path)}
							{@const limit = isFullyExpanded ? node.children.length : SECTION_PAGE_LIMIT}
							{@const visibleChildren = node.children.slice(0, limit)}
							{@const hiddenCount = node.children.length - visibleChildren.length}
							{#each visibleChildren as child}
								{@render treeNodeSnippet(child, depth + 1, color)}
							{/each}
							{#if hiddenCount > 0}
								<button
									class="w-full rounded-md px-2 py-1 text-left text-xs text-primary hover:bg-accent"
									style="padding-left: {(depth + 1) * 16 + 8}px"
									onclick={() => toggleFullExpand(node.path)}
								>
									...et {hiddenCount} autre{hiddenCount !== 1 ? 's' : ''} page{hiddenCount !== 1 ? 's' : ''}
								</button>
							{:else if isFullyExpanded && node.children.length > SECTION_PAGE_LIMIT}
								<button
									class="w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
									style="padding-left: {(depth + 1) * 16 + 8}px"
									onclick={() => toggleFullExpand(node.path)}
								>
									Réduire
								</button>
							{/if}
						{/if}
					{:else if node.page}
						<!-- Page node -->
						<button
							class="group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent {selectedPage?.id === node.page.id ? 'bg-accent text-primary' : ''} {node.page.healthStatus === 'error' ? 'border-l-2 border-l-destructive' : ''}"
							style="padding-left: {depth * 16 + 8}px"
							onclick={() => selectPage(node.page!)}
						>
							<span class="h-1.5 w-1.5 shrink-0 rounded-full {getHealthDot(node.page.healthStatus)}"></span>
							<FileText class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							<span class="truncate {selectedPage?.id === node.page.id ? 'font-medium text-primary' : 'text-foreground'}">
								{node.page.title || node.name}
							</span>
							{#if node.page.captureMode === 'guided'}
								<span class="ml-auto shrink-0 rounded bg-purple-100 px-1 py-0.5 text-[9px] font-medium text-purple-700">Modale</span>
							{/if}
						</button>
						<!-- Also render children if any -->
						{#if node.children.length > 0}
							{#each node.children as child}
								{@render treeNodeSnippet(child, depth + 1, color)}
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
								<FolderOpen class="h-3.5 w-3.5 shrink-0" style="color: {color}" />
							{:else}
								<ChevronRight class="h-3 w-3 shrink-0 text-muted" />
								<Folder class="h-3.5 w-3.5 shrink-0" style="color: {color}" />
							{/if}
							<span class="truncate text-foreground">{node.name}</span>
						</button>
						{#if expandedPaths.has(node.path)}
							{#each node.children as child}
								{@render treeNodeSnippet(child, depth + 1, color)}
							{/each}
						{/if}
					{/if}
				{/snippet}

				{#each filteredTree()!.children as child, ci}
					{@render treeNodeSnippet(child, 0, getSectionColor(ci))}
				{/each}
			{/if}
		</div>

		<!-- Selected page breadcrumb path (tree hierarchy) -->
		{#if selectedPage}
			{@const breadcrumb = selectedPageBreadcrumb()}
			<div class="border-t border-border px-3 py-1.5 overflow-x-auto">
				<div class="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
					{#if breadcrumb.length > 0}
						{#each breadcrumb as segment, i}
							{#if i > 0}
								<ChevronRight class="h-2.5 w-2.5 shrink-0 text-muted" />
							{/if}
							<span class={i === breadcrumb.length - 1 ? 'font-medium text-foreground' : ''}>{segment}</span>
						{/each}
					{:else}
						<span class="font-medium text-foreground">{selectedPage.title}</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Tree footer -->
		<div class="border-t border-border px-3 py-2">
			<div class="space-y-1">
				{#if selectedProject}
					<p class="text-[10px] font-medium text-muted-foreground truncate">{selectedProject.name} — {selectedProject.toolName}</p>
				{/if}
				<div class="flex items-center justify-between">
				<!-- Version selector with arrows -->
				<div class="flex items-center gap-1">
					<button
						class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
						disabled={versions.findIndex((v) => v.id === selectedVersionId) <= 0}
						onclick={() => navigateVersion(-1)}
					>
						<ChevronLeft class="h-3.5 w-3.5" />
					</button>
					<span class="text-xs font-medium text-foreground">{selectedVersion?.name ?? '—'}</span>
					{#if selectedVersion}
						<Badge variant={getVersionStatusVariant(selectedVersion.status)} class="text-[9px] px-1 py-0">
							{getVersionStatusLabel(selectedVersion.status)}
						</Badge>
					{/if}
					<button
						class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
						disabled={versions.findIndex((v) => v.id === selectedVersionId) >= versions.length - 1}
						onclick={() => navigateVersion(1)}
					>
						<ChevronRight class="h-3.5 w-3.5" />
					</button>
				</div>
				<span class="text-xs text-muted-foreground">
					{pageStats().total} page{pageStats().total !== 1 ? 's' : ''}
				</span>
			</div>
			</div>
		</div>
	</div>

	<!-- Visible resize handle -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="group relative flex w-2 shrink-0 cursor-col-resize items-center justify-center border-x border-border bg-accent/30 transition-colors hover:bg-primary/10 {isResizing ? 'bg-primary/20' : ''}"
		onmousedown={startResize}
	>
		<div class="flex h-8 w-full items-center justify-center rounded-sm {isResizing ? 'text-primary' : 'text-muted-foreground/50 group-hover:text-muted-foreground'}">
			<GripVertical class="h-4 w-4" />
		</div>
	</div>

	<!-- Detail Panel (right) -->
	<div class="flex-1 overflow-y-auto bg-background p-6">
		{#if selectedPage}
			<!-- Breadcrumb with "/" separators -->
			<nav class="mb-4 flex items-center gap-1.5 text-sm">
				<span class="text-muted-foreground">{selectedProject?.name ?? 'Projet'}</span>
				{#each selectedPage.urlPath.split('/').filter(Boolean) as segment, i}
					<span class="text-muted/40">/</span>
					{#if i < selectedPage.urlPath.split('/').filter(Boolean).length - 1}
						<span class="text-muted-foreground">{segment}</span>
					{:else}
						<span class="font-medium text-foreground">{segment}</span>
					{/if}
				{/each}
			</nav>

			<!-- Browser frame preview -->
			<div class="mb-4 overflow-hidden rounded-lg border border-border shadow-sm">
				<!-- Browser chrome -->
				<div class="flex items-center gap-2 border-b border-border bg-accent/50 px-3 py-2">
					<!-- Traffic lights -->
					<div class="flex items-center gap-1.5">
						<span class="h-2.5 w-2.5 rounded-full bg-red-400"></span>
						<span class="h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
						<span class="h-2.5 w-2.5 rounded-full bg-green-400"></span>
					</div>
					<!-- Address bar -->
					<div class="flex flex-1 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs text-muted-foreground">
						<Globe class="h-3 w-3 shrink-0 text-muted" />
						<span class="truncate">
							{selectedProject?.subdomain ? `${selectedProject.subdomain}.demo.lemonlearning.com` : ''}/{selectedPage.urlPath}
						</span>
					</div>
				</div>
				<!-- Iframe content -->
				<div class="relative h-[280px] bg-white">
					{#if previewUrl()}
						<iframe
							src={previewUrl()}
							title="Aperçu de {selectedPage.title}"
							class="h-full w-full border-0"
							sandbox="allow-same-origin"
						></iframe>
					{:else}
						<div class="flex h-full items-center justify-center">
							<span class="text-sm text-muted-foreground">Aperçu non disponible</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Page title and actions -->
			<div class="mb-4 flex items-start justify-between">
				<div>
					<h2 class="text-lg font-semibold text-foreground">{selectedPage.title}</h2>
					<p class="mt-1 text-sm text-muted-foreground">/{selectedPage.urlPath}</p>
				</div>
				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" class="gap-1.5 text-xs">
						<GitCompare class="h-3.5 w-3.5" />
						Comparer
					</Button>
					<Button variant="outline" size="sm" class="gap-1.5 text-xs">
						<Camera class="h-3.5 w-3.5" />
						Recapturer
					</Button>
					<Button size="sm" class="gap-1.5 text-xs bg-success text-white hover:bg-success/90" onclick={() => {
						if (selectedProject?.subdomain && selectedPage) {
							window.open(`/demo/${selectedProject.subdomain}/${selectedPage.urlPath}`, '_blank');
						}
					}}>
						<ExternalLink class="h-3.5 w-3.5" />
						Ouvrir démo
					</Button>
				</div>
			</div>

			<!-- Sub-tabs -->
			<Tabs value={detailSubTab} onValueChange={(v) => { detailSubTab = v; }}>
				<TabsList class="mb-4">
					<TabsTrigger value="preview" class="text-xs">Aperçu</TabsTrigger>
					<TabsTrigger value="editor" class="text-xs">Éditeur HTML</TabsTrigger>
					<TabsTrigger value="links" class="text-xs">Liens & Navigation</TabsTrigger>
					<TabsTrigger value="javascript" class="text-xs">JavaScript</TabsTrigger>
				</TabsList>
			</Tabs>

			{#if detailSubTab === 'preview'}
				<!-- Page metadata -->
				<div class="grid gap-6 lg:grid-cols-2">
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
										Taille
									</dt>
									<dd class="text-sm text-foreground">{formatFileSize(selectedPage.fileSize)}</dd>
								</div>
								<Separator />
								<div class="flex items-center justify-between">
									<dt class="flex items-center gap-2 text-sm text-muted-foreground">
										<Calendar class="h-3.5 w-3.5" />
										Capture le
									</dt>
									<dd class="text-sm text-foreground">{formatDate(selectedPage.createdAt)}</dd>
								</div>
								<Separator />
								<div class="flex items-center justify-between">
									<dt class="flex items-center gap-2 text-sm text-muted-foreground">
										<Camera class="h-3.5 w-3.5" />
										Mode
									</dt>
									<dd class="text-sm text-foreground">{getCaptureLabel(selectedPage.captureMode)}</dd>
								</div>
								<Separator />
								<div class="flex items-center justify-between">
									<dt class="flex items-center gap-2 text-sm text-muted-foreground">
										<AlertCircle class="h-3.5 w-3.5" />
										Santé
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

					<div class="space-y-6">
						<Card>
							<CardContent class="p-5">
								<h3 class="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Obfuscation active</h3>
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
						<Card>
							<CardContent class="p-5">
								<h3 class="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Guides associés</h3>
								<p class="text-sm text-muted-foreground">Aucun guide associé à cette page.</p>
							</CardContent>
						</Card>
					</div>
				</div>
			{:else if detailSubTab === 'editor'}
				<div class="flex items-center justify-center py-12">
					<a href="/admin/editor/{selectedPage.id}">
						<Button class="gap-1.5">
							<Pencil class="h-4 w-4" />
							Ouvrir dans l'éditeur
						</Button>
					</a>
				</div>
			{:else if detailSubTab === 'links'}
				<div class="flex items-center justify-center py-12 text-center">
					<div>
						<Link2 class="mx-auto h-8 w-8 text-muted" />
						<p class="mt-3 text-sm text-muted-foreground">Liens détectés disponibles dans l'éditeur</p>
						<a href="/admin/editor/{selectedPage.id}" class="mt-2 inline-block text-sm text-primary hover:underline">Ouvrir l'éditeur</a>
					</div>
				</div>
			{:else if detailSubTab === 'javascript'}
				<div class="flex items-center justify-center py-12 text-center">
					<div>
						<FileText class="mx-auto h-8 w-8 text-muted" />
						<p class="mt-3 text-sm text-muted-foreground">Scripts détectés disponibles dans l'éditeur</p>
						<a href="/admin/editor/{selectedPage.id}" class="mt-2 inline-block text-sm text-primary hover:underline">Ouvrir l'éditeur</a>
					</div>
				</div>
			{/if}
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
