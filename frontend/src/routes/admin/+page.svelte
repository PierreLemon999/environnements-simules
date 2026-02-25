<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from '$lib/api';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Tabs, TabsList, TabsTrigger } from '$components/ui/tabs';
	import { goto } from '$app/navigation';
	import { Button } from '$components/ui/button';
	import {
		FolderKanban,
		FileText,
		TrendingUp,
		ArrowUpRight,
		Plus,
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
		assignmentId: string | null;
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
	let activityFilter = $state('all');

	let totalPages = $derived(projects.reduce((sum, p) => sum + p.pageCount, 0));
	let activeProjects = $derived(projects.length);

	// Session counts for tab badges
	let guideSessions = $derived(sessions.filter(s => s.eventCount > 3));
	let sessionCount = $derived(sessions.length);
	let guideCount = $derived(guideSessions.length);

	let filteredSessions = $derived(
		activityFilter === 'guides' ? guideSessions : sessions
	);

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

	function getProjectForSession(session: Session): Project | undefined {
		return projects.find(p => {
			// Match by version — we don't have the version->project mapping directly,
			// so we use the first project as fallback since sessions reference versions
			return true;
		});
	}

	function getToolNameForSession(session: Session): string {
		// Try to match based on available data
		if (projects.length > 0) {
			// Pick first project as placeholder — in real usage this comes from version->project relation
			return projects[0]?.toolName ?? '—';
		}
		return '—';
	}

	function getDemoNameForSession(session: Session): string {
		if (projects.length > 0) {
			return projects[0]?.name ?? '—';
		}
		return '—';
	}

	function getActionLabel(session: Session): { label: string; variant: 'default' | 'success' | 'secondary' } {
		if (session.eventCount > 3) return { label: 'Guide complété', variant: 'success' };
		if (session.eventCount > 0) return { label: 'Consulté', variant: 'default' };
		return { label: 'Visite', variant: 'secondary' };
	}

	function formatDuration(session: Session): string {
		if (!session.endedAt) return 'En cours';
		const start = new Date(session.startedAt).getTime();
		const end = new Date(session.endedAt).getTime();
		const seconds = Math.max(0, Math.floor((end - start) / 1000));
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		if (m < 1) return `${s}s`;
		return `${m}m ${s}s`;
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

	onMount(async () => {
		try {
			const [projectsRes, sessionsRes, overviewRes] = await Promise.all([
				get<{ data: Project[] }>('/projects'),
				get<{ data: Session[] }>('/analytics/sessions?limit=20'),
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
	<!-- Page header with action button -->
	<div class="flex items-center justify-between">
		<div></div>
		<Button size="sm" class="gap-1.5" onclick={() => goto('/admin/projects?action=create')}>
			<Plus class="h-3.5 w-3.5" />
			Nouveau projet
		</Button>
	</div>

	<!-- Stats row — compact cards matching mockup -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<CardContent class="p-3">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Projets actifs</p>
						<p class="mt-0.5 text-xl font-semibold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-6 w-10"></span>
							{:else}
								{activeProjects}
							{/if}
						</p>
					</div>
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
						<FolderKanban class="h-4 w-4 text-primary" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-3">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Pages capturées</p>
						<p class="mt-0.5 text-xl font-semibold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-6 w-10"></span>
							{:else}
								{totalPages}
							{/if}
						</p>
					</div>
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
						<FileText class="h-4 w-4 text-success" />
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Activity journal — proper table matching mockup -->
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
			<Tabs value={activityFilter} onValueChange={(v) => { activityFilter = v; }}>
				<TabsList class="mb-4">
					<TabsTrigger value="all">
						Toutes
						{#if !loading}
							<Badge variant="secondary" class="ml-1.5 text-[10px]">{sessionCount}</Badge>
						{/if}
					</TabsTrigger>
					<TabsTrigger value="sessions">
						Sessions
						{#if !loading}
							<Badge variant="secondary" class="ml-1.5 text-[10px]">{sessionCount}</Badge>
						{/if}
					</TabsTrigger>
					<TabsTrigger value="guides">
						Guides terminés
						{#if !loading}
							<Badge variant="secondary" class="ml-1.5 text-[10px]">{guideCount}</Badge>
						{/if}
					</TabsTrigger>
				</TabsList>
			</Tabs>

			{#if loading}
				<div class="space-y-3">
					{#each Array(5) as _}
						<div class="flex items-center gap-4 py-3">
							<div class="skeleton h-8 w-8 rounded-full"></div>
							<div class="flex-1 space-y-1.5">
								<div class="skeleton h-3 w-48"></div>
								<div class="skeleton h-2.5 w-24"></div>
							</div>
							<div class="skeleton h-3 w-16"></div>
							<div class="skeleton h-3 w-12"></div>
						</div>
					{/each}
				</div>
			{:else if filteredSessions.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">Aucune activité récente.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-border">
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Outil</th>
								<th class="hidden pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Démo</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
								<th class="hidden pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Pages consultées</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Temps passé</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredSessions as session}
								{@const action = getActionLabel(session)}
								<tr class="border-b border-border last:border-0 transition-colors hover:bg-accent">
									<td class="py-3 pr-4">
										<div class="flex items-center gap-3">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
												{session.user ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'}
											</div>
											<div class="min-w-0">
												<p class="truncate text-sm font-medium text-foreground">{session.user?.name ?? 'Anonyme'}</p>
												<p class="truncate text-xs text-muted-foreground">{session.user?.email ?? 'Visiteur'}</p>
											</div>
										</div>
									</td>
									<td class="py-3 pr-4">
										<Badge variant="secondary" class="text-[10px] font-normal">
											{getToolNameForSession(session)}
										</Badge>
									</td>
									<td class="hidden py-3 pr-4 md:table-cell">
										<span class="text-sm text-foreground">{getDemoNameForSession(session)}</span>
									</td>
									<td class="py-3 pr-4">
										<Badge variant={action.variant} class="text-[10px]">
											{action.label}
										</Badge>
									</td>
									<td class="hidden py-3 pr-4 lg:table-cell">
										<span class="text-sm text-foreground">{session.eventCount}</span>
									</td>
									<td class="py-3 pr-4">
										<span class="text-sm text-muted-foreground">{formatDuration(session)}</span>
									</td>
									<td class="py-3">
										<span class="text-xs text-muted-foreground">{formatDate(session.startedAt)}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
