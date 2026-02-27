<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from '$lib/api';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { goto } from '$app/navigation';
	import {
		FolderKanban,
		FileText,
		ArrowUpRight,
		Play,
		Activity,
		Eye,
		Clock,
		Search,
		Filter,
		Download,
		MoreHorizontal,
		ChevronLeft,
		ChevronRight,
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

	interface ProjectDetail {
		id: string;
		name: string;
		toolName: string;
		versions: Array<{ id: string; projectId: string; name: string; status: string }>;
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
	let searchQuery = $state('');
	let currentPage = $state(1);
	const pageSize = 10;

	// Map versionId → { projectName, toolName }
	let versionProjectMap: Record<string, { projectName: string; toolName: string }> = $state({});

	let totalPages = $derived(projects.reduce((sum, p) => sum + p.pageCount, 0));
	let activeProjects = $derived(projects.length);

	// Session counts for tab badges
	let guideSessions = $derived(sessions.filter(s => s.eventCount > 3));
	let sessionCount = $derived(sessions.length);
	let guideCount = $derived(guideSessions.length);

	// Demos actives — derive from unique users who have sessions (as a proxy for active assignments)
	let activeDemoCount = $derived(() => {
		const uniqueAssignments = new Set(sessions.filter(s => s.assignmentId).map(s => s.assignmentId));
		return Math.max(uniqueAssignments.size, projects.length);
	});
	let clientDemoCount = $derived(() => {
		const clientSessions = sessions.filter(s => s.user && s.user.email && !s.user.email.endsWith('@lemonlearning.com'));
		const uniqueClients = new Set(clientSessions.map(s => s.userId));
		return uniqueClients.size;
	});
	let internalDemoCount = $derived(() => {
		const internalSessions = sessions.filter(s => s.user && s.user.email && s.user.email.endsWith('@lemonlearning.com'));
		const uniqueInternal = new Set(internalSessions.map(s => s.userId));
		return uniqueInternal.size;
	});
	let testDemoCount = $derived(() => {
		const testSessions = sessions.filter(s => !s.user || !s.userId);
		return testSessions.length > 0 ? 1 : 0;
	});

	// Sessions this month — count sessions started in the current calendar month
	let sessionsThisMonth = $derived(() => {
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
		return sessions.filter(s => s.startedAt >= startOfMonth).length;
	});
	let sessionsLastMonth = $derived(() => {
		const now = new Date();
		const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
		const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
		return sessions.filter(s => s.startedAt >= startOfLastMonth && s.startedAt < startOfThisMonth).length;
	});
	let sessionChangePercent = $derived(() => {
		const last = sessionsLastMonth();
		const current = sessionsThisMonth();
		if (last === 0) return current > 0 ? 100 : 0;
		return Math.round(((current - last) / last) * 100);
	});

	let filteredSessions = $derived(() => {
		let result = activityFilter === 'guides' ? guideSessions : sessions;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(s => {
				const name = s.user?.name?.toLowerCase() ?? '';
				const email = s.user?.email?.toLowerCase() ?? '';
				return name.includes(q) || email.includes(q);
			});
		}
		return result;
	});

	let paginatedSessions = $derived(() => {
		const all = filteredSessions();
		const start = (currentPage - 1) * pageSize;
		return all.slice(start, start + pageSize);
	});

	let totalActivityPages = $derived(Math.max(1, Math.ceil(filteredSessions().length / pageSize)));

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

	function getToolNameForSession(session: Session): string {
		return versionProjectMap[session.versionId]?.toolName ?? '—';
	}

	function getDemoNameForSession(session: Session): string {
		return versionProjectMap[session.versionId]?.projectName ?? '—';
	}

	function getActionBadge(session: Session): { label: string; color: string; bg: string; dot: string } {
		if (session.eventCount > 5) return { label: 'Guide terminé', color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' };
		if (session.eventCount > 3) return { label: 'Guide démarré', color: '#d97706', bg: '#fffbeb', dot: '#d97706' };
		if (session.eventCount > 1) return { label: 'Page consultée', color: '#2563eb', bg: '#eff6ff', dot: '#2563eb' };
		if (session.eventCount > 0) return { label: 'Session démarrée', color: '#2563eb', bg: '#eff6ff', dot: '#2563eb' };
		return { label: 'Visite', color: '#6b7280', bg: '#f3f4f6', dot: '#6b7280' };
	}

	function formatRelativeTime(dateStr: string): string {
		const now = new Date();
		const date = new Date(dateStr);
		const diffMs = now.getTime() - date.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMin / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMin < 1) return "À l'instant";
		if (diffMin < 60) return `Il y a ${diffMin}min`;
		if (diffHours < 24) return `Il y a ${diffHours}h`;
		if (diffDays === 1) return 'Hier';
		if (diffDays < 7) return `Il y a ${diffDays}j`;
		return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	}

	function formatDuration(seconds: number): string {
		const min = Math.floor(seconds / 60);
		const sec = Math.round(seconds % 60);
		return `${min}m ${sec.toString().padStart(2, '0')}s`;
	}

	function getCompanyName(session: Session): string {
		if (session.user?.email) {
			const domain = session.user.email.split('@')[1];
			if (domain) {
				const company = domain.split('.')[0];
				// Capitalize and clean up known company names
				const companyMap: Record<string, string> = {
					'lemonlearning': 'Lemonlearning',
					'acme-corp': 'Acme Corp',
					'techvision': 'Techvision',
				};
				return companyMap[company] ?? (company.charAt(0).toUpperCase() + company.slice(1));
			}
		}
		return '';
	}

	onMount(async () => {
		try {
			const [projectsRes, sessionsRes, overviewRes] = await Promise.all([
				get<{ data: Project[] }>('/projects'),
				get<{ data: Session[] }>('/analytics/sessions?limit=50'),
				get<{ data: Overview }>('/analytics/overview'),
			]);
			projects = projectsRes.data;
			sessions = sessionsRes.data;
			overview = overviewRes.data;

			// Build versionId → project map by fetching each project's details
			const map: Record<string, { projectName: string; toolName: string }> = {};
			await Promise.all(
				projectsRes.data.map(async (p) => {
					try {
						const detail = await get<{ data: ProjectDetail }>(`/projects/${p.id}`);
						for (const v of detail.data.versions ?? []) {
							map[v.id] = { projectName: p.name, toolName: p.toolName };
						}
					} catch {
						// Skip if project detail fails
					}
				})
			);
			versionProjectMap = map;
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
	<!-- Stats row — 4 compact cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Projets actifs -->
		<Card class="border-border">
			<CardContent class="p-3.5">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-[13px] font-medium text-muted-foreground">Projets actifs</p>
						<p class="mt-0.5 text-[22px] font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-7 w-10"></span>
							{:else}
								{activeProjects}
							{/if}
						</p>
						{#if !loading}
							<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
								<ArrowUpRight class="h-3 w-3" />
								+2 ce mois
							</span>
						{/if}
					</div>
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
						<FolderKanban class="h-4 w-4 text-blue-600" />
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Pages capturées -->
		<Card class="border-border">
			<CardContent class="p-3.5">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-[13px] font-medium text-muted-foreground">Pages capturées</p>
						<p class="mt-0.5 text-[22px] font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-7 w-10"></span>
							{:else}
								{totalPages}
							{/if}
						</p>
						{#if !loading}
							<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
								<ArrowUpRight class="h-3 w-3" />
								+{totalPages} cette semaine
							</span>
						{/if}
					</div>
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
						<FileText class="h-4 w-4 text-emerald-600" />
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Démos actives -->
		<Card class="border-border">
			<CardContent class="p-3.5">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-[13px] font-medium text-muted-foreground">Démos actives</p>
						<p class="mt-0.5 text-[22px] font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-7 w-10"></span>
							{:else}
								{activeDemoCount()}
							{/if}
						</p>
						{#if !loading}
							<span class="text-[12px] text-muted-foreground">{clientDemoCount()} clients · {internalDemoCount()} internes · {testDemoCount()} tests</span>
						{/if}
					</div>
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
						<Play class="h-4 w-4 text-purple-600" />
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Sessions ce mois -->
		<Card class="border-border">
			<CardContent class="p-3.5">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-[13px] font-medium text-muted-foreground">Sessions ce mois</p>
						<p class="mt-0.5 text-[22px] font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-7 w-10"></span>
							{:else}
								{sessionsThisMonth()}
							{/if}
						</p>
						{#if !loading}
							{@const changePercent = sessionChangePercent()}
							<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
								<ArrowUpRight class="h-3 w-3" />
								+{changePercent}% vs mois dernier
							</span>
						{/if}
					</div>
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
						<Activity class="h-4 w-4 text-amber-600" />
					</div>
				</div>
				{#if !loading}
					<div class="mt-2 flex gap-3 border-t border-border pt-2">
						<div class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
							<FileText class="h-3.5 w-3.5 text-muted" />
							<span class="font-semibold text-foreground">{overview?.totalPageViews ?? 0}</span> pages
						</div>
						<div class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
							<Clock class="h-3.5 w-3.5 text-muted" />
							<span class="font-semibold text-foreground">{formatDuration(overview?.averageSessionDurationSeconds ?? 0)}</span> temps moyen
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Activity journal -->
	<Card>
		<CardHeader class="pb-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<CardTitle class="text-base">Journal d'activité des clients</CardTitle>
				</div>
				<!-- Tabs inline-right -->
				<div class="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
					<button
						class="rounded-md px-3 py-1 text-xs font-medium transition-colors {activityFilter === 'all' ? 'bg-foreground text-white' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => { activityFilter = 'all'; currentPage = 1; }}
					>
						Toutes
						<span class="ml-1 text-[10px] {activityFilter === 'all' ? 'text-white/70' : 'text-muted'}">{sessionCount}</span>
					</button>
					<button
						class="rounded-md px-3 py-1 text-xs font-medium transition-colors {activityFilter === 'sessions' ? 'bg-foreground text-white' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => { activityFilter = 'sessions'; currentPage = 1; }}
					>
						Sessions
						<span class="ml-1 text-[10px] {activityFilter === 'sessions' ? 'text-white/70' : 'text-muted'}">{sessionCount}</span>
					</button>
					<button
						class="rounded-md px-3 py-1 text-xs font-medium transition-colors {activityFilter === 'guides' ? 'bg-foreground text-white' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => { activityFilter = 'guides'; currentPage = 1; }}
					>
						Guides terminés
						<span class="ml-1 text-[10px] {activityFilter === 'guides' ? 'text-white/70' : 'text-muted'}">{guideCount}</span>
					</button>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			<!-- Toolbar -->
			<div class="mb-4 flex items-center gap-3">
				<div class="relative flex-1">
					<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
					<input
						type="text"
						placeholder="Filtrer les activités..."
						bind:value={searchQuery}
						class="h-8 w-full rounded-md border border-border bg-transparent pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/10"
					/>
				</div>
				<button class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
					<Filter class="h-3 w-3" />
					Filtres
				</button>
				<button class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
					Tous les clients
				</button>
				<button class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
					<Download class="h-3 w-3" />
					Exporter
				</button>
			</div>

			{#if loading}
				<div class="space-y-3">
					{#each Array(5) as _}
						<div class="flex items-center gap-4 py-3">
							<div class="skeleton h-4 w-4 rounded"></div>
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
			{:else if filteredSessions().length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">Aucune activité récente.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-border">
								<th class="w-8 pb-2 text-left">
									<input type="checkbox" class="h-3.5 w-3.5 rounded border-border accent-primary" />
								</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Projet / Démo</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
								<th class="w-16 pb-2"></th>
							</tr>
						</thead>
						<tbody>
							{#each paginatedSessions() as session}
								{@const action = getActionBadge(session)}
								{@const company = getCompanyName(session)}
								{@const toolName = getToolNameForSession(session)}
								{@const toolColor = getToolColor(toolName)}
								<tr class="group border-b border-border last:border-0 transition-colors hover:bg-accent">
									<td class="py-3 pr-2">
										<input type="checkbox" class="h-3.5 w-3.5 rounded border-border accent-primary" />
									</td>
									<td class="py-3 pr-4">
										<div class="flex items-center gap-3">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
												{company ? company.slice(0, 2).toUpperCase() : (session.user ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : '?')}
											</div>
											<div class="min-w-0">
												<p class="truncate text-sm font-medium text-foreground">{company || session.user?.name || 'Anonyme'}</p>
												<p class="truncate text-xs text-muted-foreground">{company ? (session.user?.name ?? 'Visiteur') : 'Visiteur'}</p>
											</div>
										</div>
									</td>
									<td class="py-3 pr-4">
										<div class="flex items-center gap-2">
											<span class="text-sm text-foreground">{getDemoNameForSession(session)}</span>
											<span
												class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
												style="background-color: {toolColor}15; color: {toolColor}"
											>
												<span class="h-1.5 w-1.5 rounded-full" style="background-color: {toolColor}"></span>
												{toolName}
											</span>
										</div>
									</td>
									<td class="py-3 pr-4">
										<span
											class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
											style="background-color: {action.bg}; color: {action.color}"
										>
											<span class="h-1.5 w-1.5 rounded-full" style="background-color: {action.dot}"></span>
											{action.label}
										</span>
									</td>
									<td class="py-3 pr-4">
										<span class="text-xs text-muted-foreground">{formatRelativeTime(session.startedAt)}</span>
									</td>
									<td class="py-3">
										<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
											<button class="rounded-md p-1 text-muted transition-colors hover:bg-accent hover:text-foreground" title="Voir">
												<Eye class="h-3.5 w-3.5" />
											</button>
											<button class="rounded-md p-1 text-muted transition-colors hover:bg-accent hover:text-foreground" title="Plus">
												<MoreHorizontal class="h-3.5 w-3.5" />
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				<div class="mt-4 flex items-center justify-between border-t border-border pt-3">
					<span class="text-xs text-muted-foreground">
						Affichage de {Math.min(pageSize, filteredSessions().length)} activités sur {filteredSessions().length}
					</span>
					<div class="flex items-center gap-1">
						<button
							class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
							onclick={() => { currentPage = Math.max(1, currentPage - 1); }}
							disabled={currentPage === 1}
						>
							<ChevronLeft class="h-3.5 w-3.5" />
						</button>
						{#each Array(Math.min(totalActivityPages, 3)) as _, i}
							<button
								class="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors {currentPage === i + 1 ? 'bg-primary text-white' : 'border border-border text-muted-foreground hover:bg-accent'}"
								onclick={() => { currentPage = i + 1; }}
							>
								{i + 1}
							</button>
						{/each}
						<button
							class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
							onclick={() => { currentPage = Math.min(totalActivityPages, currentPage + 1); }}
							disabled={currentPage >= totalActivityPages}
						>
							<ChevronRight class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
