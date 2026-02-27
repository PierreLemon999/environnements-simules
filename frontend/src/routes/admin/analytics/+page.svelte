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
	import { SearchableSelect } from '$components/ui/searchable-select';
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
		version?: { id: string; name: string; project: { id: string; name: string; toolName: string } | null } | null;
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
		version?: { id: string; name: string; project: { id: string; name: string; toolName: string } | null } | null;
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

	// Bar chart period state
	let barChartPeriod = $state(14);

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

	// Unique user counts by type
	let uniqueClientUserCount = $derived((() => {
		const userIds = new Set<string>();
		for (const s of clientSessions) {
			const id = s.userId ?? s.assignmentId ?? s.id;
			userIds.add(id);
		}
		return userIds.size;
	})());

	let uniqueAdminUserCount = $derived((() => {
		const userIds = new Set<string>();
		for (const s of adminSessions) {
			const id = s.userId ?? s.id;
			userIds.add(id);
		}
		return userIds.size;
	})());

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
		const assignment = session.assignment;
		if (assignment?.clientName) return assignment.clientName;
		if (assignment?.companyName) return assignment.companyName;
		if (assignment?.clientEmail) {
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
		const assignment = session.assignment;
		if (assignment?.clientEmail) return assignment.clientEmail;
		return 'Lien partagé';
	}

	// Get company name for a session — derive from assignment email or user email domain
	function getCompanyName(session: Session): string {
		const assignment = session.assignment;
		if (assignment?.companyName) return assignment.companyName;
		if (assignment?.clientEmail) {
			const domain = assignment.clientEmail.split('@')[1];
			if (domain) {
				const company = domain.split('.')[0];
				return company.charAt(0).toUpperCase() + company.slice(1);
			}
		}
		// Fallback: extract from user email domain
		if (session.user?.email) {
			const domain = session.user.email.split('@')[1];
			if (domain) {
				const company = domain.split('.')[0];
				return company.charAt(0).toUpperCase() + company.slice(1);
			}
		}
		return '—';
	}

	// Get unique visit count for a user across all sessions
	function getUniqueVisitCount(session: Session, sessionList: Session[]): number {
		const userId = session.userId ?? (session as any).assignment?.clientEmail ?? session.id;
		return sessionList.filter(s => {
			const sId = s.userId ?? (s as any).assignment?.clientEmail ?? s.id;
			return sId === userId;
		}).length;
	}

	// Max visits for progress bar normalization
	function getMaxVisits(sessionList: Session[]): number {
		const visitCounts = new Map<string, number>();
		for (const s of sessionList) {
			const userId = s.userId ?? (s as any).assignment?.clientEmail ?? s.id;
			visitCounts.set(userId, (visitCounts.get(userId) ?? 0) + 1);
		}
		return Math.max(...visitCounts.values(), 1);
	}

	// Pagination state
	let adminPage = $state(1);
	let clientPage = $state(1);
	const pageSize = 7;

	let paginatedAdminSessions = $derived(filteredAdminSessions.slice((adminPage - 1) * pageSize, adminPage * pageSize));
	let paginatedClientSessions = $derived(filteredClientSessions.slice((clientPage - 1) * pageSize, clientPage * pageSize));
	let adminTotalPages = $derived(Math.max(1, Math.ceil(filteredAdminSessions.length / pageSize)));
	let clientTotalPages = $derived(Math.max(1, Math.ceil(filteredClientSessions.length / pageSize)));

	// Tool name helper
	function getToolName(session: Session | SessionDetail): string {
		return (session as any).version?.project?.toolName ?? '—';
	}

	// Known tool colors
	const knownToolColors: Record<string, string> = {
		'Salesforce': '#00a1e0',
		'ServiceNow': '#81b532',
		'SAP SuccessFactors': '#0070f2',
		'SAP SF': '#0070f2',
		'Workday': '#f5a623',
		'HubSpot': '#ff7a59',
	};

	function getToolDotColor(session: Session): string {
		const toolName = (session as any).version?.project?.toolName;
		if (toolName && knownToolColors[toolName]) return knownToolColors[toolName];
		// Fallback: hash-based color from palette
		const index = projects.findIndex(p => p.toolName === toolName);
		return toolColors[Math.max(0, index) % toolColors.length];
	}

	// Tool dot color palette
	const toolColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

	function getToolColor(index: number): string {
		return toolColors[index % toolColors.length];
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

	// Generate sparkline data points from sessions (configurable days)
	function getSparklineData(days: number = 7): number[] {
		const now = new Date();
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

	// Sparkline data for unique users per day
	function getUniqueUsersSparkline(days: number = 7): number[] {
		const now = new Date();
		const daySets: Set<string>[] = Array.from({ length: days }, () => new Set());
		for (const s of sessions) {
			const d = new Date(s.startedAt);
			const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays >= 0 && diffDays < days) {
				const userId = s.userId ?? s.assignmentId ?? s.id;
				daySets[days - 1 - diffDays].add(userId);
			}
		}
		return daySets.map(set => set.size);
	}

	// Sparkline data for average session duration per day
	function getAvgDurationSparkline(days: number = 7): number[] {
		const now = new Date();
		const dayTotals: number[] = Array(days).fill(0);
		const dayCounts: number[] = Array(days).fill(0);
		for (const s of sessions) {
			if (!s.endedAt) continue;
			const d = new Date(s.startedAt);
			const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays >= 0 && diffDays < days) {
				const durSec = getSessionDurationSeconds(s);
				dayTotals[days - 1 - diffDays] += durSec;
				dayCounts[days - 1 - diffDays]++;
			}
		}
		return dayTotals.map((total, i) => dayCounts[i] > 0 ? total / dayCounts[i] : 0);
	}

	// Day labels for bar chart based on period
	function getDayLabels(days: number): string[] {
		const labels: string[] = [];
		const now = new Date();
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			if (days <= 7) {
				labels.push(['D', 'L', 'M', 'M', 'J', 'V', 'S'][d.getDay()]);
			} else {
				labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
			}
		}
		return labels;
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
	<title>Statistiques — Environnements Simulés</title>
