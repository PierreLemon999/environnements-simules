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
		Layers,
		Fingerprint,
		ArrowRight,
		ArrowLeft,
		Clock,
		Network,
		GitFork,
		Circle,
		ZoomIn,
		ZoomOut,
		RotateCcw,
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
		pageType?: 'page' | 'modal' | 'spa_state';
		parentPageId?: string | null;
		domFingerprint?: string | null;
		syntheticUrl?: string | null;
		captureTimingMs?: number | null;
		stateIndex?: number | null;
		createdAt: string;
	}

	interface TreeNode {
		name: string;
		path: string;
		page?: Page;
		modals?: Page[];
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

	interface Transition {
		id: string;
		versionId: string;
		sourcePageId: string;
		targetPageId: string;
		triggerType: string;
		triggerSelector: string | null;
		triggerText: string | null;
		loadingTimeMs: number | null;
		hadLoadingIndicator: number;
		loadingIndicatorType: string | null;
		captureMode: string;
		createdAt: string;
	}

	interface PageTransitionsData {
		incoming: Transition[];
		outgoing: Transition[];
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
	let pageTransitionsData: PageTransitionsData | null = $state(null);
	let transitionsLoading = $state(false);
	let treeTab = $state('site');
	let treeSubTab = $state<'site' | 'guide'>('site');
	let detailSubTab = $state('preview');

	// Map / graph state
	let mapView = $state<'navigation' | 'hierarchy' | 'star'>('navigation');
	let allTransitions: Transition[] = $state([]);
	let mapLoading = $state(false);
	let mapScale = $state(1);
	let mapPanX = $state(0);
	let mapPanY = $state(0);
	let isPanning = $state(false);
	let panStartX = $state(0);
	let panStartY = $state(0);
	let panStartPanX = $state(0);
	let panStartPanY = $state(0);
	let starCenterPageId = $state<string | null>(null);

	interface GraphNode {
		page: Page;
		x: number;
		y: number;
	}

	// Collect all pages from tree
	function collectAllPages(): Page[] {
		if (!tree) return [];
		const pages: Page[] = [];
		function walk(node: TreeNode) {
			if (node.page) pages.push(node.page);
			if (node.modals) pages.push(...node.modals);
			node.children.forEach(walk);
		}
		walk(tree);
		return pages;
	}

	// Navigation layout: BFS layers top-to-bottom
	function computeNavigationLayout(pages: Page[], transitions: Transition[]): GraphNode[] {
		if (pages.length === 0) return [];
		const incomingSet = new Set(transitions.map(t => t.targetPageId));
		const adj = new Map<string, string[]>();
		for (const t of transitions) {
			const arr = adj.get(t.sourcePageId) || [];
			arr.push(t.targetPageId);
			adj.set(t.sourcePageId, arr);
		}
		const roots = pages.filter(p => !incomingSet.has(p.id));
		if (roots.length === 0 && pages.length > 0) roots.push(pages[0]);

		const layerMap = new Map<string, number>();
		const queue = roots.map(r => ({ id: r.id, layer: 0 }));
		while (queue.length > 0) {
			const { id, layer } = queue.shift()!;
			if (layerMap.has(id)) continue;
			layerMap.set(id, layer);
			for (const n of (adj.get(id) || [])) {
				if (!layerMap.has(n)) queue.push({ id: n, layer: layer + 1 });
			}
		}
		// Assign unvisited pages to last layer + 1
		const maxLayer = Math.max(0, ...layerMap.values());
		for (const p of pages) {
			if (!layerMap.has(p.id)) layerMap.set(p.id, maxLayer + 1);
		}

		const layerGroups = new Map<number, Page[]>();
		for (const p of pages) {
			const l = layerMap.get(p.id) ?? 0;
			const arr = layerGroups.get(l) || [];
			arr.push(p);
			layerGroups.set(l, arr);
		}

		const result: GraphNode[] = [];
		for (const [layer, group] of layerGroups) {
			const startX = -(group.length - 1) * 100;
			group.forEach((p, i) => {
				result.push({ page: p, x: startX + i * 200, y: layer * 120 });
			});
		}
		return result;
	}

	// Hierarchy layout: tree based on URL structure
	function computeHierarchyLayout(treeRoot: TreeNode): GraphNode[] {
		const result: GraphNode[] = [];
		let leafIndex = 0;

		// First pass: count leaves to determine widths
		function countLeaves(node: TreeNode): number {
			if (node.children.length === 0) return 1;
			return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
		}

		function layout(node: TreeNode, depth: number, offsetX: number): number {
			const leaves = countLeaves(node);
			const width = leaves * 180;

			if (node.page) {
				result.push({ page: node.page, x: offsetX + width / 2, y: depth * 100 });
			}

			let childX = offsetX;
			for (const child of node.children) {
				const childWidth = countLeaves(child) * 180;
				layout(child, depth + 1, childX);
				childX += childWidth;
			}

			// Modals positioned slightly offset below
			if (node.modals) {
				node.modals.forEach((modal, i) => {
					result.push({ page: modal, x: offsetX + width / 2 + (i + 1) * 160, y: depth * 100 + 50 });
				});
			}

			return width;
		}

		if (treeRoot.children.length > 0) {
			let offsetX = 0;
			for (const child of treeRoot.children) {
				const w = layout(child, 0, offsetX);
				offsetX += w;
			}
		}
		return result;
	}

	// Star layout: selected page at center, connected pages in a circle
	function computeStarLayout(pages: Page[], transitions: Transition[], centerId: string): GraphNode[] {
		if (pages.length === 0) return [];
		const centerPage = pages.find(p => p.id === centerId);
		if (!centerPage) return pages.map((p, i) => ({ page: p, x: Math.cos(i * 2 * Math.PI / pages.length) * 250, y: Math.sin(i * 2 * Math.PI / pages.length) * 250 }));

		const connectedIds = new Set<string>();
		for (const t of transitions) {
			if (t.sourcePageId === centerId) connectedIds.add(t.targetPageId);
			if (t.targetPageId === centerId) connectedIds.add(t.sourcePageId);
		}
		connectedIds.delete(centerId);

		const connectedPages = pages.filter(p => connectedIds.has(p.id));
		const unconnectedPages = pages.filter(p => p.id !== centerId && !connectedIds.has(p.id));

		const result: GraphNode[] = [{ page: centerPage, x: 0, y: 0 }];

		// Inner ring: connected pages
		const innerRadius = Math.max(200, connectedPages.length * 30);
		connectedPages.forEach((p, i) => {
			const angle = (i * 2 * Math.PI) / connectedPages.length - Math.PI / 2;
			result.push({ page: p, x: Math.cos(angle) * innerRadius, y: Math.sin(angle) * innerRadius });
		});

		// Outer ring: unconnected pages (if any)
		if (unconnectedPages.length > 0) {
			const outerRadius = innerRadius + 180;
			unconnectedPages.forEach((p, i) => {
				const angle = (i * 2 * Math.PI) / unconnectedPages.length - Math.PI / 2;
				result.push({ page: p, x: Math.cos(angle) * outerRadius, y: Math.sin(angle) * outerRadius });
			});
		}

		return result;
	}

	// Compute graph nodes based on current view
	let graphNodes = $derived(() => {
		const pages = collectAllPages();
		if (pages.length === 0) return [];

		if (mapView === 'navigation') {
			return computeNavigationLayout(pages, allTransitions);
		} else if (mapView === 'hierarchy') {
			return tree ? computeHierarchyLayout(tree) : [];
		} else {
			const center = starCenterPageId || selectedPage?.id || pages[0]?.id;
			return computeStarLayout(pages, allTransitions, center);
		}
	});

	let graphNodesById = $derived(() => {
		const map = new Map<string, GraphNode>();
		for (const n of graphNodes()) {
			map.set(n.page.id, n);
		}
		return map;
	});

	// SVG viewBox
	let svgViewBox = $derived(() => {
		const w = 1200 / mapScale;
		const h = 800 / mapScale;
		return `${-w / 2 - mapPanX} ${-60 - mapPanY} ${w} ${h}`;
	});

	async function loadAllTransitions() {
		if (!selectedVersionId) return;
		mapLoading = true;
		try {
			const res = await get<{ data: Transition[] }>(`/versions/${selectedVersionId}/transitions`);
			allTransitions = res.data;
		} catch {
			allTransitions = [];
		} finally {
			mapLoading = false;
		}
	}

	function mapZoomIn() { mapScale = Math.min(4, mapScale * 1.3); }
	function mapZoomOut() { mapScale = Math.max(0.2, mapScale / 1.3); }
	function mapResetView() { mapScale = 1; mapPanX = 0; mapPanY = 0; }

	function mapStartPan(e: MouseEvent) {
		isPanning = true;
		panStartX = e.clientX;
		panStartY = e.clientY;
		panStartPanX = mapPanX;
		panStartPanY = mapPanY;
	}

	function mapOnPan(e: MouseEvent) {
		if (!isPanning) return;
		mapPanX = panStartPanX + (e.clientX - panStartX) / mapScale;
		mapPanY = panStartPanY + (e.clientY - panStartY) / mapScale;
	}

	function mapEndPan() { isPanning = false; }

	function mapOnWheel(e: WheelEvent) {
		e.preventDefault();
		if (e.deltaY < 0) mapZoomIn();
		else mapZoomOut();
	}

	function getTriggerColor(type: string): string {
		switch (type) {
			case 'click': return '#9CA3AF';
			case 'pushState': return '#3B82F6';
			case 'replaceState': return '#8B5CF6';
			case 'popstate': return '#F59E0B';
			case 'hashchange': return '#14B8A6';
			default: return '#D1D5DB';
		}
	}

	function getHealthFill(status: string): string {
		switch (status) {
			case 'ok': return '#10B981';
			case 'warning': return '#F59E0B';
			case 'error': return '#EF4444';
			default: return '#9CA3AF';
		}
	}

	// Compute curved path between two nodes
	function computeEdgePath(x1: number, y1: number, x2: number, y2: number): string {
		const dy = y2 - y1;
		const dx = x2 - x1;
		const midY = y1 + dy / 2;
		return `M ${x1} ${y1 + 20} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2 - 20}`;
	}

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
		if (!tree) return { ok: 0, warning: 0, error: 0, total: 0, modals: 0, totalSize: 0 };
		const stats = { ok: 0, warning: 0, error: 0, total: 0, modals: 0, totalSize: 0 };
		function walk(node: TreeNode) {
			if (node.page) {
				stats.total++;
				stats[node.page.healthStatus]++;
				stats.totalSize += node.page.fileSize || 0;
			}
			if (node.modals) {
				stats.modals += node.modals.length;
				stats.total += node.modals.length;
				for (const m of node.modals) stats.totalSize += m.fileSize || 0;
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

		const matchesModal = node.modals?.some(m =>
			m.title.toLowerCase().includes(q)
		);

		if (matchesPage || matchesModal || filteredChildren.length > 0) {
			return { ...node, children: filteredChildren };
		}
		return null;
	}

	let filteredTree = $derived(() => {
		if (!tree) return null;
		return filterTree(tree, searchQuery);
	});

	// Map of all pages by ID for name resolution in transitions
	let pagesById = $derived(() => {
		if (!tree) return new Map<string, Page>();
		const map = new Map<string, Page>();
		function walk(node: TreeNode) {
			if (node.page) map.set(node.page.id, node.page);
			if (node.modals) {
				for (const modal of node.modals) map.set(modal.id, modal);
			}
			node.children.forEach(walk);
		}
		walk(tree);
		return map;
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

	function getPageTypeLabel(type: string | undefined): string {
		switch (type) {
			case 'modal': return 'Modale';
			case 'spa_state': return 'État SPA';
			default: return 'Page';
		}
	}

	function getTriggerTypeLabel(type: string): string {
		switch (type) {
			case 'click': return 'Clic';
			case 'pushState': return 'pushState';
			case 'replaceState': return 'replaceState';
			case 'popstate': return 'Retour';
			case 'hashchange': return 'Hash';
			case 'manual': return 'Manuel';
			default: return type;
		}
	}

	function formatLoadingTime(ms: number | null): string {
		if (ms === null || ms === undefined) return '—';
		if (ms < 1000) return `${ms} ms`;
		return `${(ms / 1000).toFixed(1)} s`;
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
		loadPageTransitions(p.id);
	}

	async function loadPageTransitions(pageId: string) {
		transitionsLoading = true;
		try {
			const res = await get<{ data: PageTransitionsData }>(`/pages/${pageId}/transitions`);
			pageTransitionsData = res.data;
		} catch {
			pageTransitionsData = null;
		} finally {
			transitionsLoading = false;
		}
	}

	function countPages(node: TreeNode): number {
		let count = node.page ? 1 : 0;
		if (node.modals) count += node.modals.length;
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

	$effect(() => {
		if (treeTab === 'map' && selectedVersionId) {
			loadAllTransitions();
		}
	});

	onMount(() => {
		loadProjects();
	});
</script>

<svelte:head>
	<title>Arborescence capture — Lemon Lab</title>
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
				<span class="inline-flex items-center gap-1 font-medium">
					<HardDrive class="h-3 w-3" />
					{formatFileSize(stats.totalSize)}
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
								if (node.modals) pages.push(...node.modals);
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
									{#if pg.thumbnailPath}
										<img
											src="/api/pages/{pg.id}/screenshot"
											alt=""
											class="h-6 w-10 shrink-0 rounded-[3px] border border-border object-cover object-top"
											loading="lazy"
										/>
									{:else if pg.pageType === 'modal'}
										<Layers class="h-3.5 w-3.5 shrink-0 text-violet-500" />
									{:else if pg.pageType === 'spa_state'}
										<Fingerprint class="h-3.5 w-3.5 shrink-0 text-amber-500" />
									{:else}
										<FileText class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
									{/if}
									<span class="flex-1 truncate {selectedPage?.id === pg.id ? 'font-medium text-primary' : 'text-foreground'}">{pg.title}</span>
									<span class="text-[10px] text-muted-foreground tabular-nums">{formatFileSize(pg.fileSize)}</span>
								</button>
							{/each}
						{/if}
					{/if}
				</div>
			{:else if treeTab === 'map'}
				<!-- Map view selector -->
				<div class="flex items-center gap-1 border-b border-border px-3 py-2">
					<button
						class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors {mapView === 'navigation' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
						onclick={() => { mapView = 'navigation'; }}
					>
						<Network class="h-3 w-3" />
						Navigation
					</button>
					<button
						class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors {mapView === 'hierarchy' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
						onclick={() => { mapView = 'hierarchy'; }}
					>
						<GitFork class="h-3 w-3" />
						Hiérarchie
					</button>
					<button
						class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors {mapView === 'star' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
						onclick={() => { mapView = 'star'; starCenterPageId = selectedPage?.id || null; }}
					>
						<Circle class="h-3 w-3" />
						Étoile
					</button>
				</div>

				<!-- Graph area -->
				<div class="relative flex-1 overflow-hidden">
					{#if mapLoading}
						<div class="flex h-full items-center justify-center">
							<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></div>
						</div>
					{:else if graphNodes().length === 0}
						<div class="flex flex-col items-center justify-center py-12 text-center">
							<Globe class="h-8 w-8 text-muted" />
							<p class="mt-3 text-sm text-muted-foreground">Aucune page capturée</p>
							<p class="mt-1 text-xs text-muted">Les pages apparaîtront ici après capture.</p>
						</div>
					{:else}
						<!-- Zoom controls -->
						<div class="absolute right-3 top-3 z-10 flex flex-col gap-1">
							<button class="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card shadow-sm hover:bg-accent" onclick={mapZoomIn}>
								<ZoomIn class="h-3.5 w-3.5" />
							</button>
							<button class="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card shadow-sm hover:bg-accent" onclick={mapZoomOut}>
								<ZoomOut class="h-3.5 w-3.5" />
							</button>
							<button class="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card shadow-sm hover:bg-accent" onclick={mapResetView}>
								<RotateCcw class="h-3.5 w-3.5" />
							</button>
						</div>

						<!-- SVG graph -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<svg
							class="h-full w-full cursor-grab active:cursor-grabbing"
							viewBox={svgViewBox()}
							onmousedown={mapStartPan}
							onmousemove={mapOnPan}
							onmouseup={mapEndPan}
							onmouseleave={mapEndPan}
							onwheel={mapOnWheel}
						>
							<defs>
								<marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
									<polygon points="0 0, 8 3, 0 6" fill="#D1D5DB" />
								</marker>
								{#each ['click', 'pushState', 'replaceState', 'popstate', 'hashchange', 'manual'] as tt}
									<marker id="arrow-{tt}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
										<polygon points="0 0, 8 3, 0 6" fill={getTriggerColor(tt)} />
									</marker>
								{/each}
							</defs>

							<!-- Edges -->
							{#if mapView === 'hierarchy' && tree}
								<!-- Hierarchy edges: parent→child based on URL tree -->
								{#each graphNodes() as node}
									{@const parent = graphNodes().find(n => {
										const parts = node.page.urlPath.split('/').filter(Boolean);
										if (parts.length <= 1) return false;
										const parentPath = parts.slice(0, -1).join('/');
										return n.page.urlPath === parentPath;
									})}
									{#if parent}
										<line
											x1={parent.x} y1={parent.y + 20}
											x2={node.x} y2={node.y - 20}
											stroke="#E5E7EB" stroke-width="1.5"
											marker-end="url(#arrowhead)"
										/>
									{/if}
								{/each}
							{:else if mapView === 'star'}
								<!-- Star edges: center to connected -->
								{@const center = graphNodesById().get(starCenterPageId || selectedPage?.id || '')}
								{#if center}
									{#each allTransitions as t}
										{#if t.sourcePageId === center.page.id || t.targetPageId === center.page.id}
											{@const other = graphNodesById().get(t.sourcePageId === center.page.id ? t.targetPageId : t.sourcePageId)}
											{#if other}
												<path
													d={computeEdgePath(center.x, center.y, other.x, other.y)}
													stroke={getTriggerColor(t.triggerType)}
													stroke-width="1.5"
													fill="none"
													marker-end="url(#arrow-{t.triggerType})"
													opacity="0.6"
												/>
											{/if}
										{/if}
									{/each}
								{/if}
							{:else}
								<!-- Navigation edges: transitions -->
								{#each allTransitions as t}
									{@const source = graphNodesById().get(t.sourcePageId)}
									{@const target = graphNodesById().get(t.targetPageId)}
									{#if source && target}
										<path
											d={computeEdgePath(source.x, source.y, target.x, target.y)}
											stroke={getTriggerColor(t.triggerType)}
											stroke-width="1.5"
											fill="none"
											marker-end="url(#arrow-{t.triggerType})"
											opacity="0.6"
										/>
									{/if}
								{/each}
							{/if}

							<!-- Nodes -->
							{#each graphNodes() as node}
								{@const isSelected = selectedPage?.id === node.page.id}
								{@const isStarCenter = mapView === 'star' && node.page.id === (starCenterPageId || selectedPage?.id)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
								<g
									transform="translate({node.x - 70}, {node.y - 20})"
									class="cursor-pointer"
									onclick={() => selectPage(node.page)}
									ondblclick={() => { if (mapView === 'star') { starCenterPageId = node.page.id; } }}
								>
									<rect
										width="140" height="40" rx="6"
										fill="white"
										stroke={isSelected ? '#3B82F6' : isStarCenter ? '#8B5CF6' : '#E5E7EB'}
										stroke-width={isSelected || isStarCenter ? 2 : 1}
									/>
									{#if node.page.thumbnailPath}
										<image
											href="/api/pages/{node.page.id}/screenshot"
											x="4" y="4" width="28" height="32"
											preserveAspectRatio="xMidYMin slice"
											clip-path="inset(0 round 3px)"
										/>
										<text
											x="36" y="16"
											font-size="10" fill="#111827"
											dominant-baseline="middle"
										>
											{node.page.title.length > 11 ? node.page.title.slice(0, 11) + '…' : node.page.title}
										</text>
									{:else}
										<text
											x="8" y="16"
											font-size="10" fill="#111827"
											dominant-baseline="middle"
										>
											{node.page.title.length > 16 ? node.page.title.slice(0, 16) + '…' : node.page.title}
										</text>
									{/if}
									<text
										x={node.page.thumbnailPath ? 36 : 8} y="30"
										font-size="8" fill="#9CA3AF"
										dominant-baseline="middle"
									>
										/{node.page.urlPath.length > 16 ? '…' + node.page.urlPath.slice(-14) : node.page.urlPath}
									</text>
									<circle
										cx="130" cy="20" r="4"
										fill={getHealthFill(node.page.healthStatus)}
									/>
									{#if node.page.pageType === 'modal'}
										<rect x="90" y="2" width="32" height="12" rx="3" fill="#EDE9FE" />
										<text x="106" y="10" font-size="7" fill="#7C3AED" text-anchor="middle" dominant-baseline="middle">modal</text>
									{/if}
								</g>
							{/each}
						</svg>

						<!-- Legend -->
						{#if mapView === 'navigation' && allTransitions.length > 0}
							<div class="absolute bottom-3 left-3 flex items-center gap-3 rounded-md border border-border bg-card/90 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm">
								<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-3 rounded" style="background: #9CA3AF"></span> clic</span>
								<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-3 rounded" style="background: #3B82F6"></span> pushState</span>
								<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-3 rounded" style="background: #8B5CF6"></span> replaceState</span>
								<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-3 rounded" style="background: #F59E0B"></span> retour</span>
							</div>
						{/if}
						{#if mapView === 'star'}
							<div class="absolute bottom-3 left-3 rounded-md border border-border bg-card/90 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm">
								Double-clic sur un nœud pour le centrer
							</div>
						{/if}
					{/if}
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
							{#if node.page.thumbnailPath}
								<img
									src="/api/pages/{node.page.id}/screenshot"
									alt=""
									class="h-6 w-10 shrink-0 rounded-[3px] border border-border object-cover object-top"
									loading="lazy"
								/>
							{:else if node.page.pageType === 'spa_state'}
								<Fingerprint class="h-[15px] w-[15px] shrink-0 text-amber-500" />
							{:else}
								<FileText class="h-[15px] w-[15px] shrink-0 text-muted-foreground/50" />
							{/if}
							<span class="flex-1 truncate {selectedPage?.id === node.page.id ? 'font-medium text-primary' : 'text-muted-foreground'}">
								{node.page.title || node.name}
							</span>
							{#if node.page.captureMode === 'auto'}
								<span class="rounded bg-blue-50 px-1 py-0.5 text-[9px] font-medium text-blue-600">auto</span>
							{:else if node.page.captureMode === 'guided'}
								<span class="rounded bg-teal-50 px-1 py-0.5 text-[9px] font-medium text-teal-600">guidé</span>
							{/if}
							<span class="h-[7px] w-[7px] shrink-0 rounded-full {getHealthDot(node.page.healthStatus)}"></span>
						</button>
						{#if node.children.length > 0}
							{#each node.children as child}
								{@render treeNodeSnippet(child, depth + 1, color, bgColor)}
							{/each}
						{/if}
						{#if node.modals?.length}
							{#each node.modals as modal}
								<button
									class="group flex w-full items-center gap-2 py-[5px] text-left text-[13px] transition-colors hover:bg-accent/50 {selectedPage?.id === modal.id ? 'bg-primary/10' : ''}"
									style="padding-left: {(depth + 1) * 16 + 12}px; padding-right: 12px"
									onclick={() => selectPage(modal)}
								>
									<Layers class="h-[15px] w-[15px] shrink-0 text-violet-500" />
									<span class="flex-1 truncate italic {selectedPage?.id === modal.id ? 'font-medium text-primary' : 'text-muted-foreground'}">
										{modal.title || 'Modale'}
									</span>
									<span class="rounded bg-violet-100 px-1 py-0.5 text-[9px] font-medium text-violet-600">modale</span>
								</button>
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
				<div class="flex-1 overflow-y-auto p-5 space-y-6">
					{#if transitionsLoading}
						<div class="space-y-2">
							{#each Array(3) as _}
								<div class="skeleton h-12 w-full rounded-lg"></div>
							{/each}
						</div>
					{:else if pageTransitionsData}
						<!-- Transitions sortantes -->
						<div class="space-y-3">
							<h3 class="text-sm font-semibold text-foreground flex items-center gap-2">
								<ArrowRight class="h-4 w-4 text-muted-foreground" />
								Transitions sortantes
								<span class="text-xs font-normal text-muted-foreground">({pageTransitionsData.outgoing.length})</span>
							</h3>
							{#if pageTransitionsData.outgoing.length === 0}
								<p class="text-xs text-muted-foreground pl-6">Aucune transition sortante enregistrée.</p>
							{:else}
								<div class="space-y-1.5">
									{#each pageTransitionsData.outgoing as t}
										{@const targetPage = pagesById().get(t.targetPageId)}
										<button
											class="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/50"
											onclick={() => { if (targetPage) selectPage(targetPage); }}
										>
											<ArrowRight class="h-4 w-4 shrink-0 text-primary" />
											<div class="flex-1 min-w-0">
												<span class="text-sm font-medium text-foreground truncate block">
													{targetPage?.title || t.targetPageId}
												</span>
												<span class="text-[11px] text-muted-foreground">
													{getTriggerTypeLabel(t.triggerType)}{t.triggerText ? ` — "${t.triggerText}"` : ''}
												</span>
											</div>
											{#if t.loadingTimeMs !== null}
												<span class="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
													<Clock class="h-3 w-3" />
													{formatLoadingTime(t.loadingTimeMs)}
												</span>
											{/if}
											{#if t.hadLoadingIndicator}
												<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">loader</span>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Transitions entrantes -->
						<div class="space-y-3">
							<h3 class="text-sm font-semibold text-foreground flex items-center gap-2">
								<ArrowLeft class="h-4 w-4 text-muted-foreground" />
								Transitions entrantes
								<span class="text-xs font-normal text-muted-foreground">({pageTransitionsData.incoming.length})</span>
							</h3>
							{#if pageTransitionsData.incoming.length === 0}
								<p class="text-xs text-muted-foreground pl-6">Aucune transition entrante enregistrée.</p>
							{:else}
								<div class="space-y-1.5">
									{#each pageTransitionsData.incoming as t}
										{@const sourcePage = pagesById().get(t.sourcePageId)}
										<button
											class="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/50"
											onclick={() => { if (sourcePage) selectPage(sourcePage); }}
										>
											<ArrowLeft class="h-4 w-4 shrink-0 text-muted-foreground" />
											<div class="flex-1 min-w-0">
												<span class="text-sm font-medium text-foreground truncate block">
													{sourcePage?.title || t.sourcePageId}
												</span>
												<span class="text-[11px] text-muted-foreground">
													{getTriggerTypeLabel(t.triggerType)}{t.triggerText ? ` — "${t.triggerText}"` : ''}
												</span>
											</div>
											{#if t.loadingTimeMs !== null}
												<span class="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
													<Clock class="h-3 w-3" />
													{formatLoadingTime(t.loadingTimeMs)}
												</span>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Modales attachées -->
						{#if selectedPage}
							{@const pageModals = (() => {
								const modals: Page[] = [];
								function walk(node: TreeNode) {
									if (node.page?.id === selectedPage!.id && node.modals) {
										modals.push(...node.modals);
									}
									node.children.forEach(walk);
								}
								if (tree) walk(tree);
								return modals;
							})()}
							{#if pageModals.length > 0}
								<div class="space-y-3">
									<h3 class="text-sm font-semibold text-foreground flex items-center gap-2">
										<Layers class="h-4 w-4 text-violet-500" />
										Modales attachées
										<span class="text-xs font-normal text-muted-foreground">({pageModals.length})</span>
									</h3>
									<div class="space-y-1.5">
										{#each pageModals as modal}
											<button
												class="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/50"
												onclick={() => selectPage(modal)}
											>
												<Layers class="h-4 w-4 shrink-0 text-violet-500" />
												<span class="text-sm font-medium text-foreground">{modal.title || 'Modale'}</span>
												<span class="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">modale</span>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
					{:else}
						<div class="flex flex-col items-center justify-center py-12 text-center">
							<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
								<Link2 class="h-7 w-7 text-muted" />
							</div>
							<h3 class="text-[15px] font-semibold text-foreground/70">Liens & Navigation</h3>
							<p class="mt-1 max-w-xs text-xs text-muted-foreground">Les transitions de navigation seront affichées ici après capture.</p>
						</div>
					{/if}
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
								<div>
									<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Type de page</dt>
									<dd class="mt-0.5 flex items-center gap-1.5">
										{#if selectedPage.pageType === 'modal'}
											<Layers class="h-3.5 w-3.5 text-violet-500" />
											<span class="text-violet-600 font-medium">Modale</span>
										{:else if selectedPage.pageType === 'spa_state'}
											<Fingerprint class="h-3.5 w-3.5 text-amber-500" />
											<span class="text-amber-600 font-medium">État SPA</span>
										{:else}
											<FileText class="h-3.5 w-3.5 text-muted-foreground" />
											<span>Page</span>
										{/if}
									</dd>
								</div>
								{#if selectedPage.captureTimingMs}
									<div>
										<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Temps de chargement</dt>
										<dd class="mt-0.5 flex items-center gap-1.5 text-foreground">
											<Clock class="h-3.5 w-3.5 text-muted-foreground" />
											{formatLoadingTime(selectedPage.captureTimingMs)}
										</dd>
									</div>
								{/if}
								{#if selectedPage.syntheticUrl}
									<div class="col-span-2">
										<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">URL synthétique</dt>
										<dd class="mt-0.5 text-foreground font-mono text-xs break-all">/{selectedPage.syntheticUrl}</dd>
									</div>
								{/if}
								{#if selectedPage.domFingerprint}
									<div>
										<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fingerprint DOM</dt>
										<dd class="mt-0.5 text-foreground font-mono text-xs">{selectedPage.domFingerprint}</dd>
									</div>
								{/if}
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
