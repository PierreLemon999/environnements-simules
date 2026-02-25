<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from '$lib/api';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$components/ui/tabs';
	import {
		FolderKanban,
		FileText,
		TrendingUp,
		Activity,
		Clock,
		ArrowUpRight,
	} from 'lucide-svelte';

	interface Project {
		id: string;
		name: string;
		toolName: string;
		subdomain: string;
		description: string | null;
		createdAt: string;
		updatedAt: string;
		versionCount: number;
		pageCount: number;
	}

	interface Session {
		id: string;
		userId: string | null;
		versionId: string;
		startedAt: string;
		endedAt: string | null;
		eventCount: number;
		user: { id: string; name: string; email: string } | null;
	}

	interface Overview {
		totalSessions: number;
		totalPageViews: number;
		totalGuideStarts: number;
		totalGuideCompletions: number;
		averageSessionDurationSeconds: number;
		last7Days: { sessions: number; uniqueUsers: number };
	}

	let projects: Project[] = $state([]);
	let sessions: Session[] = $state([]);
	let overview: Overview | null = $state(null);
	let loading = $state(true);
	let projectFilter = $state('all');

	let filteredProjects = $derived(
		projectFilter === 'all'
			? projects
			: projects // no status field yet, show all for now
	);

	let totalPages = $derived(projects.reduce((sum, p) => sum + p.pageCount, 0));
	let activeProjects = $derived(projects.length);

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

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

	function formatRelativeTime(dateStr: string): string {
		const now = new Date();
		const date = new Date(dateStr);
		const diffMs = now.getTime() - date.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMin / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMin < 1) return "À l'instant";
		if (diffMin < 60) return `Il y a ${diffMin} min`;
		if (diffHours < 24) return `Il y a ${diffHours}h`;
		if (diffDays === 1) return 'Hier';
		if (diffDays < 7) return `Il y a ${diffDays} jours`;
		return formatDate(dateStr);
	}

	onMount(async () => {
		try {
			const [projectsRes, sessionsRes, overviewRes] = await Promise.all([
				get<{ data: Project[] }>('/projects'),
				get<{ data: Session[] }>('/analytics/sessions?limit=10'),
				get<{ data: Overview }>('/analytics/overview'),
			]);
			projects = projectsRes.data;
			sessions = sessionsRes.data;
			overview = overviewRes.data;
		} catch (err) {
			console.error('Dashboard fetch error:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Dashboard — Environnements Simulés</title>
</svelte:head>

<div class="space-y-6">
	<!-- Stats row -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projets actifs</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{activeProjects}
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<FolderKanban class="h-5 w-5 text-primary" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pages capturées</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{totalPages}
							{/if}
						</p>
						{#if !loading}
							<span class="inline-flex items-center gap-1 text-xs font-medium text-success">
								<TrendingUp class="h-3 w-3" />
								+12%
							</span>
						{/if}
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
						<FileText class="h-5 w-5 text-success" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sessions (7j)</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{overview?.last7Days.sessions ?? 0}
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple/10">
						<Activity class="h-5 w-5 text-purple" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Durée moyenne</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{#if overview}
									{Math.floor(overview.averageSessionDurationSeconds / 60)}m {overview.averageSessionDurationSeconds % 60}s
								{:else}
									—
								{/if}
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
						<Clock class="h-5 w-5 text-warning" />
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Projects section -->
	<Card>
		<CardHeader class="pb-3">
			<div class="flex items-center justify-between">
				<CardTitle class="text-base">Projets</CardTitle>
				<a href="/admin/projects" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
					Voir tout <ArrowUpRight class="h-3 w-3" />
				</a>
			</div>
		</CardHeader>
		<CardContent>
			<!-- Tab filters -->
			<Tabs value="all" onValueChange={(v) => { projectFilter = v; }}>
				<TabsList class="mb-4">
					<TabsTrigger value="all">Tous</TabsTrigger>
					<TabsTrigger value="active">Actifs</TabsTrigger>
					<TabsTrigger value="test">Test</TabsTrigger>
					<TabsTrigger value="archived">Archivés</TabsTrigger>
				</TabsList>
			</Tabs>

			{#if loading}
				<div class="space-y-3">
					{#each Array(3) as _}
						<div class="flex items-center gap-4 rounded-lg border border-border p-4">
							<div class="skeleton h-10 w-10 rounded-lg"></div>
							<div class="flex-1 space-y-2">
								<div class="skeleton h-4 w-40"></div>
								<div class="skeleton h-3 w-24"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if filteredProjects.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">Aucun projet trouvé.</p>
			{:else}
				<div class="space-y-2">
					{#each filteredProjects as project}
						<a
							href="/admin/projects/{project.id}"
							class="group flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
								style="background-color: {getToolColor(project.toolName)}"
							>
								{project.toolName.slice(0, 2).toUpperCase()}
							</div>
							<div class="min-w-0 flex-1">
								<p class="font-medium text-foreground group-hover:text-primary">{project.name}</p>
								<p class="text-xs text-muted-foreground">{project.toolName}</p>
							</div>
							<div class="flex items-center gap-4 text-xs text-muted-foreground">
								<span>{project.versionCount} version{project.versionCount !== 1 ? 's' : ''}</span>
								<span>{project.pageCount} page{project.pageCount !== 1 ? 's' : ''}</span>
								<span class="hidden sm:inline">{formatDate(project.updatedAt)}</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Activity journal -->
	<Card>
		<CardHeader class="pb-3">
			<div class="flex items-center justify-between">
				<CardTitle class="text-base">Journal d'activité des clients</CardTitle>
				<a href="/admin/analytics" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
					Voir tout <ArrowUpRight class="h-3 w-3" />
				</a>
			</div>
		</CardHeader>
		<CardContent>
			<Tabs value="all">
				<TabsList class="mb-4">
					<TabsTrigger value="all">Toutes</TabsTrigger>
					<TabsTrigger value="sessions">Sessions</TabsTrigger>
					<TabsTrigger value="guides">Guides terminés</TabsTrigger>
				</TabsList>
			</Tabs>

			{#if loading}
				<div class="space-y-3">
					{#each Array(3) as _}
						<div class="flex items-center gap-3 py-2">
							<div class="skeleton h-8 w-8 rounded-full"></div>
							<div class="flex-1 space-y-1.5">
								<div class="skeleton h-3 w-48"></div>
								<div class="skeleton h-2.5 w-24"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if sessions.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">Aucune activité récente.</p>
			{:else}
				<div class="space-y-1">
					{#each sessions as session}
						<div class="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent">
							<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
								{session.user ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'}
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm text-foreground">
									<span class="font-medium">{session.user?.name ?? 'Anonyme'}</span>
									<span class="text-muted-foreground"> — {session.eventCount} événement{session.eventCount !== 1 ? 's' : ''}</span>
								</p>
								<p class="text-xs text-muted-foreground">{session.user?.email ?? 'Visiteur anonyme'}</p>
							</div>
							<div class="text-right">
								<p class="text-xs text-muted-foreground">{formatRelativeTime(session.startedAt)}</p>
								{#if !session.endedAt}
									<Badge variant="success" class="text-[10px]">En cours</Badge>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
