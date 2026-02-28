<script lang="ts">
	import { page } from '$app/stores';
	import { user, logout } from '$lib/stores/auth';
	import { projects as projectsStore, selectedProjectId as selectedProjectIdStore, selectProject } from '$lib/stores/project';
	import { get } from '$lib/api';
	import { onMount } from 'svelte';
	import { Avatar, AvatarFallback, AvatarImage } from '$components/ui/avatar';
	import AvatarEditor from '$components/ui/avatar-editor/AvatarEditor.svelte';
	import { Badge } from '$components/ui/badge';
	import { Separator } from '$components/ui/separator';
	import {
		LayoutDashboard,
		FolderKanban,
		GitBranch,
		BarChart3,
		Send,
		Users,
		EyeOff,
		RefreshCw,
		Settings,
		Blocks,
		PenSquare,
		LogOut,
		Search,
		ChevronsLeft,
		Gauge,
		FlaskConical,
		ChevronDown,
	} from 'lucide-svelte';

	let { collapsed = $bindable(false), onToggle }: { collapsed?: boolean; onToggle?: () => void } = $props();

	import { onDestroy } from 'svelte';

	let avatarEditorOpen = $state(false);

	let sessionCount = $state(0);
	let updateRequestCount = $state(0);
	let invitationCount = $state(0);
	let hovered = $state(false);
	let projectSearch = $state('');

	// Scroll hint for project list
	let projectListEl: HTMLUListElement | undefined = $state();
	let projectListEndEl: HTMLDivElement | undefined = $state();
	let showProjectsScrollHint = $state(false);
	let scrollObserver: IntersectionObserver | undefined;

	let filteredProjects = $derived(
		$projectsStore.filter(p => {
			if (!projectSearch.trim()) return true;
			const q = projectSearch.toLowerCase();
			return p.toolName.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
		})
	);

	const labItems = [
		{ href: '/admin/tree', label: 'Arborescence', icon: GitBranch, badgeKey: null },
		{ href: '/admin/editor', label: 'Éditeur', icon: PenSquare, badgeKey: null },
		{ href: '/admin/obfuscation', label: 'Obfuscation', icon: EyeOff, badgeKey: null },
		{ href: '/admin/update-requests', label: 'Demandes MAJ', icon: RefreshCw, badgeKey: 'updateRequests' },
		{ href: '/admin/components', label: 'Composants', icon: Blocks, badgeKey: null },
	];

	const gestionItems = [
		{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard, badgeKey: null },
		{ href: '/admin/projects', label: 'Projets', icon: FolderKanban, badgeKey: 'projects' },
		{ href: '/admin/analytics', label: 'Statistiques', icon: BarChart3, badgeKey: 'sessions' },
		{ href: '/admin/invitations', label: 'Invitations', icon: Send, badgeKey: 'invitations' },
		{ href: '/admin/users', label: 'Utilisateurs', icon: Users, badgeKey: null },
		{ href: '/admin/settings', label: 'Paramètres admin', icon: Settings, badgeKey: null },
	];

	let badges = $derived<Record<string, { value: number; variant: 'default' | 'destructive' }>>({
		projects: { value: $projectsStore.length, variant: 'default' },
		sessions: { value: sessionCount, variant: 'default' },
		invitations: { value: invitationCount, variant: 'default' },
		updateRequests: { value: updateRequestCount, variant: updateRequestCount > 0 ? 'destructive' : 'default' },
	});

	function getToolColor(toolName: string): string {
		const colors: Record<string, string> = {
			'Salesforce': '#00A1E0',
			'SAP SuccessFactors': '#0070F2',
			'Workday': '#F5A623',
			'ServiceNow': '#81B5A1',
			'HubSpot': '#FF7A59',
			'Zendesk': '#03363D',
			'Oracle': '#C74634',
		};
		return colors[toolName] ?? '#6D7481';
	}

	function isActive(href: string): boolean {
		const currentPath = $page.url.pathname;
		if (href === '/admin') return currentPath === '/admin';
		return currentPath.startsWith(href);
	}

	function getInitials(name: string): string {
		return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
	}

	// Watch project list end sentinel for scroll hint
	$effect(() => {
		if (!projectListEndEl || !projectListEl) { showProjectsScrollHint = false; return; }
		scrollObserver?.disconnect();
		scrollObserver = new IntersectionObserver(
			([entry]) => { showProjectsScrollHint = !entry.isIntersecting; },
			{ root: projectListEl, threshold: 0.1 }
		);
		scrollObserver.observe(projectListEndEl);
		return () => scrollObserver?.disconnect();
	});

	onMount(async () => {
		try {
			const [overviewRes, updateRequestsRes] = await Promise.all([
				get<{ data: { last7Days: { sessions: number } } }>('/analytics/overview'),
				get<{ data: Array<{ status: string }> }>('/update-requests').catch(() => ({ data: [] })),
			]);
			sessionCount = overviewRes.data.last7Days.sessions;
			updateRequestCount = updateRequestsRes.data.filter(r => r.status === 'pending').length;
		} catch {
			// Silently fail
		}
	});

	onDestroy(() => { scrollObserver?.disconnect(); });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<aside
	class="fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border bg-sidebar transition-all duration-300"
	style="width: {collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}"
	onmouseenter={() => { hovered = true; }}
	onmouseleave={() => { hovered = false; }}
