<script lang="ts">
	import { onMount } from 'svelte';
	import { get, del } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import {
		AlertTriangle,
		Trash2,
		RefreshCw,
		ChevronDown,
		ChevronUp,
		CheckCircle2,
		Server,
		Monitor,
		Puzzle,
		Clock,
		Hash,
	} from 'lucide-svelte';

	// Types
	interface ErrorLog {
		id: string;
		source: 'backend' | 'frontend' | 'extension';
		level: 'error' | 'warn' | 'info';
		message: string;
		stack: string | null;
		endpoint: string | null;
		method: string | null;
		statusCode: number | null;
		userId: string | null;
		userAgent: string | null;
		metadata: any;
		createdAt: string;
	}

	interface ErrorLogStats {
		total: number;
		last24h: number;
		last7d: number;
		bySource: { source: string; count: number }[];
	}

	interface Pagination {
		total: number;
		limit: number;
		offset: number;
	}

	// State
	let stats = $state<ErrorLogStats | null>(null);
	let logs = $state<ErrorLog[]>([]);
	let pagination = $state<Pagination | null>(null);
	let loading = $state(true);
	let loadingMore = $state(false);
	let refreshing = $state(false);

	// Filters
	let sourceFilter = $state('all');
	let levelFilter = $state('all');

	// Expanded rows
	let expandedIds = $state<Set<string>>(new Set());

	// Derived
	let backendCount = $derived(stats?.bySource?.find((s: { source: string; count: number }) => s.source === 'backend')?.count ?? 0);
	let frontendCount = $derived(stats?.bySource?.find((s: { source: string; count: number }) => s.source === 'frontend')?.count ?? 0);
	let extensionCount = $derived(stats?.bySource?.find((s: { source: string; count: number }) => s.source === 'extension')?.count ?? 0);
	let hasMore = $derived(pagination !== null ? pagination.offset + pagination.limit < pagination.total : false);

	// Helpers
	function formatDateTime(dateStr: string): string {
		return new Date(dateStr).toLocaleString('fr-FR', {
			day: 'numeric',
			month: 'short',
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

		if (diffMin < 1) return "A l'instant";
		if (diffMin < 60) return `Il y a ${diffMin} min`;
		if (diffHours < 24) return `Il y a ${diffHours}h`;
		if (diffDays === 1) return 'Hier';
		if (diffDays < 7) return `Il y a ${diffDays} jours`;
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

	function truncateMessage(msg: string, maxLen: number = 80): string {
		if (msg.length <= maxLen) return msg;
		return msg.slice(0, maxLen) + '...';
	}

	function getSourceColor(source: string): string {
		switch (source) {
			case 'backend': return '#2B72EE';
			case 'frontend': return '#8B5CF6';
			case 'extension': return '#F18E2A';
			default: return '#9197A0';
		}
	}

	function getSourceBgClass(source: string): string {
		switch (source) {
			case 'backend': return 'bg-[#2B72EE]/10 text-[#2B72EE]';
			case 'frontend': return 'bg-[#8B5CF6]/10 text-[#8B5CF6]';
			case 'extension': return 'bg-[#F18E2A]/10 text-[#F18E2A]';
			default: return 'bg-muted text-muted-foreground';
		}
	}

	function getLevelBgClass(level: string): string {
		switch (level) {
			case 'error': return 'bg-[#F1362A]/10 text-[#F1362A]';
			case 'warn': return 'bg-[#F18E2A]/10 text-[#F18E2A]';
			case 'info': return 'bg-[#2B72EE]/10 text-[#2B72EE]';
			default: return 'bg-muted text-muted-foreground';
		}
	}

	function getSourceIcon(source: string) {
		switch (source) {
			case 'backend': return Server;
			case 'frontend': return Monitor;
			case 'extension': return Puzzle;
			default: return Server;
		}
	}

	function getSourceLabel(source: string): string {
		switch (source) {
			case 'backend': return 'Backend';
			case 'frontend': return 'Frontend';
			case 'extension': return 'Extension';
			default: return source;
		}
	}

	function toggleExpand(id: string) {
		const next = new Set(expandedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedIds = next;
	}

	function formatMetadata(metadata: any): string {
		if (!metadata) return '—';
		try {
			return JSON.stringify(metadata, null, 2);
		} catch {
			return String(metadata);
		}
	}

	// API calls
	function buildQueryParams(): string {
		const params = new URLSearchParams();
		if (sourceFilter !== 'all') params.set('source', sourceFilter);
		if (levelFilter !== 'all') params.set('level', levelFilter);
		params.set('limit', '50');
		return params.toString();
	}

	async function fetchStats() {
		try {
			const res = await get<{ data: ErrorLogStats }>('/error-logs/stats');
			stats = res.data;
		} catch (err) {
			console.error('Failed to load error log stats:', err);
		}
	}

	async function fetchLogs(append: boolean = false) {
		try {
			const params = new URLSearchParams();
			if (sourceFilter !== 'all') params.set('source', sourceFilter);
			if (levelFilter !== 'all') params.set('level', levelFilter);
			params.set('limit', '50');
			if (append && pagination) {
				params.set('offset', String(pagination.offset + pagination.limit));
			}

			const res = await get<{ data: ErrorLog[]; pagination: Pagination }>(`/error-logs?${params.toString()}`);

			if (append) {
				logs = [...logs, ...res.data];
			} else {
				logs = res.data;
			}
			pagination = res.pagination;
		} catch (err) {
			console.error('Failed to load error logs:', err);
		}
	}

	async function refresh() {
		refreshing = true;
		try {
			await Promise.all([fetchStats(), fetchLogs()]);
			toast.success('Journal actualis\u00e9');
		} catch {
			toast.error('Erreur lors du rafra\u00eechissement');
		} finally {
			refreshing = false;
		}
	}

	async function loadMore() {
		loadingMore = true;
		try {
			await fetchLogs(true);
		} finally {
			loadingMore = false;
		}
	}

	async function deleteLog(id: string) {
		try {
			await del(`/error-logs/${id}`);
			logs = logs.filter(l => l.id !== id);
			if (stats) {
				stats = { ...stats, total: stats.total - 1 };
			}
			toast.success('Entr\u00e9e supprim\u00e9e');
		} catch {
			toast.error('Erreur lors de la suppression');
		}
	}

	// Re-fetch logs when filters change
	$effect(() => {
		// Access filter values to track them
		const _s = sourceFilter;
		const _l = levelFilter;
		if (!loading) {
			fetchLogs();
		}
	});

	onMount(async () => {
		try {
			await Promise.all([fetchStats(), fetchLogs()]);
		} catch (err) {
			console.error('Error logs fetch error:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Journal des erreurs — Lemon Lab</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold text-foreground">Journal des erreurs</h2>
			<p class="text-sm text-muted-foreground">
				Consultez et g\u00e9rez les erreurs remont\u00e9es par le backend, le frontend et l'extension
			</p>
		</div>
		<Button
			variant="outline"
			size="sm"
			class="gap-1.5"
			onclick={refresh}
			disabled={refreshing}
		>
			<RefreshCw class="h-3.5 w-3.5 {refreshing ? 'animate-spin' : ''}" />
			Rafra\u00eechir
		</Button>
	</div>

	<!-- Stats cards -->
	<div class="grid gap-4 sm:grid-cols-4">
		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Total (7j)</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{stats?.last7d ?? 0}
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F1362A]/10">
						<AlertTriangle class="h-5 w-5 text-[#F1362A]" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Derni\u00e8res 24h</p>
						<p class="mt-1 text-2xl font-bold text-warning">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{stats?.last24h ?? 0}
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
						<Clock class="h-5 w-5 text-warning" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Par source</p>
						{#if loading}
							<span class="skeleton mt-1 inline-block h-8 w-24"></span>
						{:else}
							<div class="mt-1.5 flex items-center gap-3">
								<span class="inline-flex items-center gap-1 text-xs font-medium text-[#2B72EE]">
									<Server class="h-3 w-3" />
									{backendCount}
								</span>
								<span class="inline-flex items-center gap-1 text-xs font-medium text-[#8B5CF6]">
									<Monitor class="h-3 w-3" />
									{frontendCount}
								</span>
								<span class="inline-flex items-center gap-1 text-xs font-medium text-[#F18E2A]">
									<Puzzle class="h-3 w-3" />
									{extensionCount}
								</span>
							</div>
						{/if}
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Hash class="h-5 w-5 text-primary" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Total global</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{stats?.total ?? 0}
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
						<AlertTriangle class="h-5 w-5 text-muted-foreground" />
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Filters bar -->
	<div class="flex flex-wrap items-center gap-3">
		<!-- Source filter -->
		<div class="flex items-center gap-1.5">
			<span class="text-xs font-medium text-muted-foreground">Source :</span>
			<div class="flex items-center rounded-md border border-border">
				{#each [
					{ value: 'all', label: 'Tous' },
					{ value: 'backend', label: 'Backend' },
					{ value: 'frontend', label: 'Frontend' },
					{ value: 'extension', label: 'Extension' },
				] as option}
					<button
						class="px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md {sourceFilter === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}"
						onclick={() => { sourceFilter = option.value; }}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Level filter -->
		<div class="flex items-center gap-1.5">
			<span class="text-xs font-medium text-muted-foreground">Niveau :</span>
			<div class="flex items-center rounded-md border border-border">
				{#each [
					{ value: 'all', label: 'Tous' },
					{ value: 'error', label: 'Error' },
					{ value: 'warn', label: 'Warn' },
					{ value: 'info', label: 'Info' },
				] as option}
					<button
						class="px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md {levelFilter === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}"
						onclick={() => { levelFilter = option.value; }}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Error table -->
	{#if loading}
		<Card>
			<CardContent class="p-0">
				<div class="space-y-0">
					{#each Array(5) as _}
						<div class="flex items-center gap-4 border-b border-border p-4 last:border-0">
							<div class="skeleton h-5 w-16 rounded"></div>
							<div class="skeleton h-5 w-12 rounded"></div>
							<div class="flex-1">
								<div class="skeleton h-4 w-3/4"></div>
							</div>
							<div class="skeleton h-4 w-20"></div>
							<div class="skeleton h-4 w-12"></div>
						</div>
					{/each}
				</div>
			</CardContent>
		</Card>
	{:else if logs.length === 0}
		<Card>
			<CardContent class="flex flex-col items-center justify-center py-16">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
					<CheckCircle2 class="h-6 w-6 text-success" />
				</div>
				<p class="mt-4 text-sm font-medium text-foreground">Aucune erreur enregistr\u00e9e</p>
				<p class="mt-1 text-sm text-muted-foreground">
					{#if sourceFilter !== 'all' || levelFilter !== 'all'}
						Aucune erreur ne correspond aux filtres s\u00e9lectionn\u00e9s.
					{:else}
						Tout fonctionne correctement. Les erreurs appara\u00eetront ici.
					{/if}
				</p>
			</CardContent>
		</Card>
	{:else}
		<Card>
			<CardContent class="p-0">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-border">
								<th class="pb-2 pl-4 pt-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Date</th>
								<th class="pb-2 pt-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Source</th>
								<th class="pb-2 pt-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Niveau</th>
								<th class="pb-2 pt-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Message</th>
								<th class="pb-2 pt-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Endpoint</th>
								<th class="pb-2 pt-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Status</th>
								<th class="pb-2 pr-4 pt-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each logs as log}
								{@const isExpanded = expandedIds.has(log.id)}
								{@const SourceIcon = getSourceIcon(log.source)}
								<!-- Main row -->
								<tr
									class="cursor-pointer border-b border-border transition-colors hover:bg-accent {isExpanded ? 'bg-accent/50' : ''}"
									onclick={() => toggleExpand(log.id)}
								>
									<td class="py-2.5 pl-4 pr-2">
										<div>
											<p class="whitespace-nowrap text-xs text-foreground">{formatDateTime(log.createdAt)}</p>
											<p class="text-[10px] text-muted-foreground">{formatRelativeTime(log.createdAt)}</p>
										</div>
									</td>
									<td class="py-2.5 pr-2">
										<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium {getSourceBgClass(log.source)}">
											<SourceIcon class="h-3 w-3" />
											{getSourceLabel(log.source)}
										</span>
									</td>
									<td class="py-2.5 pr-2">
										<span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium {getLevelBgClass(log.level)}">
											{log.level}
										</span>
									</td>
									<td class="max-w-xs py-2.5 pr-2">
										<p class="truncate text-xs text-foreground" title={log.message}>{truncateMessage(log.message)}</p>
									</td>
									<td class="py-2.5 pr-2">
										{#if log.endpoint}
											<div class="flex items-center gap-1">
												{#if log.method}
													<span class="rounded bg-muted px-1 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">{log.method}</span>
												{/if}
												<span class="max-w-[160px] truncate font-mono text-[10px] text-muted-foreground">{log.endpoint}</span>
											</div>
										{:else}
											<span class="text-[10px] text-muted">—</span>
										{/if}
									</td>
									<td class="py-2.5 pr-2">
										{#if log.statusCode}
											<span class="font-mono text-xs {log.statusCode >= 500 ? 'font-semibold text-[#F1362A]' : log.statusCode >= 400 ? 'text-[#F18E2A]' : 'text-muted-foreground'}">{log.statusCode}</span>
										{:else}
											<span class="text-[10px] text-muted">—</span>
										{/if}
									</td>
									<td class="py-2.5 pr-4 text-right">
										<div class="flex items-center justify-end gap-1">
											<button
												class="rounded p-1 text-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
												title="Supprimer"
												onclick={(e) => { e.stopPropagation(); deleteLog(log.id); }}
											>
												<Trash2 class="h-3.5 w-3.5" />
											</button>
											{#if isExpanded}
												<ChevronUp class="h-3.5 w-3.5 text-muted" />
											{:else}
												<ChevronDown class="h-3.5 w-3.5 text-muted" />
											{/if}
										</div>
									</td>
								</tr>
								<!-- Expanded detail row -->
								{#if isExpanded}
									<tr class="border-b border-border bg-accent/30">
										<td colspan="7" class="px-4 py-3">
											<div class="space-y-3">
												<!-- Full message -->
												<div>
													<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Message complet</p>
													<p class="whitespace-pre-wrap rounded border border-border bg-background p-2 font-mono text-xs text-foreground">{log.message}</p>
												</div>

												<!-- Stack trace -->
												{#if log.stack}
													<div>
														<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Stack trace</p>
														<pre class="max-h-48 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">{log.stack}</pre>
													</div>
												{/if}

												<!-- Metadata grid -->
												<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
													{#if log.userId}
														<div>
															<p class="text-[10px] font-semibold uppercase tracking-wider text-muted">User ID</p>
															<p class="mt-0.5 font-mono text-xs text-foreground">{log.userId}</p>
														</div>
													{/if}
													{#if log.method}
														<div>
															<p class="text-[10px] font-semibold uppercase tracking-wider text-muted">M\u00e9thode</p>
															<p class="mt-0.5 font-mono text-xs text-foreground">{log.method}</p>
														</div>
													{/if}
													{#if log.endpoint}
														<div>
															<p class="text-[10px] font-semibold uppercase tracking-wider text-muted">Endpoint</p>
															<p class="mt-0.5 font-mono text-xs text-foreground">{log.endpoint}</p>
														</div>
													{/if}
													{#if log.statusCode}
														<div>
															<p class="text-[10px] font-semibold uppercase tracking-wider text-muted">Status code</p>
															<p class="mt-0.5 font-mono text-xs text-foreground">{log.statusCode}</p>
														</div>
													{/if}
													{#if log.userAgent}
														<div class="sm:col-span-2 lg:col-span-4">
															<p class="text-[10px] font-semibold uppercase tracking-wider text-muted">User agent</p>
															<p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={log.userAgent}>{log.userAgent}</p>
														</div>
													{/if}
												</div>

												<!-- Raw metadata JSON -->
												{#if log.metadata && Object.keys(log.metadata).length > 0}
													<div>
														<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Metadata (JSON)</p>
														<pre class="max-h-32 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">{formatMetadata(log.metadata)}</pre>
													</div>
												{/if}
											</div>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination info + load more -->
				{#if pagination}
					<div class="flex items-center justify-between border-t border-border px-4 py-3">
						<span class="text-xs text-muted-foreground">
							Affichage de {logs.length} sur {pagination.total} entr\u00e9es
						</span>
						{#if hasMore}
							<Button
								variant="outline"
								size="sm"
								class="gap-1.5 text-xs"
								onclick={loadMore}
								disabled={loadingMore}
							>
								{#if loadingMore}
									<RefreshCw class="h-3 w-3 animate-spin" />
									Chargement...
								{:else}
									Charger plus
								{/if}
							</Button>
						{/if}
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}
</div>
