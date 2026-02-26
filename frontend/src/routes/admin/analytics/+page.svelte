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
		Filter,
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
		assignment?: { clientName: string | null; clientEmail: string; companyName?: string | null; metadata?: any } | null;
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
		assignment?: { clientName: string | null; clientEmail: string; companyName?: string | null; metadata?: any } | null;
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

	// Unified filtered sessions based on search
	let filteredSessions = $derived(
		sessions.filter((s) => {
			const q = searchQuery.toLowerCase();
			if (!q) return true;
			const name = (s.user?.name ?? getClientDisplayName(s)).toLowerCase();
			const email = (s.user?.email ?? getClientDisplaySubtitle(s)).toLowerCase();
			return name.includes(q) || email.includes(q);
		})
	);

	// Split sessions by type
	let adminSessions = $derived(filteredSessions.filter(s => !s.assignmentId && s.user));
	let clientSessions = $derived(filteredSessions.filter(s => !!s.assignmentId || !s.user));

	// Search per column
	let adminSearchQuery = $state('');
	let clientSearchQuery = $state('');

	let filteredAdminSessions = $derived(
		adminSessions.filter(s => {
			if (!adminSearchQuery.trim()) return true;
			const q = adminSearchQuery.toLowerCase();
			const name = (s.user?.name ?? '').toLowerCase();
			const email = (s.user?.email ?? '').toLowerCase();
			return name.includes(q) || email.includes(q);
		})
	);

	let filteredClientSessions = $derived(
		clientSessions.filter(s => {
			if (!clientSearchQuery.trim()) return true;
			const q = clientSearchQuery.toLowerCase();
			const name = getClientDisplayName(s).toLowerCase();
			const email = getClientDisplaySubtitle(s).toLowerCase();
			return name.includes(q) || email.includes(q);
		})
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

	function getEngagementColor(score: number): string {
		if (score >= 70) return '#10B981';
		if (score >= 40) return '#F59E0B';
		return '#EF4444';
	}

	function getClientDisplayName(session: Session | SessionDetail): string {
		if (session.user?.name) return session.user.name;
		// Check assignment metadata for company info
		const assignment = (session as any).assignment;
		if (assignment?.clientName) return assignment.clientName;
		if (assignment?.companyName) return assignment.companyName;
		if (assignment?.metadata?.companyName) return assignment.metadata.companyName;
		if (assignment?.clientEmail) {
			// Extract company name from email domain
			const domain = assignment.clientEmail.split('@')[1];
			if (domain) {
				const company = domain.split('.')[0];
				return company.charAt(0).toUpperCase() + company.slice(1);
			}
		}
		return 'Visiteur anonyme';
	}

	function getClientDisplaySubtitle(session: Session | SessionDetail): string {
		if (session.user?.email) return session.user.email;
		const assignment = (session as any).assignment;
		if (assignment?.clientEmail) return assignment.clientEmail;
		return 'Lien partagé';
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

	// Generate sparkline data points from sessions (last 7 days)
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

	function areaPath(data: number[]): string {
		if (data.length === 0) return '';
		const max = Math.max(...data, 1);
		const w = 200;
		const h = 40;
		const step = w / (data.length - 1);
		const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`);
		// Close the path: go to bottom-right, bottom-left, then back to start
		return `M ${points.join(' L ')} L ${w},${h} L 0,${h} Z`;
	}

	// Circular gauge SVG path for engagement score
	function gaugeArc(score: number, radius: number = 36, strokeWidth: number = 6): { bgPath: string; fgPath: string } {
		const cx = radius + strokeWidth / 2;
		const cy = radius + strokeWidth / 2;
		const r = radius;
		const circumference = 2 * Math.PI * r;
		const dashOffset = circumference - (score / 100) * circumference;

		return {
			bgPath: `${circumference}`,
			fgPath: `${dashOffset}`,
		};
	}

	// Export sessions to CSV
	function exportSessionsCSV(sessionList: Session[], filename: string) {
		const headers = ['Utilisateur', 'Email', 'Début', 'Fin', 'Durée', 'Événements'];
		const rows = sessionList.map((s) => [
			s.user?.name ?? getClientDisplayName(s),
			s.user?.email ?? getClientDisplaySubtitle(s),
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
		a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function exportCSV() {
		exportSessionsCSV(filteredSessions, 'sessions');
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
				<!-- Live indicator (first) -->
				<div class="flex items-center gap-1.5 rounded-full border border-success-border bg-success-bg px-3 py-1">
					<span class="relative flex h-2 w-2">
						<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
					</span>
					<span class="text-xs font-medium text-success">En direct</span>
				</div>

				<!-- Project filter (second, with funnel icon) -->
				<div class="relative flex items-center">
					<Filter class="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
					<select
						bind:value={selectedProjectId}
						class="flex h-9 rounded-md border border-border bg-transparent py-1 pl-8 pr-3 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<option value="">Tous les projets</option>
						{#each projects as project}
							<option value={project.id}>{project.toolName}</option>
						{/each}
					</select>
				</div>

				<!-- Date range picker (third) -->
				<button class="flex h-9 items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm text-muted-foreground transition-colors hover:bg-accent">
					<Calendar class="h-3.5 w-3.5" />
					<span>01 fév — 24 fév 2026</span>
				</button>
			</div>
		</div>

		{#if activeTab === 'overview'}
			<!-- Single prominent sessions card with embedded area chart -->
			<Card>
				<CardContent class="p-5">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sessions totales</p>
							<div class="mt-1 flex items-baseline gap-3">
								{#if loading}
									<span class="skeleton inline-block h-9 w-16"></span>
								{:else}
									<p class="text-3xl font-bold text-foreground">{overview?.totalSessions ?? 0}</p>
								{/if}
								{#if !loading && overview}
									<span class="inline-flex items-center gap-1 text-xs font-medium text-success">
										<ArrowUpRight class="h-3 w-3" />
										{overview.last7Days.sessions} cette semaine
									</span>
								{/if}
							</div>
							{#if !loading && overview}
								<div class="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
									<span class="flex items-center gap-1">
										<Eye class="h-3 w-3" />
										{overview.totalPageViews} pages vues
									</span>
									<span class="flex items-center gap-1">
										<Users class="h-3 w-3" />
										{overview.last7Days.uniqueUsers} utilisateurs (7j)
									</span>
									<span class="flex items-center gap-1">
										<Clock class="h-3 w-3" />
										{formatDuration(overview.averageSessionDurationSeconds)} en moyenne
									</span>
								</div>
							{/if}
						</div>
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<Activity class="h-5 w-5 text-primary" />
						</div>
					</div>

					<!-- Embedded area chart (7 last days) -->
					{#if !loading}
						{@const data = getSparklineData()}
						{@const max = Math.max(...data, 1)}
						<div class="mt-4">
							<div class="flex items-center justify-between mb-2">
								<span class="text-[10px] font-medium uppercase tracking-wider text-muted">7 derniers jours</span>
							</div>
							<svg viewBox="0 0 200 40" class="h-20 w-full" preserveAspectRatio="none">
								<defs>
									<linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stop-color="#3B82F6" stop-opacity="0.3" />
										<stop offset="100%" stop-color="#3B82F6" stop-opacity="0.02" />
									</linearGradient>
								</defs>
								<!-- Filled area -->
								<path d={areaPath(data)} fill="url(#areaGradient)" />
								<!-- Stroke line -->
								<path d={sparklinePath(data)} fill="none" stroke="#3B82F6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
							<div class="flex justify-between px-0.5 mt-1">
								{#each ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as label, i}
									<span class="text-[9px] text-muted">{label}</span>
								{/each}
							</div>
						</div>
					{:else}
						<div class="mt-4 skeleton h-16 w-full rounded"></div>
					{/if}
				</CardContent>
			</Card>

			<!-- Split sessions tables: Admins (left) vs Clients (right) -->
			<div class="grid grid-cols-2 gap-4">
				<!-- Admin sessions -->
				<Card>
					<CardHeader class="pb-3">
						<div class="flex items-center justify-between">
							<CardTitle class="text-sm">
								Admins & Commerciaux
								<span class="ml-1 text-xs font-normal text-muted-foreground">— {adminSessions.length} sessions</span>
							</CardTitle>
						</div>
						<div class="relative mt-2">
							<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
							<Input
								bind:value={adminSearchQuery}
								placeholder="Rechercher..."
								class="h-8 pl-8 text-sm"
							/>
						</div>
					</CardHeader>
					<CardContent>
						{#if loading}
							<div class="space-y-2">
								{#each Array(3) as _}
									<div class="skeleton h-12 w-full rounded"></div>
								{/each}
							</div>
						{:else if filteredAdminSessions.length === 0}
							<p class="py-6 text-center text-sm text-muted-foreground">Aucune session admin.</p>
						{:else}
							<div class="space-y-0">
								{#each filteredAdminSessions.slice(0, 10) as session}
									{@const displayName = session.user?.name ?? 'Anonyme'}
									{@const displaySubtitle = session.user?.email ?? ''}
									<button
										class="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent"
										onclick={() => openSessionDetail(session)}
									>
										<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
											{getInitials(displayName)}
										</div>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-foreground">{displayName}</p>
											<p class="truncate text-xs text-muted-foreground">{displaySubtitle}</p>
										</div>
										<div class="shrink-0 text-right">
											<p class="text-xs text-muted-foreground">{getSessionDuration(session)}</p>
											<p class="text-[10px] text-muted">{formatRelativeTime(session.startedAt)}</p>
										</div>
										<ChevronRight class="h-3.5 w-3.5 shrink-0 text-muted" />
									</button>
								{/each}
							</div>
						{/if}
					</CardContent>
				</Card>

				<!-- Client sessions -->
				<Card>
					<CardHeader class="pb-3">
						<div class="flex items-center justify-between">
							<CardTitle class="text-sm">
								Clients
								<span class="ml-1 text-xs font-normal text-muted-foreground">— {clientSessions.length} sessions</span>
							</CardTitle>
							<Button variant="outline" size="sm" class="gap-1.5 text-xs h-7" onclick={exportCSV}>
								<Download class="h-3 w-3" />
								CSV
							</Button>
						</div>
						<div class="relative mt-2">
							<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
							<Input
								bind:value={clientSearchQuery}
								placeholder="Rechercher..."
								class="h-8 pl-8 text-sm"
							/>
						</div>
					</CardHeader>
					<CardContent>
						{#if loading}
							<div class="space-y-2">
								{#each Array(3) as _}
									<div class="skeleton h-12 w-full rounded"></div>
								{/each}
							</div>
						{:else if filteredClientSessions.length === 0}
							<p class="py-6 text-center text-sm text-muted-foreground">Aucune session client.</p>
						{:else}
							<div class="space-y-0">
								{#each filteredClientSessions.slice(0, 10) as session}
									{@const displayName = getClientDisplayName(session)}
									{@const displaySubtitle = getClientDisplaySubtitle(session)}
									<button
										class="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent"
										onclick={() => openSessionDetail(session)}
									>
										<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-xs font-medium text-warning">
											{#if displayName !== 'Visiteur anonyme'}
												{getInitials(displayName)}
											{:else}
												?
											{/if}
										</div>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-foreground">{displayName}</p>
											<p class="truncate text-xs text-muted-foreground">{displaySubtitle}</p>
										</div>
										<div class="shrink-0 text-right">
											<p class="text-xs text-muted-foreground">{getSessionDuration(session)}</p>
											<p class="text-[10px] text-muted">{formatRelativeTime(session.startedAt)}</p>
										</div>
										<ChevronRight class="h-3.5 w-3.5 shrink-0 text-muted" />
									</button>
								{/each}
							</div>
						{/if}
					</CardContent>
				</Card>
			</div>

		{/if}

		{#if activeTab === 'clients' || activeTab === 'tools'}
			<!-- Sessions table view for clients/tools tabs -->
			<Card>
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<CardTitle class="text-base">
							Sessions récentes
							<span class="ml-1 text-sm font-normal text-muted-foreground">— {filteredSessions.length} sessions</span>
						</CardTitle>
						<div class="flex items-center gap-2">
							<div class="relative">
								<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
								<Input
									bind:value={searchQuery}
									placeholder="Rechercher..."
									class="h-8 w-56 pl-8 text-sm"
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
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Type</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Début</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Durée</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Événements</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Statut</th>
										<th class="pb-2"></th>
									</tr>
								</thead>
								<tbody>
									{#each filteredSessions as session}
										{@const isClient = !!session.assignmentId || !session.user}
										{@const displayName = getClientDisplayName(session)}
										{@const displaySubtitle = getClientDisplaySubtitle(session)}
										<tr
											class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent"
											onclick={() => openSessionDetail(session)}
										>
											<td class="py-3 pr-4">
												<div class="flex items-center gap-3">
													<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {isClient ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'} text-xs font-medium">
														{#if displayName !== 'Visiteur anonyme'}
															{getInitials(displayName)}
														{:else}
															?
														{/if}
													</div>
													<div>
														<p class="text-sm font-medium text-foreground">{displayName}</p>
														<p class="text-xs text-muted-foreground">{displaySubtitle}</p>
													</div>
												</div>
											</td>
											<td class="py-3 pr-4">
												<Badge variant={isClient ? 'warning' : 'default'} class="text-[10px]">
													{isClient ? 'Client' : 'Admin'}
												</Badge>
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
					{@const engagementScore = getEngagementScore(selectedSession)}
					{@const engagementColor = getEngagementColor(engagementScore)}
					{@const detailDisplayName = getClientDisplayName(selectedSession as any)}
					{@const detailDisplaySubtitle = getClientDisplaySubtitle(selectedSession as any)}
					{@const gaugeRadius = 30}
					{@const gaugeStrokeW = 5}
					{@const gaugeSize = (gaugeRadius + gaugeStrokeW) * 2}
					{@const gaugeCircumference = 2 * Math.PI * gaugeRadius}
					{@const gaugeDashOffset = gaugeCircumference - (engagementScore / 100) * gaugeCircumference}
					<div class="p-4 space-y-5">
						<!-- User info -->
						<div class="flex items-center gap-3">
							<Avatar class="h-12 w-12">
								<AvatarFallback class="text-base">
									{#if detailDisplayName !== 'Visiteur anonyme'}
										{getInitials(detailDisplayName)}
									{:else}
										?
									{/if}
								</AvatarFallback>
							</Avatar>
							<div>
								<div class="flex items-center gap-2">
									<p class="font-medium text-foreground">
										{detailDisplayName}
									</p>
									<Badge variant={selectedSession.assignmentId ? 'warning' : 'default'} class="text-[10px]">
										{selectedSession.assignmentId ? 'Client' : 'Admin'}
									</Badge>
								</div>
								<p class="text-xs text-muted-foreground">{detailDisplaySubtitle}</p>
							</div>
						</div>

						<!-- Engagement score — circular gauge ring -->
						<div class="flex items-center gap-4 rounded-lg border border-border p-3">
							<div class="relative flex shrink-0 items-center justify-center">
								<svg width={gaugeSize} height={gaugeSize} class="rotate-[-90deg]">
									<!-- Background ring -->
									<circle
										cx={gaugeSize / 2}
										cy={gaugeSize / 2}
										r={gaugeRadius}
										fill="none"
										stroke="currentColor"
										stroke-width={gaugeStrokeW}
										class="text-border"
									/>
									<!-- Score ring -->
									<circle
										cx={gaugeSize / 2}
										cy={gaugeSize / 2}
										r={gaugeRadius}
										fill="none"
										stroke={engagementColor}
										stroke-width={gaugeStrokeW}
										stroke-dasharray={gaugeCircumference}
										stroke-dashoffset={gaugeDashOffset}
										stroke-linecap="round"
										class="transition-all duration-500"
									/>
								</svg>
								<!-- Score number centered inside -->
								<span
									class="absolute text-lg font-bold"
									style="color: {engagementColor}"
								>
									{engagementScore}
								</span>
							</div>
							<div>
								<p class="text-xs font-medium text-muted-foreground">Score d'engagement</p>
								<p class="text-sm text-foreground">
									{#if engagementScore >= 70}
										Excellent
									{:else if engagementScore >= 40}
										Moyen
									{:else}
										Faible
									{/if}
								</p>
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