>
	<!-- Branding -->
	<div class="flex h-14 items-center gap-2 border-b border-border {collapsed ? 'justify-center px-1' : 'px-3'}">
		<img src="/logo-icon.png" alt="Lemon Lab" class="{collapsed ? 'h-8 w-8' : 'h-9 w-9'} shrink-0" />
		{#if !collapsed}
			<span class="text-[17px] tracking-[-0.01em] text-foreground">
				<span class="font-bold">lemon</span><span class="font-normal">lab</span>
			</span>
		{/if}
	</div>

	<!-- Navigation (fixed sections) -->
	<nav class="shrink-0 overflow-x-hidden px-2 py-3">
		<!-- GESTION section -->
		<div class="mb-1 flex items-center gap-2 px-2">
			<Gauge class="h-3.5 w-3.5 text-yellow-dark" />
			{#if !collapsed}
				<p class="text-[11px] font-semibold uppercase tracking-[0.6px] text-muted">Gestion</p>
			{/if}
		</div>
		<ul class="space-y-0.5">
			{#each gestionItems as item}
				<li>
					<a
						href={item.href}
						class="nav-item group relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] transition-all duration-200 {isActive(item.href) ? 'text-primary font-medium' : 'text-secondary hover:bg-accent hover:text-foreground'}"
						style={isActive(item.href) ? 'background: linear-gradient(90deg, var(--color-yellow-bg) 0%, var(--color-yellow-bg) 30%, transparent 100%)' : ''}
						title={collapsed ? item.label : undefined}
					>
						{#if isActive(item.href)}
							<span class="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-sm" style="background: #FAE100"></span>
						{/if}
						<item.icon class="h-4 w-4 shrink-0 {isActive(item.href) ? 'text-primary' : 'text-muted'}" />
						{#if !collapsed}
							<span class="truncate flex-1">{item.label}</span>
							{#if item.badgeKey && badges[item.badgeKey] && badges[item.badgeKey].value > 0}
								<Badge
									variant={badges[item.badgeKey].variant}
									class="ml-auto h-5 min-w-[20px] justify-center px-1.5 text-[10px]"
								>
									{badges[item.badgeKey].value}
								</Badge>
							{/if}
						{/if}
					</a>
				</li>
			{/each}
		</ul>

		<Separator class="my-3" />

		<!-- LAB section -->
		<div class="mb-1 flex items-center gap-2 px-2">
			<FlaskConical class="h-3.5 w-3.5 text-yellow-dark" />
			{#if !collapsed}
				<p class="text-[11px] font-semibold uppercase tracking-[0.6px] text-muted">Lab</p>
			{/if}
		</div>
		<ul class="space-y-0.5">
			{#each labItems as item}
				<li>
					<a
						href={item.href}
						class="nav-item group relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] transition-all duration-200 {isActive(item.href) ? 'text-primary font-medium' : 'text-secondary hover:bg-accent hover:text-foreground'}"
						style={isActive(item.href) ? 'background: linear-gradient(90deg, var(--color-yellow-bg) 0%, var(--color-yellow-bg) 30%, transparent 100%)' : ''}
						title={collapsed ? item.label : undefined}
					>
						{#if isActive(item.href)}
							<span class="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-sm" style="background: #FAE100"></span>
						{/if}
						<item.icon class="h-4 w-4 shrink-0 {isActive(item.href) ? 'text-primary' : 'text-muted'}" />
						{#if !collapsed}
							<span class="truncate flex-1">{item.label}</span>
							{#if item.badgeKey && badges[item.badgeKey] && badges[item.badgeKey].value > 0}
								<Badge
									variant={badges[item.badgeKey].variant}
									class="ml-auto h-5 min-w-[20px] justify-center px-1.5 text-[10px]"
								>
									{badges[item.badgeKey].value}
								</Badge>
							{/if}
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<!-- MES PROJETS section (scrollable) -->
	{#if $projectsStore.length > 0}
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border px-2 pt-3">
			{#if !collapsed}
				<p class="mb-1 shrink-0 px-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted">Mes projets</p>
				<div class="relative mb-1 shrink-0 px-1">
					<Search class="pointer-events-none absolute left-3.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
					<input
						bind:value={projectSearch}
						placeholder="Rechercher..."
						class="h-6 w-full rounded border border-transparent bg-transparent pl-6 pr-2 text-[11px] placeholder:text-muted outline-none focus:border-border focus:bg-accent/50"
					/>
				</div>
			{/if}
			<div class="relative min-h-0 flex-1">
			<ul bind:this={projectListEl} class="h-full space-y-0.5 overflow-x-hidden pb-2 sidebar-scroll">
				{#each filteredProjects as project}
					<li>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<a
							href="/admin/projects/{project.id}"
							onclick={() => selectProject(project.id)}
							class="nav-item group relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] transition-colors {$selectedProjectIdStore === project.id ? 'text-primary font-medium' : isActive(`/admin/projects/${project.id}`) ? 'bg-accent text-primary font-medium' : 'text-secondary hover:bg-accent hover:text-foreground'}"
							style={$selectedProjectIdStore === project.id ? 'background: linear-gradient(90deg, var(--color-yellow-bg) 0%, var(--color-yellow-bg) 30%, transparent 100%)' : ''}
							title={collapsed ? project.toolName : undefined}
						>
						{#if $selectedProjectIdStore === project.id}
							<span class="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-sm" style="background: #FAE100"></span>
						{/if}
							<span
								class="h-2.5 w-2.5 shrink-0 rounded-full"
								style="background-color: {project.iconColor || getToolColor(project.toolName)}"
							></span>
							{#if !collapsed}
								<span class="truncate flex-1">{project.toolName}</span>
								<span class="ml-auto mr-1 font-mono text-[11px] text-muted-foreground">{project.pageCount}</span>
							{/if}
						</a>
					</li>
				{/each}
				<li bind:this={projectListEndEl} class="h-px shrink-0" aria-hidden="true"></li>
			</ul>
			{#if showProjectsScrollHint && !collapsed}
				<div class="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
					<div class="h-8 w-full bg-gradient-to-t from-sidebar to-transparent"></div>
					<div class="absolute bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 border border-border/50 shadow-xs">
						<ChevronDown class="h-3 w-3 text-muted" />
					</div>
				</div>
			{/if}
		</div>
		</div>
	{/if}

	<!-- Collapse toggle — floating circular button -->
	<button
		class="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-all hover:bg-accent hover:scale-110 {collapsed ? 'opacity-100' : hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
		onclick={(e) => { e.stopPropagation(); collapsed = !collapsed; onToggle?.(); }}
		title={collapsed ? 'Développer le menu' : 'Réduire le menu'}
	>
		<ChevronsLeft class="h-3 w-3 text-muted-foreground transition-transform {collapsed ? 'rotate-180' : ''}" />
	</button>

	<!-- User section -->
	<div class="border-t border-border px-3 py-3">
		{#if $user}
			<div class="flex items-center gap-3">
				<button
					class="relative cursor-pointer rounded-full transition-opacity hover:opacity-80"
					onclick={() => avatarEditorOpen = true}
					title="Modifier la photo de profil"
				>
					<Avatar class="h-8 w-8">
						<AvatarImage src={$user.avatarUrl} alt={$user.name} />
						<AvatarFallback>{getInitials($user.name)}</AvatarFallback>
					</Avatar>
					<span class="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-sidebar bg-success"></span>
				</button>
				{#if !collapsed}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-foreground">{$user.name}</p>
						<p class="truncate text-xs text-muted">{$user.role === 'admin' ? 'Administrateur·rice' : 'Client·e'}</p>
					</div>
					<button
						class="rounded-md p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-red-600"
						onclick={() => logout()}
						title="Se déconnecter"
					>
						<LogOut class="h-4 w-4" />
					</button>
				{/if}
			</div>
		{/if}
	</div>
</aside>

<AvatarEditor bind:open={avatarEditorOpen} />

<style>
	.sidebar-scroll {
		overflow-y: auto;
	}
	.sidebar-scroll::-webkit-scrollbar {
		width: 4px;
	}
	.sidebar-scroll::-webkit-scrollbar-track {
		background: transparent;
	}
	.sidebar-scroll::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 9999px;
	}
	.sidebar-scroll::-webkit-scrollbar-thumb:hover {
		background: var(--color-muted);
	}
	/* Firefox */
	.sidebar-scroll {
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
	}
</style>