</svelte:head>

<div class="flex gap-0">
	<!-- Main content -->
	<div class="min-w-0 flex-1 space-y-6 {detailPanelOpen ? 'pr-6' : ''}">
		<!-- Page header with inline tabs -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<h1 class="text-lg font-semibold text-foreground">Statistiques</h1>
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
				<SearchableSelect
					bind:value={selectedProjectId}
					options={[
						{ value: '', label: 'Tous les projets' },
						...projects.map(p => ({ value: p.id, label: p.toolName }))
					]}
					placeholder="Tous les projets"
					searchable={true}
					searchPlaceholder="Rechercher un projet..."
					class="w-48"
				/>

				<!-- Date range picker (third) -->
				<button class="flex h-9 items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm text-muted-foreground transition-colors hover:bg-accent">
					<Calendar class="h-3.5 w-3.5" />
					<span>01 fév — 24 fév 2026</span>
				</button>
			</div>
		</div>

		{#if activeTab === 'overview'}
			<!-- 3 separate stat cards -->
			<div class="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardContent class="p-5">
						<div class="flex items-start justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Sessions totales</p>
								<div class="mt-1 flex items-baseline gap-2">
									{#if loading}
										<span class="skeleton inline-block h-9 w-16"></span>
									{:else}
										<p class="text-3xl font-bold text-foreground">{overview?.totalSessions ?? 0}</p>
									{/if}
								</div>
								{#if !loading && overview}
									<span class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success">
										<ArrowUpRight class="h-3 w-3" />
										+{overview.last7Days.sessions} cette semaine
									</span>
								{/if}
							</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<Activity class="h-5 w-5 text-primary" />
							</div>
						</div>
						{#if !loading}
							{@const data = getSparklineData()}
							<div class="mt-3">
								<svg viewBox="0 0 200 30" class="h-8 w-full" preserveAspectRatio="none">
									<defs>
										<linearGradient id="areaGradientBlue" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#3B82F6" stop-opacity="0.2" />
											<stop offset="100%" stop-color="#3B82F6" stop-opacity="0" />
										</linearGradient>
									</defs>
									<path d={areaPath(data)} fill="url(#areaGradientBlue)" />
									<path d={sparklinePath(data)} fill="none" stroke="#3B82F6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</div>
						{/if}
					</CardContent>
				</Card>

				<Card>
					<CardContent class="p-5">
						<div class="flex items-start justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Utilisateurs uniques</p>
								<div class="mt-1 flex items-baseline gap-2">
									{#if loading}
										<span class="skeleton inline-block h-9 w-16"></span>
									{:else}
										<p class="text-3xl font-bold text-foreground">{overview?.last7Days.uniqueUsers ?? 0}</p>
									{/if}
								</div>
								{#if !loading && overview}
									<span class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
										{uniqueClientUserCount} clients · {uniqueAdminUserCount} admins & commerciaux
									</span>
								{/if}
							</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
								<Users class="h-5 w-5 text-purple-600" />
							</div>
						</div>
						{#if !loading}
							{@const usersData = getUniqueUsersSparkline()}
							<div class="mt-3">
								<svg viewBox="0 0 200 30" class="h-8 w-full" preserveAspectRatio="none">
									<defs>
										<linearGradient id="areaGradientPurple" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.2" />
											<stop offset="100%" stop-color="#8B5CF6" stop-opacity="0" />
										</linearGradient>
									</defs>
									<path d={areaPath(usersData)} fill="url(#areaGradientPurple)" />
									<path d={sparklinePath(usersData)} fill="none" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</div>
						{/if}
					</CardContent>
				</Card>

				<Card>
					<CardContent class="p-5">
						<div class="flex items-start justify-between">
							<div>
								<p class="text-xs font-medium text-muted-foreground">Temps moyen / session</p>
								<div class="mt-1 flex items-baseline gap-2">
									{#if loading}
										<span class="skeleton inline-block h-9 w-16"></span>
									{:else}
										<p class="text-3xl font-bold text-foreground">{formatDuration(overview?.averageSessionDurationSeconds ?? 0)}</p>
									{/if}
								</div>
								{#if !loading && overview}
									<span class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
										<Clock class="h-3 w-3" />
										Basé sur {overview.totalSessions} sessions
									</span>
								{/if}
							</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
								<Clock class="h-5 w-5 text-amber-600" />
							</div>
						</div>
						{#if !loading}
							{@const durationData = getAvgDurationSparkline()}
							<div class="mt-3">
								<svg viewBox="0 0 200 30" class="h-8 w-full" preserveAspectRatio="none">
									<defs>
										<linearGradient id="areaGradientAmber" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#F59E0B" stop-opacity="0.2" />
											<stop offset="100%" stop-color="#F59E0B" stop-opacity="0" />
										</linearGradient>
									</defs>
									<path d={areaPath(durationData)} fill="url(#areaGradientAmber)" />
									<path d={sparklinePath(durationData)} fill="none" stroke="#F59E0B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</div>
						{/if}
					</CardContent>
				</Card>
			</div>

			<!-- Two side-by-side session tables -->
			<div class="grid gap-4 lg:grid-cols-2">
				<!-- Admin sessions table -->
				<Card>
					<CardHeader class="pb-3">
						<div class="flex items-center justify-between">
							<CardTitle class="text-sm">
								Admins & Commerciaux
								<span class="ml-1 text-xs font-normal text-muted-foreground">— {filteredAdminSessions.length} sessions</span>
							</CardTitle>
							<Button variant="outline" size="sm" class="h-7 gap-1 text-[10px]" onclick={() => exportSessionsCSV(filteredAdminSessions, 'admin-sessions')}>
								<Download class="h-3 w-3" />
								CSV
							</Button>
						</div>
						<div class="relative mt-2">
							<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
							<Input bind:value={adminSearchQuery} placeholder="Rechercher..." class="h-7 pl-8 text-xs" />
						</div>
					</CardHeader>
					<CardContent class="px-0 pb-0">
						{#if loading}
							<div class="space-y-2 px-6 pb-4">
								{#each Array(3) as _}<div class="skeleton h-10 w-full rounded"></div>{/each}
							</div>
						{:else if filteredAdminSessions.length === 0}
							<p class="py-4 text-center text-xs text-muted-foreground">Aucune session admin.</p>
						{:else}
							<div class="overflow-x-auto">
								<table class="w-full">
									<thead>
										<tr class="border-b border-border">
											<th class="pb-2 pl-6 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Utilisateur</th>
											<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Rôle</th>
											<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Outil</th>
											<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Durée</th>
											<th class="pb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">Pages</th>
											<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Visites</th>
											<th class="pb-2 pr-6 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Date</th>
										</tr>
									</thead>
									<tbody>
										{#each paginatedAdminSessions as session}
											{@const displayName = session.user?.name ?? 'Admin'}
											{@const visitCount = getUniqueVisitCount(session, adminSessions)}
											{@const maxVisits = getMaxVisits(adminSessions)}
											{@const visitPct = Math.round((visitCount / maxVisits) * 100)}
											<tr
												class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent"
												onclick={() => openSessionDetail(session)}
											>
												<td class="py-2.5 pl-6 pr-2">
													<div class="flex items-center gap-2">
														<div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-medium text-primary">
															{getInitials(displayName)}
														</div>
														<div class="min-w-0">
															<p class="truncate text-xs font-medium text-foreground">{displayName}</p>
															<p class="truncate text-[10px] text-muted-foreground">{session.user?.email ?? ''}</p>
														</div>
													</div>
												</td>
												<td class="py-2.5 pr-2">
													<span class="text-[10px] text-muted-foreground">Admin</span>
												</td>
												<td class="py-2.5 pr-2">
													<div class="flex items-center gap-1.5">
														<span class="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style="background: {getToolDotColor(session)}"></span>
														<span class="text-[10px] text-muted-foreground">{getToolName(session)}</span>
													</div>
												</td>
												<td class="py-2.5 pr-2">
													<span class="font-mono text-[11px] text-muted-foreground">{getSessionDuration(session)}</span>
												</td>
												<td class="py-2.5 pr-2 text-center">
													<span class="font-mono text-[11px] text-muted-foreground">{session.eventCount}</span>
												</td>
												<td class="py-2.5 pr-2">
													<div class="flex items-center gap-1.5">
														<div class="h-1 w-10 overflow-hidden rounded-full bg-border">
															<div class="h-full rounded-full {visitPct >= 70 ? 'bg-primary' : visitPct >= 40 ? 'bg-warning' : 'bg-muted'}" style="width: {visitPct}%"></div>
														</div>
														<span class="font-mono text-[11px] font-semibold text-foreground">{visitCount}</span>
													</div>
												</td>
												<td class="py-2.5 pr-6">
													<span class="text-[10px] text-muted-foreground">{formatRelativeTime(session.startedAt)}</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
							{#if adminTotalPages > 1}
								<div class="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
									<span>Affichage {(adminPage - 1) * pageSize + 1}-{Math.min(adminPage * pageSize, filteredAdminSessions.length)} sur {filteredAdminSessions.length}</span>
									<div class="flex items-center gap-1">
										<button class="rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-40" disabled={adminPage <= 1} onclick={() => { adminPage--; }}>←</button>
										{#each Array(adminTotalPages) as _, i}
											<button class="rounded px-1.5 py-0.5 {adminPage === i + 1 ? 'bg-foreground text-background' : 'hover:bg-accent'}" onclick={() => { adminPage = i + 1; }}>{i + 1}</button>
										{/each}
										<button class="rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-40" disabled={adminPage >= adminTotalPages} onclick={() => { adminPage++; }}>→</button>
									</div>
								</div>
							{/if}
						{/if}
					</CardContent>
				</Card>

				<!-- Client sessions table -->
				<Card>
					<CardHeader class="pb-3">
						<div class="flex items-center justify-between">
							<CardTitle class="text-sm">
								Clients
								<span class="ml-1 text-xs font-normal text-muted-foreground">— {filteredClientSessions.length} sessions</span>
							</CardTitle>
							<Button variant="outline" size="sm" class="h-7 gap-1 text-[10px]" onclick={() => exportSessionsCSV(filteredClientSessions, 'client-sessions')}>
								<Download class="h-3 w-3" />
								CSV
							</Button>
						</div>
						<div class="relative mt-2">
							<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
							<Input bind:value={clientSearchQuery} placeholder="Rechercher..." class="h-7 pl-8 text-xs" />
						</div>
					</CardHeader>
					<CardContent class="px-0 pb-0">
						{#if loading}
							<div class="space-y-2 px-6 pb-4">
								{#each Array(3) as _}<div class="skeleton h-10 w-full rounded"></div>{/each}
							</div>
						{:else if filteredClientSessions.length === 0}
							<p class="py-4 text-center text-xs text-muted-foreground">Aucune session client.</p>
						{:else}
							<div class="overflow-x-auto">
								<table class="w-full">
									<thead>
										<tr class="border-b border-border">
											<th class="pb-2 pl-6 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Utilisateur</th>
											<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Entreprise</th>
											<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Outil</th>
											<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Durée</th>
											<th class="pb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">Pages</th>
											<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Visites</th>
											<th class="pb-2 pr-6 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Date</th>
										</tr>
									</thead>
									<tbody>
										{#each paginatedClientSessions as session}
											{@const displayName = getClientDisplayName(session)}
											{@const displaySubtitle = getClientDisplaySubtitle(session)}
											{@const company = getCompanyName(session)}
											{@const visitCount = getUniqueVisitCount(session, clientSessions)}
											{@const maxVisits = getMaxVisits(clientSessions)}
											{@const visitPct = Math.round((visitCount / maxVisits) * 100)}
											<tr
												class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent"
												onclick={() => openSessionDetail(session)}
											>
												<td class="py-2.5 pl-6 pr-2">
													<div class="flex items-center gap-2">
														<div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[9px] font-medium text-purple-600">
															{#if displayName !== 'Visiteur anonyme'}{getInitials(displayName)}{:else}?{/if}
														</div>
														<div class="min-w-0">
															<p class="truncate text-xs font-medium text-foreground">{displayName}</p>
															<p class="truncate text-[10px] text-muted-foreground">{displaySubtitle}</p>
														</div>
													</div>
												</td>
												<td class="py-2.5 pr-2">
													<span class="text-[10px] text-muted-foreground">{company}</span>
												</td>
												<td class="py-2.5 pr-2">
													<div class="flex items-center gap-1.5">
														<span class="inline-block h-[7px] w-[7px] shrink-0 rounded-full" style="background: {getToolDotColor(session)}"></span>
														<span class="text-[10px] text-muted-foreground">{getToolName(session)}</span>
													</div>
												</td>
												<td class="py-2.5 pr-2">
													<span class="font-mono text-[11px] text-muted-foreground">{getSessionDuration(session)}</span>
												</td>
												<td class="py-2.5 pr-2 text-center">
													<span class="font-mono text-[11px] text-muted-foreground">{session.eventCount}</span>
												</td>
												<td class="py-2.5 pr-2">
													<div class="flex items-center gap-1.5">
														<div class="h-1 w-10 overflow-hidden rounded-full bg-border">
															<div class="h-full rounded-full {visitPct >= 70 ? 'bg-primary' : visitPct >= 40 ? 'bg-warning' : 'bg-muted'}" style="width: {visitPct}%"></div>
														</div>
														<span class="font-mono text-[11px] font-semibold text-foreground">{visitCount}</span>
													</div>
												</td>
												<td class="py-2.5 pr-6">
													<span class="text-[10px] text-muted-foreground">{formatRelativeTime(session.startedAt)}</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
							{#if clientTotalPages > 1}
								<div class="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
									<span>Affichage {(clientPage - 1) * pageSize + 1}-{Math.min(clientPage * pageSize, filteredClientSessions.length)} sur {filteredClientSessions.length}</span>
									<div class="flex items-center gap-1">
										<button class="rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-40" disabled={clientPage <= 1} onclick={() => { clientPage--; }}>←</button>
										{#each Array(clientTotalPages) as _, i}
											<button class="rounded px-1.5 py-0.5 {clientPage === i + 1 ? 'bg-foreground text-background' : 'hover:bg-accent'}" onclick={() => { clientPage = i + 1; }}>{i + 1}</button>
										{/each}
										<button class="rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-40" disabled={clientPage >= clientTotalPages} onclick={() => { clientPage++; }}>→</button>
									</div>
								</div>
							{/if}
						{/if}
					</CardContent>
				</Card>
			</div>

			<!-- Sessions par jour bar chart -->
			<Card>
				<CardContent class="p-5">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="text-sm font-semibold text-foreground">Sessions par jour</h3>
						<div class="flex items-center gap-3">
							<!-- Period selector tabs -->
							<div class="flex items-center rounded-md border border-border">
								{#each [{ label: '7j', value: 7 }, { label: '14j', value: 14 }, { label: '30j', value: 30 }] as period}
									<button
										class="px-2.5 py-1 text-[10px] font-medium transition-colors first:rounded-l-md last:rounded-r-md {barChartPeriod === period.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}"
										onclick={() => { barChartPeriod = period.value; }}
									>
										{period.label}
									</button>
								{/each}
							</div>
							<div class="flex items-center gap-2 text-[10px]">
								<span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-sm bg-primary"></span> Clients</span>
								<span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-sm bg-blue-200"></span> Admins & Commerciaux</span>
							</div>
						</div>
					</div>
					{#if !loading}
						{@const days = barChartPeriod}
						{@const barHeight = 150}
						{@const dayLabels = getDayLabels(days)}
						{@const adminCounts = (() => { const c = Array(days).fill(0); const now = new Date(); for (const s of adminSessions) { const d = Math.floor((now.getTime() - new Date(s.startedAt).getTime()) / 86400000); if (d >= 0 && d < days) c[days - 1 - d]++; } return c; })()}
						{@const clientCounts = (() => { const c = Array(days).fill(0); const now = new Date(); for (const s of clientSessions) { const d = Math.floor((now.getTime() - new Date(s.startedAt).getTime()) / 86400000); if (d >= 0 && d < days) c[days - 1 - d]++; } return c; })()}
						{@const maxBar = Math.max(...adminCounts.map((a, i) => a + clientCounts[i]), 1)}
						<div class="flex items-end gap-1" style="height: {barHeight + 20}px">
							{#each Array(days) as _, i}
								{@const aPx = Math.round((adminCounts[i] / maxBar) * barHeight)}
								{@const cPx = Math.round((clientCounts[i] / maxBar) * barHeight)}
								{@const isToday = i === days - 1}
								<div class="flex flex-1 flex-col items-center gap-1">
									<div class="flex w-full items-end justify-center" style="height: {barHeight}px">
										<div class="flex w-full max-w-[24px] flex-col items-stretch">
											{#if clientCounts[i] > 0}
												<div class="w-full rounded-t-[3px] bg-primary" style="height: {Math.max(cPx, 4)}px"></div>
											{/if}
											{#if adminCounts[i] > 0}
												<div class="w-full {clientCounts[i] > 0 ? '' : 'rounded-t-[3px]'} bg-blue-200" style="height: {Math.max(aPx, 4)}px"></div>
											{/if}
											{#if adminCounts[i] === 0 && clientCounts[i] === 0}
												<div class="w-full rounded-t-[3px] bg-border" style="height: 2px"></div>
											{/if}
										</div>
									</div>
									<span class="text-[9px] {isToday ? 'font-semibold text-primary' : 'text-muted'} {days > 14 ? 'hidden sm:inline' : ''}">{dayLabels[i]}</span>
								</div>
							{/each}
						</div>
						<div class="mt-3 flex gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
							<div class="flex items-center gap-1.5">
								<span class="inline-block h-2 w-2 rounded-sm bg-primary"></span>
								Clients
								<span class="font-mono font-semibold text-foreground">{clientSessions.length}</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span class="inline-block h-2 w-2 rounded-sm bg-blue-200"></span>
								Admins & Commerciaux
								<span class="font-mono font-semibold text-foreground">{adminSessions.length}</span>
							</div>
						</div>
					{:else}
						<div class="skeleton h-32 w-full rounded"></div>
					{/if}
				</CardContent>
			</Card>

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
