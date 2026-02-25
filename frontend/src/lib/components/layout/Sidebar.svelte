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
		LogOut,
		ChevronsLeft,
		ChevronsRight,
	} from 'lucide-svelte';

	let { collapsed = $bindable(false) }: { collapsed?: boolean } = $props();

	let projects: Array<{ id: string; name: string; toolName: string; pageCount: number }> = $state([]);
	let sessionCount = $state(0);
	let updateRequestCount = $state(0);

	// Navigation items with optional badges
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
		{ href: '/admin/settings', label: 'Paramètres', icon: Settings, badgeKey: null },
	];

	// Badge values
	let badges = $derived<Record<string, { value: number; variant: 'default' | 'destructive' }>>({
		projects: { value: projects.length, variant: 'default' },
		sessions: { value: sessionCount, variant: 'default' },
		invitations: { value: 0, variant: 'default' },
		updateRequests: { value: updateRequestCount, variant: updateRequestCount > 0 ? 'destructive' : 'default' },
	});

	// Tool name to color mapping
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
		if (href === '/admin') {
			return currentPath === '/admin';
		}
		return currentPath.startsWith(href);
	}

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
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
		} catch {
			// Silently fail — sidebar still works without data
		}
	});
</script>

<aside
	class="fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border bg-sidebar transition-all duration-300"
	style="width: {collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}"
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
	<nav class="flex-1 overflow-y-auto px-2 py-3">
		<!-- PRINCIPAL section -->
		{#if !collapsed}
			<p class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Principal</p>
		{/if}
		<ul class="space-y-0.5">
			{#each principalItems as item}
				<li>
					<a
						href={item.href}
						class="group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors {isActive(item.href) ? 'border-l-[3px] border-l-primary bg-accent text-primary font-medium' : 'text-secondary hover:bg-accent hover:text-foreground'}"
						title={collapsed ? item.label : undefined}
					>
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
			<p class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Gestion</p>
		{/if}
		<ul class="space-y-0.5">
			{#each gestionItems as item}
				<li>
					<a
						href={item.href}
						class="group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors {isActive(item.href) ? 'border-l-[3px] border-l-primary bg-accent text-primary font-medium' : 'text-secondary hover:bg-accent hover:text-foreground'}"
						title={collapsed ? item.label : undefined}
					>
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

		<!-- OUTILS SIMULÉS section (dynamic from API) -->
		{#if projects.length > 0}
			<Separator class="my-3" />
			{#if !collapsed}
				<p class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Outils simulés</p>
			{/if}
			<ul class="space-y-0.5">
				{#each projects.slice(0, 8) as project}
					<li>
						<a
							href="/admin/projects/{project.id}"
							class="group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-secondary transition-colors hover:bg-accent hover:text-foreground"
							title={collapsed ? project.toolName : undefined}
						>
							<span
								class="h-2.5 w-2.5 shrink-0 rounded-full"
								style="background-color: {getToolColor(project.toolName)}"
							></span>
							{#if !collapsed}
								<span class="truncate flex-1">{project.toolName}</span>
								<span class="ml-auto text-[10px] text-muted-foreground">{project.pageCount}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>

	<!-- Collapse toggle -->
	<div class="border-t border-border px-2 py-2">
		<button
			class="flex w-full items-center justify-center rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground"
			onclick={() => (collapsed = !collapsed)}
			title={collapsed ? 'Développer' : 'Réduire'}
		>
			{#if collapsed}
				<ChevronsRight class="h-4 w-4" />
			{:else}
				<ChevronsLeft class="h-4 w-4" />
			{/if}
		</button>
	</div>

	<!-- User section -->
	<div class="border-t border-border px-3 py-3">
		{#if $user}
			<div class="flex items-center gap-3">
				<div class="relative">
					<Avatar class="h-8 w-8">
						<AvatarImage src={$user.avatarUrl} alt={$user.name} />
						<AvatarFallback>{getInitials($user.name)}</AvatarFallback>
					</Avatar>
					<!-- Online status dot -->
					<span class="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-sidebar bg-success">
					</span>
				</div>
				{#if !collapsed}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-foreground">{$user.name}</p>
						<p class="truncate text-xs text-muted">{$user.role === 'admin' ? 'Administrateur' : 'Client'}</p>
					</div>
					<button
						class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground"
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
