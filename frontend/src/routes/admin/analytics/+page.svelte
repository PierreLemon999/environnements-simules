<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from '$lib/api';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Tabs, TabsList, TabsTrigger } from '$components/ui/tabs';
	import { Separator } from '$components/ui/separator';
	import { Avatar, AvatarFallback } from '$components/ui/avatar';
	import {
		Activity,
		Users,
		Eye,
		TrendingUp,
		Download,
		Search,
		ChevronRight,
		Clock,
		MousePointerClick,
		FileText,
		X,
		Radio,
		Calendar,
		ArrowUpRight,
		ArrowDownRight,
		BarChart3,
		BookOpen,
	} from 'lucide-svelte';

	// Types
	interface Session {
		id: string;
		userId: string | null;
		assignmentId: string | null;
		versionId: string;
		ipAddress: string | null;
		userAgent: string | null;
		startedAt: string;
		endedAt: string | null;
		eventCount: number;
		user: { id: string; name: string; email: string } | null;
	}

	interface SessionDetail {
		id: string;
		userId: string | null;
		assignmentId: string | null;
		versionId: string;
		ipAddress: string | null;
		userAgent: string | null;
		startedAt: string;
		endedAt: string | null;
		user: { id: string; name: string; email: string } | null;
		events: SessionEvent[];
	}

	interface SessionEvent {
		id: string;
		sessionId: string;
		pageId: string | null;
		eventType: 'page_view' | 'guide_start' | 'guide_complete' | 'click';
		metadata: any;
		timestamp: string;
		durationSeconds: number | null;
		page: { id: string; title: string; urlPath: string } | null;
	}

	interface Overview {
		totalSessions: number;
		totalEvents: number;
		totalPageViews: number;
		totalGuideStarts: number;
		totalGuideCompletions: number;
		averageSessionDurationSeconds: number;
		last7Days: { sessions: number; uniqueUsers: number };
	}

	interface GuideStat {
		id: string;
		versionId: string;
		name: string;
		description: string | null;
		createdAt: string;
		playCount: number;
		completionCount: number;
		pageCount: number;
	}

	interface Project {
		id: string;
		name: string;
		toolName: string;
		subdomain: string;
	}

	// State
	let overview: Overview | null = $state(null);
	let sessions: Session[] = $state([]);
	let guides: GuideStat[] = $state([]);
	let projects: Project[] = $state([]);
	let loading = $state(true);
	let activeTab = $state('overview');
	let searchQuery = $state('');
	let selectedProjectId = $state('');

	// Session detail panel
	let selectedSession: SessionDetail | null = $state(null);
	let sessionDetailLoading = $state(false);
	let detailPanelOpen = $state(false);

	// Filtered sessions based on search
	let filteredSessions = $derived(
		sessions.filter((s) => {
			const q = searchQuery.toLowerCase();
			if (!q) return true;
			const name = s.user?.name?.toLowerCase() ?? '';
			const email = s.user?.email?.toLowerCase() ?? '';
			return name.includes(q) || email.includes(q);
		})
	);

	// Split sessions by role (admins vs clients)
	let adminSessions = $derived(
		sessions.filter((s) => s.user && !s.assignmentId)
	);
	let clientSessions = $derived(
		sessions.filter((s) => s.assignmentId || !s.user)
	);

	// Formatting helpers
	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

	function formatDateTime(dateStr: string): string {
		return new Date(dateStr).toLocaleString('fr-FR', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	function formatTime(dateStr: string): string {
		return new Date(dateStr).toLocaleTimeString('fr-FR', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
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

	function formatDuration(seconds: number): string {
		const abs = Math.max(0, Math.round(seconds));
		if (abs < 60) return `${abs}s`;
		const m = Math.floor(abs / 60);
		const s = abs % 60;
		if (m < 60) return `${m}m ${s}s`;
		const h = Math.floor(m / 60);
		return `${h}h ${m % 60}m`;
	}

	function getSessionDuration(session: Session | SessionDetail): string {
		if (!session.endedAt) return 'En cours';
		const start = new Date(session.startedAt).getTime();
		const end = new Date(session.endedAt).getTime();
		const seconds = Math.max(0, Math.floor((end - start) / 1000));
		return formatDuration(seconds);
	}

	function getSessionDurationSeconds(session: Session): number {
		if (!session.endedAt) return 0;
		const start = new Date(session.startedAt).getTime();
		const end = new Date(session.endedAt).getTime();
		return Math.max(0, Math.floor((end - start) / 1000));
	}

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	function getEngagementScore(session: SessionDetail): number {
		const events = session.events.length;
		const durationSec = session.endedAt
			? (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
			: 0;
		const guidesCompleted = session.events.filter((e) => e.eventType === 'guide_complete').length;
		// Simple engagement formula: events * 10 + duration/60 * 5 + guides * 20, capped at 100
		return Math.min(100, Math.round(events * 10 + (durationSec / 60) * 5 + guidesCompleted * 20));
	}

	function getEventIcon(eventType: string) {
		switch (eventType) {
			case 'page_view': return Eye;
			case 'guide_start': return BookOpen;
			case 'guide_complete': return BookOpen;
			case 'click': return MousePointerClick;
			default: return Activity;
		}
	}

	function getEventLabel(eventType: string): string {
		switch (eventType) {
			case 'page_view': return 'Page consultée';
			case 'guide_start': return 'Guide démarré';
			case 'guide_complete': return 'Guide terminé';
			case 'click': return 'Clic';
			default: return eventType;
		}
	}

	// Generate simple sparkline data points from sessions
	function getSparklineData(): number[] {
		const now = new Date();
		const days = 7;
		const counts = Array(days).fill(0);
		for (const s of sessions) {
			const d = new Date(s.startedAt);
			const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays >= 0 && diffDays < days) {
				counts[days - 1 - diffDays]++;
			}
		}
		return counts;
	}

	function sparklinePath(data: number[]): string {
		if (data.length === 0) return '';
		const max = Math.max(...data, 1);
		const w = 200;
		const h = 40;
		const step = w / (data.length - 1);
		const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`);
		return `M ${points.join(' L ')}`;
	}

	// Export sessions to CSV
	function exportCSV() {
		const headers = ['Utilisateur', 'Email', 'Début', 'Fin', 'Durée', 'Événements'];
		const rows = filteredSessions.map((s) => [
			s.user?.name ?? 'Anonyme',
			s.user?.email ?? '',
			s.startedAt,
			s.endedAt ?? '',
			getSessionDuration(s),
			String(s.eventCount),
		]);
		const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Load session detail
	async function openSessionDetail(session: Session) {
		detailPanelOpen = true;
		sessionDetailLoading = true;
		selectedSession = null;

		try {
			const res = await get<{ data: SessionDetail }>(`/analytics/sessions/${session.id}`);
			selectedSession = res.data;
		} catch (err) {
			console.error('Failed to load session detail:', err);
		} finally {
			sessionDetailLoading = false;
		}
	}

	function closeDetailPanel() {
		detailPanelOpen = false;
		selectedSession = null;
	}

	onMount(async () => {
		try {
			const [overviewRes, sessionsRes, guidesRes, projectsRes] = await Promise.all([
				get<{ data: Overview }>('/analytics/overview'),
				get<{ data: Session[] }>('/analytics/sessions?limit=200'),
				get<{ data: GuideStat[] }>('/analytics/guides'),
				get<{ data: Project[] }>('/projects'),
			]);
			overview = overviewRes.data;
			sessions = sessionsRes.data;
			guides = guidesRes.data;
			projects = projectsRes.data;
		} catch (err) {
			console.error('Analytics fetch error:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Analytics — Environnements Simulés</title>
</svelte:head>

<div class="flex gap-0">
	<!-- Main content -->
	<div class="min-w-0 flex-1 space-y-6 {detailPanelOpen ? 'pr-6' : ''}">
		<!-- Page header with inline tabs -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<h1 class="text-lg font-semibold text-foreground">Analytics</h1>
				<Tabs value={activeTab} onValueChange={(v) => { activeTab = v; }}>
					<TabsList>
						<TabsTrigger value="overview">
							Vue générale
							{#if !loading && overview}
								<Badge variant="secondary" class="ml-1.5 text-[10px]">{overview.totalSessions}</Badge>
							{/if}
						</TabsTrigger>
						<TabsTrigger value="clients">Par client</TabsTrigger>
						<TabsTrigger value="tools">Par outil</TabsTrigger>
						<TabsTrigger value="guides">Guides</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>
			<div class="flex items-center gap-3">
				<!-- Live indicator -->
				<div class="flex items-center gap-1.5 rounded-full border border-success-border bg-success-bg px-3 py-1">
					<span class="relative flex h-2 w-2">
						<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
					</span>
					<span class="text-xs font-medium text-success">En direct</span>
				</div>

				<!-- Date range picker -->
				<button class="flex h-9 items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm text-muted-foreground transition-colors hover:bg-accent">
					<Calendar class="h-3.5 w-3.5" />
					<span>01 fév — 24 fév 2026</span>
				</button>

				<!-- Project filter -->
				<select
					bind:value={selectedProjectId}
					class="flex h-9 rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<option value="">Tous les projets</option>
					{#each projects as project}
						<option value={project.id}>{project.toolName}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if activeTab === 'overview'}
			<!-- Stats cards -->
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Sessions totales</p>
								<p class="mt-1 text-2xl font-bold text-foreground">
									{#if loading}
										<span class="skeleton inline-block h-8 w-12"></span>
									{:else}
										{overview?.totalSessions ?? 0}
									{/if}
								</p>
								{#if !loading && overview}
									<span class="inline-flex items-center gap-1 text-xs font-medium text-success">
										<ArrowUpRight class="h-3 w-3" />
										{overview.last7Days.sessions} cette semaine
									</span>
								{/if}
							</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<Activity class="h-5 w-5 text-primary" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Pages vues</p>
								<p class="mt-1 text-2xl font-bold text-foreground">
									{#if loading}
										<span class="skeleton inline-block h-8 w-12"></span>
									{:else}
										{overview?.totalPageViews ?? 0}
									{/if}
								</p>
							</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
								<Eye class="h-5 w-5 text-success" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Utilisateurs uniques (7j)</p>
								<p class="mt-1 text-2xl font-bold text-foreground">
									{#if loading}
										<span class="skeleton inline-block h-8 w-12"></span>
									{:else}
										{overview?.last7Days.uniqueUsers ?? 0}
									{/if}
								</p>
							</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple/10">
								<Users class="h-5 w-5 text-purple" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Durée moyenne</p>
								<p class="mt-1 text-2xl font-bold text-foreground">
									{#if loading}
										<span class="skeleton inline-block h-8 w-12"></span>
									{:else}
										{overview ? formatDuration(overview.averageSessionDurationSeconds) : '—'}
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

			<!-- Sessions chart card -->
			<Card>
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<CardTitle class="text-base">Sessions (7 derniers jours)</CardTitle>
						{#if !loading && overview}
							<span class="inline-flex items-center gap-1 text-xs font-medium text-success">
								<ArrowUpRight class="h-3 w-3" />
								{overview.last7Days.sessions} sessions
							</span>
						{/if}
					</div>
				</CardHeader>
				<CardContent>
					{#if loading}
						<div class="skeleton h-16 w-full"></div>
					{:else}
						{@const data = getSparklineData()}
						<div class="flex items-end gap-1 h-16">
							{#each data as value, i}
								{@const max = Math.max(...data, 1)}
								<div class="flex-1 flex flex-col items-center gap-1">
									<div
										class="w-full rounded-t bg-primary/80 transition-all"
										style="height: {Math.max(4, (value / max) * 48)}px"
									></div>
									<span class="text-[9px] text-muted">{['L', 'M', 'M', 'J', 'V', 'S', 'D'][i] ?? ''}</span>
								</div>
							{/each}
						</div>
					{/if}
				</CardContent>
			</Card>

			<!-- Sessions récentes -->
			<Card>
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<CardTitle class="text-base">
							Sessions récentes
							<Badge variant="secondary" class="ml-1.5 text-[10px]">{sessions.length} sessions</Badge>
						</CardTitle>
						<div class="flex items-center gap-2">
							<div class="relative">
								<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
								<Input
									bind:value={searchQuery}
									placeholder="Rechercher..."
									class="h-8 w-48 pl-8 text-sm"
								/>
							</div>
							<Button variant="outline" size="sm" class="gap-1.5" onclick={exportCSV}>
								<Download class="h-3.5 w-3.5" />
								Exporter CSV
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
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
								</div>
							{/each}
						</div>
					{:else if filteredSessions.length === 0}
						<p class="py-8 text-center text-sm text-muted-foreground">Aucune session trouvée.</p>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b border-border">
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Utilisateur</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Début</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Durée</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Événements</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Statut</th>
										<th class="pb-2"></th>
									</tr>
								</thead>
								<tbody>
									{#each filteredSessions.slice(0, 20) as session}
										<tr
											class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent"
											onclick={() => openSessionDetail(session)}
										>
											<td class="py-3 pr-4">
												<div class="flex items-center gap-3">
													<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
														{session.user ? getInitials(session.user.name) : '?'}
													</div>
													<div>
														<p class="text-sm font-medium text-foreground">{session.user?.name ?? 'Visiteur anonyme'}</p>
														<p class="text-xs text-muted-foreground">{session.user?.email ?? ''}</p>
													</div>
												</div>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-muted-foreground">{formatDateTime(session.startedAt)}</span>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-foreground">{getSessionDuration(session)}</span>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-foreground">{session.eventCount}</span>
											</td>
											<td class="py-3 pr-4">
												{#if !session.endedAt}
													<Badge variant="success">En cours</Badge>
												{:else}
													<Badge variant="default">Terminée</Badge>
												{/if}
											</td>
											<td class="py-3">
												<ChevronRight class="h-4 w-4 text-muted" />
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</CardContent>
			</Card>
		{/if}

		{#if activeTab === 'clients' || activeTab === 'tools'}
			<!-- Sessions table view -->
			<Card>
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<CardTitle class="text-base">Sessions récentes</CardTitle>
						<div class="flex items-center gap-2">
							<div class="relative">
								<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
								<Input
									bind:value={searchQuery}
									placeholder="Rechercher..."
									class="h-8 w-48 pl-8 text-sm"
								/>
							</div>
							<Button variant="outline" size="sm" class="gap-1.5" onclick={exportCSV}>
								<Download class="h-3.5 w-3.5" />
								CSV
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{#if loading}
						<div class="space-y-3">
							{#each Array(5) as _}
								<div class="flex items-center gap-4 rounded-lg border border-border p-3">
									<div class="skeleton h-8 w-8 rounded-full"></div>
									<div class="flex-1 space-y-2">
										<div class="skeleton h-4 w-32"></div>
										<div class="skeleton h-3 w-48"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if filteredSessions.length === 0}
						<p class="py-8 text-center text-sm text-muted-foreground">Aucune session trouvée.</p>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b border-border">
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Utilisateur</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Début</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Durée</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Événements</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Statut</th>
										<th class="pb-2"></th>
									</tr>
								</thead>
								<tbody>
									{#each filteredSessions as session}
										<tr
											class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent"
											onclick={() => openSessionDetail(session)}
										>
											<td class="py-3 pr-4">
												<div class="flex items-center gap-3">
													<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
														{session.user ? getInitials(session.user.name) : '?'}
													</div>
													<div>
														<p class="text-sm font-medium text-foreground">{session.user?.name ?? 'Visiteur anonyme'}</p>
														<p class="text-xs text-muted-foreground">{session.user?.email ?? ''}</p>
													</div>
												</div>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-muted-foreground">{formatDateTime(session.startedAt)}</span>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-foreground">{getSessionDuration(session)}</span>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-foreground">{session.eventCount}</span>
											</td>
											<td class="py-3 pr-4">
												{#if !session.endedAt}
													<Badge variant="success">En cours</Badge>
												{:else}
													<Badge variant="default">Terminée</Badge>
												{/if}
											</td>
											<td class="py-3">
												<ChevronRight class="h-4 w-4 text-muted" />
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</CardContent>
			</Card>
		{/if}

		{#if activeTab === 'guides'}
			<!-- Guide stats -->
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Card>
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Guides lancés</p>
								<p class="mt-1 text-2xl font-bold text-foreground">
									{#if loading}
										<span class="skeleton inline-block h-8 w-12"></span>
									{:else}
										{overview?.totalGuideStarts ?? 0}
									{/if}
								</p>
							</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<BookOpen class="h-5 w-5 text-primary" />
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Guides terminés</p>
								<p class="mt-1 text-2xl font-bold text-foreground">
									{#if loading}
										<span class="skeleton inline-block h-8 w-12"></span>
									{:else}
										{overview?.totalGuideCompletions ?? 0}
									{/if}
								</p>
							</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
								<BookOpen class="h-5 w-5 text-success" />
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Taux de complétion</p>
								<p class="mt-1 text-2xl font-bold text-foreground">
									{#if loading}
										<span class="skeleton inline-block h-8 w-12"></span>
									{:else}
										{overview && overview.totalGuideStarts > 0
											? Math.round((overview.totalGuideCompletions / overview.totalGuideStarts) * 100)
											: 0}%
									{/if}
								</p>
							</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple/10">
								<TrendingUp class="h-5 w-5 text-purple" />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader class="pb-3">
					<CardTitle class="text-base">Détails des guides</CardTitle>
				</CardHeader>
				<CardContent>
					{#if loading}
						<div class="space-y-3">
							{#each Array(3) as _}
								<div class="flex items-center gap-4 p-3">
									<div class="skeleton h-10 w-10 rounded-lg"></div>
									<div class="flex-1 space-y-2">
										<div class="skeleton h-4 w-48"></div>
										<div class="skeleton h-3 w-24"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if guides.length === 0}
						<div class="flex flex-col items-center justify-center py-16">
							<div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
								<BookOpen class="h-6 w-6 text-muted" />
							</div>
							<p class="mt-4 text-sm font-medium text-foreground">Aucun guide</p>
							<p class="mt-1 text-sm text-muted-foreground">Les statistiques des guides apparaîtront ici.</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b border-border">
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Guide</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Pages</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Lancé</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Terminé</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Complétion</th>
									</tr>
								</thead>
								<tbody>
									{#each guides as guide}
										{@const completionRate = guide.playCount > 0 ? Math.round((guide.completionCount / guide.playCount) * 100) : 0}
										<tr class="border-b border-border last:border-0">
											<td class="py-3 pr-4">
												<div>
													<p class="text-sm font-medium text-foreground">{guide.name}</p>
													{#if guide.description}
														<p class="text-xs text-muted-foreground">{guide.description}</p>
													{/if}
												</div>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-foreground">{guide.pageCount}</span>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-foreground">{guide.playCount}</span>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-foreground">{guide.completionCount}</span>
											</td>
											<td class="py-3 pr-4">
												<div class="flex items-center gap-2">
													<div class="h-1.5 w-16 overflow-hidden rounded-full bg-border">
														<div
															class="h-full rounded-full {completionRate >= 75 ? 'bg-success' : completionRate >= 50 ? 'bg-warning' : 'bg-destructive'}"
															style="width: {completionRate}%"
														></div>
													</div>
													<span class="text-xs text-muted-foreground">{completionRate}%</span>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</CardContent>
			</Card>
		{/if}
	</div>

	<!-- Session detail panel (right side) -->
	{#if detailPanelOpen}
		<div class="w-96 shrink-0 border-l border-border bg-card">
			<div class="sticky top-14 max-h-[calc(100vh-var(--header-height))] overflow-y-auto">
				<!-- Panel header -->
				<div class="flex items-center justify-between border-b border-border p-4">
					<h3 class="text-sm font-semibold text-foreground">Détail de la session</h3>
					<button
						class="rounded-md p-1 text-muted transition-colors hover:bg-accent hover:text-foreground"
						onclick={closeDetailPanel}
					>
						<X class="h-4 w-4" />
					</button>
				</div>

				{#if sessionDetailLoading}
					<div class="space-y-4 p-4">
						<div class="flex items-center gap-3">
							<div class="skeleton h-12 w-12 rounded-full"></div>
							<div class="space-y-2">
								<div class="skeleton h-4 w-32"></div>
								<div class="skeleton h-3 w-24"></div>
							</div>
						</div>
						<div class="skeleton h-20 w-full"></div>
						<div class="space-y-2">
							{#each Array(5) as _}
								<div class="skeleton h-8 w-full"></div>
							{/each}
						</div>
					</div>
				{:else if selectedSession}
					<div class="p-4 space-y-5">
						<!-- User info -->
						<div class="flex items-center gap-3">
							<Avatar class="h-12 w-12">
								<AvatarFallback class="text-base">
									{selectedSession.user ? getInitials(selectedSession.user.name) : '?'}
								</AvatarFallback>
							</Avatar>
							<div>
								<div class="flex items-center gap-2">
									<p class="font-medium text-foreground">
										{selectedSession.user?.name ?? 'Visiteur anonyme'}
									</p>
									<Badge variant={selectedSession.assignmentId ? 'warning' : 'default'} class="text-[10px]">
										{selectedSession.assignmentId ? 'Client' : 'Admin'}
									</Badge>
								</div>
								<p class="text-xs text-muted-foreground">{selectedSession.user?.email ?? 'Email inconnu'}</p>
							</div>
						</div>

						<!-- Engagement score -->
						<div class="rounded-lg border border-border p-3">
							<div class="flex items-center justify-between mb-2">
								<span class="text-xs font-medium text-muted-foreground">Score d'engagement</span>
								<span class="text-sm font-bold text-foreground">{getEngagementScore(selectedSession)}/100</span>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-border">
								<div
									class="h-full rounded-full transition-all {getEngagementScore(selectedSession) >= 70 ? 'bg-success' : getEngagementScore(selectedSession) >= 40 ? 'bg-warning' : 'bg-destructive'}"
									style="width: {getEngagementScore(selectedSession)}%"
								></div>
							</div>
						</div>

						<!-- Session metrics -->
						<div class="grid grid-cols-2 gap-3">
							<div class="rounded-lg border border-border p-3">
								<p class="text-xs text-muted-foreground">Durée</p>
								<p class="mt-0.5 text-sm font-semibold text-foreground">{getSessionDuration(selectedSession)}</p>
							</div>
							<div class="rounded-lg border border-border p-3">
								<p class="text-xs text-muted-foreground">Événements</p>
								<p class="mt-0.5 text-sm font-semibold text-foreground">{selectedSession.events.length}</p>
							</div>
							<div class="rounded-lg border border-border p-3">
								<p class="text-xs text-muted-foreground">Début</p>
								<p class="mt-0.5 text-sm font-semibold text-foreground">{formatTime(selectedSession.startedAt)}</p>
							</div>
							<div class="rounded-lg border border-border p-3">
								<p class="text-xs text-muted-foreground">Fin</p>
								<p class="mt-0.5 text-sm font-semibold text-foreground">
									{selectedSession.endedAt ? formatTime(selectedSession.endedAt) : 'En cours'}
								</p>
							</div>
						</div>

						<Separator />

						<!-- Activity timeline -->
						<div>
							<h4 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Activité</h4>
							{#if selectedSession.events.length === 0}
								<p class="text-sm text-muted-foreground">Aucun événement enregistré.</p>
							{:else}
								<div class="relative space-y-0">
									{#each selectedSession.events as event, i}
										{@const EventIcon = getEventIcon(event.eventType)}
										<div class="flex gap-3 pb-4">
											<!-- Timeline line -->
											<div class="flex flex-col items-center">
												<div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full {event.eventType === 'guide_complete' ? 'bg-success/10' : 'bg-accent'}">
													<EventIcon class="h-3 w-3 {event.eventType === 'guide_complete' ? 'text-success' : 'text-muted-foreground'}" />
												</div>
												{#if i < selectedSession.events.length - 1}
													<div class="w-px flex-1 bg-border"></div>
												{/if}
											</div>
											<!-- Event content -->
											<div class="min-w-0 flex-1 pb-1">
												<p class="text-sm text-foreground">{getEventLabel(event.eventType)}</p>
												{#if event.page}
													<p class="truncate text-xs text-muted-foreground">{event.page.title}</p>
												{/if}
												<div class="mt-0.5 flex items-center gap-2">
													<span class="text-[10px] text-muted">{formatTime(event.timestamp)}</span>
													{#if event.durationSeconds}
														<span class="text-[10px] text-muted">{event.durationSeconds}s</span>
													{/if}
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
