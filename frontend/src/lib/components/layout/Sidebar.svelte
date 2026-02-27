<script lang="ts">
	import { page } from '$app/stores';
	import { user, logout } from '$lib/stores/auth';
	import { get } from '$lib/api';
	import { onMount } from 'svelte';
	import { Avatar, AvatarFallback, AvatarImage } from '$components/ui/avatar';
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
		ChevronDown,
		ChevronsLeft,
	} from 'lucide-svelte';

	let { collapsed = $bindable(false), onToggle }: { collapsed?: boolean; onToggle?: () => void } = $props();

	let projects: Array<{ id: string; name: string; toolName: string; pageCount: number }> = $state([]);
	let sessionCount = $state(0);
	let updateRequestCount = $state(0);
	let invitationCount = $state(0);
	let hovered = $state(false);

	const principalItems = [
		{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard, badgeKey: null },
		{ href: '/admin/projects', label: 'Projets', icon: FolderKanban, badgeKey: 'projects' },
		{ href: '/admin/tree', label: 'Arborescence', icon: GitBranch, badgeKey: null },
		{ href: '/admin/analytics', label: 'Analytics', icon: BarChart3, badgeKey: 'sessions' },
		{ href: '/admin/invitations', label: 'Invitations', icon: Send, badgeKey: 'invitations' },
	];

	const gestionItems = [
		{ href: '/admin/users', label: 'Utilisateurs', icon: Users, badgeKey: null },
		{ href: '/admin/obfuscation', label: 'Obfuscation', icon: EyeOff, badgeKey: null },
		{ href: '/admin/update-requests', label: 'Demandes MAJ', icon: RefreshCw, badgeKey: 'updateRequests' },
		{ href: '/admin/components', label: 'Composants', icon: Blocks, badgeKey: null },
		{ href: '/admin/settings', label: 'Paramètres', icon: Settings, badgeKey: null },
	];

	let badges = $derived<Record<string, { value: number; variant: 'default' | 'destructive' }>>({
		projects: { value: projects.length, variant: 'default' },
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
		return colors[toolName] ?? '#6B7280';
	}

	function isActive(href: string): boolean {
		const currentPath = $page.url.pathname;
		if (href === '/admin') return currentPath === '/admin';
		return currentPath.startsWith(href);
	}

	function getInitials(name: string): string {
		return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
	}

	onMount(async () => {
		try {
			const [projectsRes, overviewRes, updateRequestsRes] = await Promise.all([
				get<{ data: Array<{ id: string; name: string; toolName: string; pageCount: number }> }>('/projects'),
				get<{ data: { last7Days: { sessions: number } } }>('/analytics/overview'),
				get<{ data: Array<{ status: string }> }>('/update-requests').catch(() => ({ data: [] })),
			]);
			projects = projectsRes.data;
			sessionCount = overviewRes.data.last7Days.sessions;
			updateRequestCount = updateRequestsRes.data.filter(r => r.status === 'pending').length;

			let totalInvitations = 0;
			for (const p of projectsRes.data) {
				try {
					const detail = await get<{ data: { versions: Array<{ id: string; status: string }> } }>(`/projects/${p.id}`);
					const activeVersion = detail.data.versions?.find(v => v.status === 'active');
					if (activeVersion) {
						const assignments = await get<{ data: Array<{ id: string }> }>(`/versions/${activeVersion.id}/assignments`);
						totalInvitations += assignments.data.length;
					}
				} catch {
					// Skip
				}
			}
			invitationCount = totalInvitations;
		} catch {
			// Silently fail
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<aside
	class="fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border bg-sidebar transition-all duration-300"
	style="width: {collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}"
	onmouseenter={() => { hovered = true; }}
	onmouseleave={() => { hovered = false; }}
>
	<!-- Branding -->
	<div class="flex h-14 items-center gap-3 border-b border-border px-3">
		<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
			ES
		</div>
		{#if !collapsed}
			<div class="min-w-0 flex-1">
				<span class="block truncate text-sm font-semibold text-foreground">Env. Simulés</span>
				<span class="block truncate text-[10px] text-muted-foreground">Lemon Learning</span>
			</div>
		{/if}
	</div>

	<!-- Navigation -->
	<nav class="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
		<!-- PRINCIPAL section -->
		{#if !collapsed}
			<p class="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted">Principal</p>
		{/if}
		<ul class="space-y-0.5">
			{#each principalItems as item}
				<li>
					<a
						href={item.href}
						class="nav-item group relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] transition-colors {isActive(item.href) ? 'bg-accent text-primary font-medium' : 'text-secondary hover:bg-accent hover:text-foreground'}"
						title={collapsed ? item.label : undefined}
					>
						{#if isActive(item.href)}
							<span class="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-sm bg-primary"></span>
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

		<!-- GESTION section -->
		{#if !collapsed}
			<p class="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted">Gestion</p>
		{/if}
		<ul class="space-y-0.5">
			{#each gestionItems as item}
				<li>
					<a
						href={item.href}
						class="nav-item group relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] transition-colors {isActive(item.href) ? 'bg-accent text-primary font-medium' : 'text-secondary hover:bg-accent hover:text-foreground'}"
						title={collapsed ? item.label : undefined}
					>
						{#if isActive(item.href)}
							<span class="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-sm bg-primary"></span>
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

		<!-- OUTILS SIMULÉS section -->
		{#if projects.length > 0}
			<Separator class="my-3" />
			{#if !collapsed}
				<p class="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted">Outils simulés</p>
			{/if}
			<ul class="space-y-0.5">
				{#each projects.slice(0, 8) as project}
					<li>
						<a
							href="/admin/projects/{project.id}"
							class="group flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] text-secondary transition-colors hover:bg-accent hover:text-foreground"
							title={collapsed ? project.toolName : undefined}
						>
							<span
								class="h-2.5 w-2.5 shrink-0 rounded-full"
								style="background-color: {getToolColor(project.toolName)}"
							></span>
							{#if !collapsed}
								<span class="truncate flex-1">{project.toolName}</span>
								<span class="ml-auto font-mono text-[11px] text-muted-foreground">{project.pageCount}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>

	<!-- Collapse toggle — floating circular button -->
	{#if (hovered && !collapsed) || collapsed}
		<button
			class="absolute -right-3 top-1/2 z-50 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-opacity hover:bg-accent"
			onclick={() => { collapsed = !collapsed; onToggle?.(); }}
			title={collapsed ? 'Développer' : 'Réduire'}
		>
			<ChevronsLeft class="h-3 w-3 text-muted-foreground {collapsed ? 'rotate-180' : ''}" />
		</button>
	{/if}

	<!-- User section -->
	<div class="border-t border-border px-3 py-3">
		{#if $user}
			<div class="flex items-center gap-3">
				<div class="relative">
					<Avatar class="h-8 w-8">
						<AvatarImage src={$user.avatarUrl} alt={$user.name} />
						<AvatarFallback>{getInitials($user.name)}</AvatarFallback>
					</Avatar>
					<span class="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-sidebar bg-success"></span>
				</div>
				{#if !collapsed}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-foreground">{$user.name}</p>
						<p class="truncate text-xs text-muted">{$user.role === 'admin' ? 'Administrateur·rice' : 'Client·e'}</p>
					</div>
					<button
						class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground"
						onclick={() => logout()}
						title="Options"
					>
						<ChevronDown class="h-4 w-4" />
					</button>
				{/if}
			</div>
		{/if}
	</div>
</aside>
