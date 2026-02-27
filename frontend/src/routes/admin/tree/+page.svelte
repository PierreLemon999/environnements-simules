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
	import { SearchableSelect } from '$components/ui/searchable-select';
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
		ExternalLink,
		Pencil,
		Eye,
		Shield,
		BookOpen,
		AlertCircle,
		GripVertical,
		GitCompare,
		Code,
		Download,
		Image,
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
		mhtmlPath: string | null;
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
			status: string;
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

	// Category color palette for tree sections
	const sectionColors = [
		'#3B82F6', '#14B8A6', '#F59E0B', '#8B5CF6', '#EF4444',
		'#10B981', '#EC4899', '#06B6D4', '#F97316', '#6366F1',
	];

	// Background colors matching section colors
	const sectionBgColors = [
		'#DBEAFE', '#CCFBF1', '#FEF3C7', '#EDE9FE', '#FEE2E2',
		'#D1FAE5', '#FCE7F3', '#CFFAFE', '#FFEDD5', '#E0E7FF',
	];

	function getSectionColor(index: number): string {
		return sectionColors[index % sectionColors.length];
	}

	function getSectionBgColor(index: number): string {
		return sectionBgColors[index % sectionBgColors.length];
	}

	// Status helpers
	function getHealthDot(status: string): string {
		switch (status) {
			case 'ok': return 'bg-success';
			case 'warning': return 'bg-warning';
			case 'error': return 'bg-destructive';
			default: return 'bg-muted';
		}
	}

	function getHealthLabel(status: string): string {
		switch (status) {
			case 'ok': return 'OK';
			case 'warning': return 'Avertissement';
			case 'error': return 'Erreur';
			default: return status;
		}
	}

	function getCaptureLabel(mode: string): string {
		switch (mode) {
			case 'free': return 'Capture libre';
			case 'guided': return 'Capture guidée';
			case 'auto': return 'Capture automatique';
			default: return mode;
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

	function selectPage(p: Page) {
		selectedPage = p;
		detailSubTab = 'preview';
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
			case 'draft': return 'warning';
			case 'archived': case 'deprecated': return 'secondary';
			default: return 'secondary';
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
			const detailed = await Promise.all(
				res.data.map((p) =>
					get<{ data: Project }>(`/projects/${p.id}`).then((r) => r.data)
				)
			);
			projects = detailed;

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
		<!-- Tree panel header with title -->
		<div class="flex items-center justify-between border-b border-border px-4 py-3">
			<h2 class="text-sm font-semibold text-foreground truncate">
				{selectedProject?.name ?? 'Chargement...'}{selectedVersion ? ` — ${selectedVersion.name}` : ''}
			</h2>
		</div>

		<!-- Project selector + Tabs + Search -->
		<div class="space-y-2 border-b border-border px-3 py-2">
			<!-- Project selector -->
			<SearchableSelect
				bind:value={selectedProjectId}
				options={projects.map(p => ({ value: p.id, label: p.name }))}
				placeholder="Chargement..."
				searchable={true}
				searchPlaceholder="Rechercher un projet..."
				class="w-full"
			/>

			<!-- Tabs: Arborescence / Liste / Carte du site -->
			<div class="flex gap-1 text-xs">
				<button
					class="flex-1 rounded-md px-2 py-1.5 font-medium transition-colors {treeTab === 'site' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
					onclick={() => { treeTab = 'site'; }}
				>
					Arborescence
				</button>
				<button
					class="flex-1 rounded-md px-2 py-1.5 font-medium transition-colors {treeTab === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
					onclick={() => { treeTab = 'list'; }}
				>
					Liste
				</button>
				<button
					class="flex-1 rounded-md px-2 py-1.5 font-medium transition-colors {treeTab === 'map' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
					onclick={() => { treeTab = 'map'; }}
				>
					Carte du site
				</button>
			</div>

			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
				<input
					bind:value={searchQuery}
					placeholder="Filtrer les pages..."
					class="flex h-8 w-full rounded-md border border-border bg-accent/30 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
				/>
			</div>
		</div>

		<!-- Status bar -->
		{#if tree && !treeLoading}
			{@const stats = pageStats()}
			<div class="flex items-center gap-3 border-b border-border bg-accent/20 px-3 py-1.5 text-[11px] text-muted-foreground">
				<span class="inline-flex items-center gap-1 font-medium">
					<span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
					{stats.total} pages
				</span>
				<span class="inline-flex items-center gap-1 font-medium">
					<span class="h-1.5 w-1.5 rounded-full" style="background: #8b5cf6"></span>
					{stats.modals} modales
				</span>
				<span class="inline-flex items-center gap-1 font-medium">
					<span class="h-1.5 w-1.5 rounded-full bg-destructive"></span>
					{stats.error} erreurs
				</span>
			</div>
		{/if}

		<!-- Tree content -->
		<div class="flex-1 overflow-y-auto py-1">
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
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if treeTab === 'list'}
				<!-- Flat list view of all pages -->
				<div class="px-1 py-1">
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
							{#each allPages as pg}
								<button
									class="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-accent/50 {selectedPage?.id === pg.id ? 'bg-primary/10 text-primary' : ''}"
									onclick={() => selectPage(pg)}
								>
									<span class="h-[7px] w-[7px] shrink-0 rounded-full {getHealthDot(pg.healthStatus)}"></span>
									<FileText class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
									<span class="truncate {selectedPage?.id === pg.id ? 'font-medium text-primary' : 'text-foreground'}">{pg.title}</span>
								</button>
							{/each}
						{/if}
					{/if}
				</div>
			{:else if treeTab === 'map'}
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
				{#snippet treeNodeSnippet(node: TreeNode, depth: number, color: string, bgColor: string)}
					{#if node.children.length > 0 && !node.page}
						<!-- Folder/group node -->
						<button
							class="group flex w-full items-center gap-1.5 py-[6px] text-left text-[12px] font-semibold transition-colors hover:bg-accent/50"
							style="padding-left: {depth * 16 + 12}px; padding-right: 12px"
							onclick={() => toggleExpand(node.path)}
						>
							<svg
								class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200"
								class:rotate-90={expandedPaths.has(node.path)}
								viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							>
								<path d="M9 18l6-6-6-6"/>
							</svg>
							<span
								class="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold"
								style="background: {bgColor}; color: {color}"
							>
								{node.name.charAt(0).toUpperCase()}
							</span>
							<span class="flex-1 truncate text-muted-foreground">{node.name}</span>
							<span class="text-[11px] font-normal text-muted-foreground">
								({countPages(node)})
							</span>
						</button>
						{#if expandedPaths.has(node.path)}
							{@const isFullyExpanded = fullyExpandedSections.has(node.path)}
							{@const limit = isFullyExpanded ? node.children.length : SECTION_PAGE_LIMIT}
							{@const visibleChildren = node.children.slice(0, limit)}
							{@const hiddenCount = node.children.length - visibleChildren.length}
							{#each visibleChildren as child}
								{@render treeNodeSnippet(child, depth + 1, color, bgColor)}
							{/each}
							{#if hiddenCount > 0}
								<button
									class="w-full py-1 text-left text-[11px] font-medium text-primary hover:underline"
									style="padding-left: {(depth + 1) * 16 + 12}px"
									onclick={() => toggleFullExpand(node.path)}
								>
									... et {hiddenCount} autre{hiddenCount !== 1 ? 's' : ''} page{hiddenCount !== 1 ? 's' : ''}
								</button>
							{:else if isFullyExpanded && node.children.length > SECTION_PAGE_LIMIT}
								<button
									class="w-full py-1 text-left text-[11px] text-muted-foreground hover:underline"
									style="padding-left: {(depth + 1) * 16 + 12}px"
									onclick={() => toggleFullExpand(node.path)}
								>
									Réduire
								</button>
							{/if}
						{/if}
					{:else if node.page}
						<!-- Page item -->
						<button
							class="group flex w-full items-center gap-2 py-[5px] text-left text-[13px] transition-colors hover:bg-accent/50 {selectedPage?.id === node.page.id ? 'bg-primary/10' : ''}"
							style="padding-left: {depth * 16 + 12}px; padding-right: 12px"
							onclick={() => selectPage(node.page!)}
						>
							<FileText class="h-[15px] w-[15px] shrink-0 text-muted-foreground/50" />
							<span class="flex-1 truncate {selectedPage?.id === node.page.id ? 'font-medium text-primary' : 'text-muted-foreground'}">
								{node.page.title || node.name}
							</span>
							<span class="h-[7px] w-[7px] shrink-0 rounded-full {getHealthDot(node.page.healthStatus)}"></span>
						</button>
						{#if node.children.length > 0}
							{#each node.children as child}
								{@render treeNodeSnippet(child, depth + 1, color, bgColor)}
							{/each}
						{/if}
					{:else}
						<!-- Empty folder -->
						<button
							class="group flex w-full items-center gap-1.5 py-[6px] text-left text-[12px] font-semibold transition-colors hover:bg-accent/50"
							style="padding-left: {depth * 16 + 12}px; padding-right: 12px"
							onclick={() => toggleExpand(node.path)}
						>
							<svg
								class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200"
								class:rotate-90={expandedPaths.has(node.path)}
								viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							>
								<path d="M9 18l6-6-6-6"/>
							</svg>
							<span
								class="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold"
								style="background: {bgColor}; color: {color}"
							>
								{node.name.charAt(0).toUpperCase()}
							</span>
							<span class="flex-1 truncate text-muted-foreground">{node.name}</span>
						</button>
						{#if expandedPaths.has(node.path)}
							{#each node.children as child}
								{@render treeNodeSnippet(child, depth + 1, color, bgColor)}
							{/each}
						{/if}
					{/if}
				{/snippet}

				{#each filteredTree()!.children as child, ci}
					{@render treeNodeSnippet(child, 0, getSectionColor(ci), getSectionBgColor(ci))}
				{/each}
			{/if}
		</div>

		<!-- Breadcrumb at bottom of tree panel -->
		{#if selectedPage}
			{@const breadcrumb = selectedPageBreadcrumb()}
			<div class="border-t border-border bg-accent/20 px-3 py-2 overflow-x-auto">
				<div class="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
					{#if breadcrumb.length > 0}
						{#each breadcrumb as segment, i}
							{#if i > 0}
								<span class="text-muted-foreground/40">/</span>
							{/if}
							<span class={i === breadcrumb.length - 1 ? 'font-medium text-foreground' : ''}>{segment}</span>
						{/each}
					{:else}
						<span class="font-medium text-foreground">{selectedPage.title}</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Tree footer: version selector + page count -->
		<div class="border-t border-border px-3 py-2">
			<div class="flex items-center justify-between">
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
				<span class="text-[11px] text-muted-foreground">
					{pageStats().total} page{pageStats().total !== 1 ? 's' : ''}
				</span>
			</div>
		</div>
	</div>

	<!-- Resize handle -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="relative flex w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/10 {isResizing ? 'bg-primary/20' : ''}"
		onmousedown={startResize}
	>
		<div class="absolute inset-0"></div>
	</div>

	<!-- Detail Panel (right) -->
	<div class="flex flex-1 flex-col overflow-hidden bg-background">
		{#if selectedPage}
			<!-- Top bar: breadcrumb + sub-tabs + actions -->
			<div class="flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-2.5">
				<!-- Breadcrumb -->
				<nav class="flex items-center gap-1.5 text-[13px] shrink-0">
					<span class="text-muted-foreground">{selectedProject?.name ?? 'Projet'}</span>
					{#each selectedPage.urlPath.split('/').filter(Boolean) as segment, i}
						<span class="text-muted-foreground/40">/</span>
						{#if i < selectedPage.urlPath.split('/').filter(Boolean).length - 1}
							<span class="text-muted-foreground">{segment}</span>
						{:else}
							<span class="font-medium text-foreground">{segment}</span>
						{/if}
					{/each}
				</nav>

				<!-- Sub-tabs (inline in topbar) -->
				<div class="flex items-center gap-0.5">
					<button
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition-colors border-b-2 {detailSubTab === 'preview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
						onclick={() => { detailSubTab = 'preview'; }}
					>
						<Eye class="h-[15px] w-[15px]" />
						Aperçu
					</button>
					<button
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition-colors border-b-2 {detailSubTab === 'editor' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
						onclick={() => { detailSubTab = 'editor'; }}
					>
						<Code class="h-[15px] w-[15px]" />
						Éditeur HTML
					</button>
					<button
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition-colors border-b-2 {detailSubTab === 'links' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
						onclick={() => { detailSubTab = 'links'; }}
					>
						<Link2 class="h-[15px] w-[15px]" />
						Liens & Navigation
					</button>
					<button
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition-colors border-b-2 {detailSubTab === 'javascript' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
						onclick={() => { detailSubTab = 'javascript'; }}
					>
						<FileText class="h-[15px] w-[15px]" />
						JavaScript
					</button>
					<button
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition-colors border-b-2 {detailSubTab === 'debug' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
						onclick={() => { detailSubTab = 'debug'; }}
					>
						<Image class="h-[15px] w-[15px]" />
						Debug
					</button>
				</div>

				<!-- Action buttons -->
				<div class="flex items-center gap-2 shrink-0">
					<Button variant="outline" size="sm" class="gap-1.5 text-xs h-8">
						<Eye class="h-3.5 w-3.5" />
						Comparer
					</Button>
					<Button variant="default" size="sm" class="gap-1.5 text-xs h-8" onclick={() => {
						if (selectedProject?.subdomain && selectedPage) {
							window.open(`/demo/${selectedProject.subdomain}/${selectedPage.urlPath}`, '_blank');
						}
					}}>
						<ExternalLink class="h-3.5 w-3.5" />
						Recapturer
					</Button>
				</div>
			</div>

			<!-- Content area -->
			{#if detailSubTab === 'preview'}
				<!-- Browser preview fills remaining space -->
				<div class="flex flex-1 overflow-hidden bg-[#ebebeb] p-5">
					<div class="flex flex-1 flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-lg">
						<!-- Browser chrome -->
						<div class="flex items-center gap-2.5 border-b border-border bg-[#f5f5f4] px-3.5 py-2.5">
							<div class="flex items-center gap-[5px]">
								<span class="h-[10px] w-[10px] rounded-full bg-[#ff5f57]"></span>
								<span class="h-[10px] w-[10px] rounded-full bg-[#ffbd2e]"></span>
								<span class="h-[10px] w-[10px] rounded-full bg-[#28c840]"></span>
							</div>
							<div class="flex flex-1 items-center gap-2 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-mono text-muted-foreground">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 shrink-0 text-success">
									<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
								</svg>
								<span>
									<span class="text-success">https://</span><span class="font-medium text-foreground">{selectedProject?.subdomain ?? ''}.en-ll.com</span>/{selectedPage.urlPath}
								</span>
							</div>
						</div>
						<!-- Page content -->
						<div class="flex-1 overflow-y-auto bg-[#f4f6f9]">
							{#if previewUrl()}
								<iframe
									src={previewUrl()}
									title="Aperçu de {selectedPage.title}"
									class="h-full w-full border-0"
									sandbox="allow-same-origin"
								></iframe>
							{:else}
								<div class="flex h-full items-center justify-center">
									<div class="text-center text-muted-foreground">
										<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-border/50">
											<Eye class="h-6 w-6" />
										</div>
										<p class="text-sm font-medium">Aperçu non disponible</p>
										<p class="mt-1 text-xs">La page sera affichée ici après capture.</p>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else if detailSubTab === 'editor'}
				<div class="flex flex-1 items-center justify-center bg-accent/20">
					<div class="text-center text-muted-foreground">
						<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
							<Code class="h-7 w-7" />
						</div>
						<h3 class="text-[15px] font-semibold text-foreground/70">Éditeur HTML</h3>
						<p class="mt-1 max-w-xs text-xs">Cette vue est détaillée dans la maquette Éditeur de Pages</p>
						<a href="/admin/editor/{selectedPage.id}" class="mt-3 inline-block">
							<Button variant="outline" size="sm" class="gap-1.5 text-xs">
								<Pencil class="h-3.5 w-3.5" />
								Ouvrir dans l'éditeur
							</Button>
						</a>
					</div>
				</div>
			{:else if detailSubTab === 'links'}
				<div class="flex flex-1 items-center justify-center bg-accent/20">
					<div class="text-center text-muted-foreground">
						<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
							<Link2 class="h-7 w-7" />
						</div>
						<h3 class="text-[15px] font-semibold text-foreground/70">Liens & Navigation</h3>
						<p class="mt-1 max-w-xs text-xs">Cette vue est détaillée dans la maquette Éditeur de Pages</p>
					</div>
				</div>
			{:else if detailSubTab === 'javascript'}
				<div class="flex flex-1 items-center justify-center bg-accent/20">
					<div class="text-center text-muted-foreground">
						<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
							<FileText class="h-7 w-7" />
						</div>
						<h3 class="text-[15px] font-semibold text-foreground/70">JavaScript</h3>
						<p class="mt-1 max-w-xs text-xs">Cette vue est détaillée dans la maquette Éditeur de Pages</p>
					</div>
				</div>
			{:else if detailSubTab === 'debug'}
				<div class="flex-1 overflow-y-auto p-5 space-y-6">
					<!-- Screenshot section -->
					<div class="space-y-3">
						<h3 class="text-sm font-semibold text-foreground flex items-center gap-2">
							<Camera class="h-4 w-4 text-muted-foreground" />
							Capture d'écran
						</h3>
						{#if selectedPage.thumbnailPath}
							<div class="rounded-lg border border-border overflow-hidden bg-white shadow-sm">
								<img
									src="/api/pages/{selectedPage.id}/screenshot"
									alt="Capture d'écran de {selectedPage.title}"
									class="w-full h-auto"
									loading="lazy"
								/>
							</div>
							<div class="flex items-center gap-3 text-xs text-muted-foreground">
								<span>Capturée le {formatDate(selectedPage.createdAt)}</span>
								<a
									href="/api/pages/{selectedPage.id}/screenshot"
									download="{selectedPage.title}.png"
									class="inline-flex items-center gap-1 text-primary hover:underline"
								>
									<Download class="h-3 w-3" />
									Télécharger PNG
								</a>
							</div>
						{:else}
							<div class="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-border bg-accent/20">
								<Camera class="h-8 w-8 text-muted" />
								<p class="mt-2 text-sm text-muted-foreground">Aucune capture d'écran disponible</p>
								<p class="mt-0.5 text-xs text-muted">La capture d'écran est générée automatiquement lors de la capture de page.</p>
							</div>
						{/if}
					</div>

					<!-- MHTML section -->
					<div class="space-y-3">
						<h3 class="text-sm font-semibold text-foreground flex items-center gap-2">
							<Code class="h-4 w-4 text-muted-foreground" />
							MHTML (debug)
						</h3>
						{#if selectedPage.mhtmlPath}
							<div class="rounded-lg border border-border bg-card p-4 space-y-3">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
											<FileText class="h-4 w-4 text-blue-600" />
										</div>
										<div>
											<p class="text-sm font-medium text-foreground">{selectedPage.title}.mhtml</p>
											<p class="text-xs text-muted-foreground">Capture MHTML complète avec ressources intégrées</p>
										</div>
									</div>
									<a
										href="/api/pages/{selectedPage.id}/mhtml"
										download
										class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent"
									>
										<Download class="h-3.5 w-3.5" />
										Télécharger
									</a>
								</div>
								<p class="text-xs text-muted-foreground leading-relaxed">
									Le fichier MHTML contient la page et toutes ses ressources (CSS, images, polices) dans un seul fichier.
									Ouvrez-le dans Chrome pour une visualisation fidèle de la capture.
								</p>
							</div>
						{:else}
							<div class="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-border bg-accent/20">
								<Code class="h-8 w-8 text-muted" />
								<p class="mt-2 text-sm text-muted-foreground">Aucun fichier MHTML disponible</p>
								<p class="mt-0.5 text-xs text-muted">Activez l'option «Capture MHTML (debug)» dans l'extension pour capturer le MHTML.</p>
							</div>
						{/if}
					</div>

					<!-- Page metadata -->
					<div class="space-y-3">
						<h3 class="text-sm font-semibold text-foreground flex items-center gap-2">
							<FileText class="h-4 w-4 text-muted-foreground" />
							Métadonnées
						</h3>
						<div class="rounded-lg border border-border bg-card p-4">
							<dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
								<div>
									<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">URL source</dt>
									<dd class="mt-0.5 text-foreground font-mono text-xs break-all">{selectedPage.urlSource}</dd>
								</div>
								<div>
									<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Chemin URL</dt>
									<dd class="mt-0.5 text-foreground font-mono text-xs">/{selectedPage.urlPath}</dd>
								</div>
								<div>
									<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Mode de capture</dt>
									<dd class="mt-0.5 text-foreground">{getCaptureLabel(selectedPage.captureMode)}</dd>
								</div>
								<div>
									<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Taille du fichier</dt>
									<dd class="mt-0.5 text-foreground">{formatFileSize(selectedPage.fileSize)}</dd>
								</div>
								<div>
									<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Statut</dt>
									<dd class="mt-0.5 flex items-center gap-1.5">
										<span class="h-2 w-2 rounded-full {getHealthDot(selectedPage.healthStatus)}"></span>
										{getHealthLabel(selectedPage.healthStatus)}
									</dd>
								</div>
								<div>
									<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Capturée le</dt>
									<dd class="mt-0.5 text-foreground">{formatDate(selectedPage.createdAt)}</dd>
								</div>
							</dl>
						</div>
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
