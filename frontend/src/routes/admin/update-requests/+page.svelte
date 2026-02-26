<script lang="ts">
	import { onMount } from 'svelte';
	import { get, put } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import { Tabs, TabsList, TabsTrigger } from '$components/ui/tabs';
	import {
		RefreshCw,
		Clock,
		CheckCircle2,
		Loader2,
		FileText,
		User,
		Calendar,
		MessageSquare,
		ArrowRight,
		Search,
	} from 'lucide-svelte';

	interface UpdateRequest {
		id: string;
		pageId: string;
		requestedBy: string;
		comment: string;
		status: 'pending' | 'in_progress' | 'done';
		createdAt: string;
		resolvedAt: string | null;
		page: { id: string; title: string; urlPath: string };
		requestedByUser: { id: string; name: string; email: string };
	}

	let requests: UpdateRequest[] = $state([]);
	let loading = $state(true);
	let statusFilter = $state('all');
	let searchQuery = $state('');

	let filteredRequests = $derived.by(() => {
		let result = requests;
		if (statusFilter !== 'all') {
			result = result.filter(r => r.status === statusFilter);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(r =>
				r.comment.toLowerCase().includes(q) ||
				(r.page?.title ?? '').toLowerCase().includes(q) ||
				(r.page?.urlPath ?? '').toLowerCase().includes(q) ||
				(r.requestedByUser?.name ?? '').toLowerCase().includes(q)
			);
		}
		return result;
	});

	let pendingCount = $derived(requests.filter(r => r.status === 'pending').length);
	let inProgressCount = $derived(requests.filter(r => r.status === 'in_progress').length);
	let doneCount = $derived(requests.filter(r => r.status === 'done').length);

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
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

	function getStatusIcon(status: string) {
		switch (status) {
			case 'pending': return Clock;
			case 'in_progress': return Loader2;
			case 'done': return CheckCircle2;
			default: return Clock;
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'pending': return 'En attente';
			case 'in_progress': return 'En cours';
			case 'done': return 'Terminée';
			default: return status;
		}
	}

	function getStatusVariant(status: string): 'warning' | 'default' | 'success' {
		switch (status) {
			case 'pending': return 'warning';
			case 'in_progress': return 'default';
			case 'done': return 'success';
			default: return 'warning';
		}
	}

	function getNextStatus(status: string): 'in_progress' | 'done' | null {
		switch (status) {
			case 'pending': return 'in_progress';
			case 'in_progress': return 'done';
			default: return null;
		}
	}

	function getNextStatusLabel(status: string): string {
		switch (status) {
			case 'pending': return 'Prendre en charge';
			case 'in_progress': return 'Marquer terminée';
			default: return '';
		}
	}

	async function updateStatus(request: UpdateRequest, newStatus: string) {
		try {
			const res = await put<{ data: Partial<UpdateRequest> }>(`/update-requests/${request.id}`, {
				status: newStatus,
			});
			// Merge only scalar fields from response, preserve enriched page/requestedByUser
			requests = requests.map(r => r.id === request.id ? { ...r, status: res.data.status ?? r.status, resolvedAt: res.data.resolvedAt ?? r.resolvedAt } : r);
			const labels: Record<string, string> = { pending: 'En attente', in_progress: 'En cours', done: 'Terminée' };
			toast.success(`Demande passée en « ${labels[newStatus] || newStatus} »`);
		} catch (err) {
			toast.error('Erreur lors de la mise à jour');
		}
	}

	onMount(async () => {
		try {
			const res = await get<{ data: UpdateRequest[] }>('/update-requests');
			requests = res.data;
		} catch (err) {
			console.error('Failed to load update requests:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Demandes de mise à jour — Environnements Simulés</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-lg font-semibold text-foreground">Demandes de mise à jour</h2>
		<p class="text-sm text-muted-foreground">
			Suivez et traitez les demandes de mise à jour des pages capturées
		</p>
	</div>

	<!-- Stats cards -->
	<div class="grid gap-4 sm:grid-cols-3">
		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">En attente</p>
						<p class="mt-1 text-2xl font-bold text-warning">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{pendingCount}
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
						<p class="text-xs font-medium text-muted-foreground">En cours</p>
						<p class="mt-1 text-2xl font-bold text-primary">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{inProgressCount}
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Loader2 class="h-5 w-5 text-primary" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Terminées</p>
						<p class="mt-1 text-2xl font-bold text-success">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{doneCount}
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
						<CheckCircle2 class="h-5 w-5 text-success" />
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Filters -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<Tabs value={statusFilter} onValueChange={(v) => { statusFilter = v; }}>
			<TabsList>
				<TabsTrigger value="all">Toutes ({requests.length})</TabsTrigger>
				<TabsTrigger value="pending">En attente ({pendingCount})</TabsTrigger>
				<TabsTrigger value="in_progress">En cours ({inProgressCount})</TabsTrigger>
				<TabsTrigger value="done">Terminées ({doneCount})</TabsTrigger>
			</TabsList>
		</Tabs>

		<div class="relative w-full sm:w-64">
			<Search class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
			<Input bind:value={searchQuery} placeholder="Rechercher une demande..." class="pl-9" />
		</div>
	</div>

	<!-- Requests list -->
	{#if loading}
		<div class="space-y-3">
			{#each Array(4) as _}
				<Card>
					<CardContent class="p-4">
						<div class="flex items-start gap-4">
							<div class="skeleton h-10 w-10 rounded-lg"></div>
							<div class="flex-1 space-y-2">
								<div class="skeleton h-4 w-48"></div>
								<div class="skeleton h-3 w-72"></div>
								<div class="skeleton h-3 w-32"></div>
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{:else if filteredRequests.length === 0}
		<Card>
			<CardContent class="flex flex-col items-center justify-center py-16">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
					<RefreshCw class="h-6 w-6 text-muted" />
				</div>
				<p class="mt-4 text-sm font-medium text-foreground">
					{statusFilter !== 'all' ? 'Aucune demande dans ce statut' : 'Aucune demande de mise à jour'}
				</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Les demandes de mise à jour apparaîtront ici.
				</p>
			</CardContent>
		</Card>
	{:else}
		<div class="space-y-3">
			{#each filteredRequests as request}
				{@const StatusIcon = getStatusIcon(request.status)}
				{@const nextStatus = getNextStatus(request.status)}
				<Card class="transition-shadow hover:shadow-md">
					<CardContent class="p-4">
						<div class="flex items-start gap-4">
							<!-- Status icon -->
							<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {request.status === 'pending' ? 'bg-warning/10' : request.status === 'in_progress' ? 'bg-primary/10' : 'bg-success/10'}">
								<StatusIcon class="h-5 w-5 {request.status === 'pending' ? 'text-warning' : request.status === 'in_progress' ? 'text-primary' : 'text-success'}" />
							</div>

							<!-- Content -->
							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between gap-4">
									<div>
										<div class="flex items-center gap-2">
											<Badge variant={getStatusVariant(request.status)}>
												{getStatusLabel(request.status)}
											</Badge>
											<span class="text-xs text-muted-foreground">{formatRelativeTime(request.createdAt)}</span>
										</div>
										<p class="mt-2 text-sm text-foreground">{request.comment}</p>
									</div>
									{#if nextStatus}
										<Button
											variant="outline"
											size="sm"
											class="shrink-0 gap-1.5"
											onclick={() => updateStatus(request, nextStatus)}
										>
											{getNextStatusLabel(request.status)}
											<ArrowRight class="h-3 w-3" />
										</Button>
									{/if}
								</div>

								<!-- Metadata -->
								<div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
									<span class="inline-flex items-center gap-1">
										<FileText class="h-3 w-3" />
										{request.page?.title ?? 'Page inconnue'}
										{#if request.page?.urlPath}
											<span class="text-muted">— /{request.page.urlPath}</span>
										{/if}
									</span>
									<span class="inline-flex items-center gap-1">
										<User class="h-3 w-3" />
										{request.requestedByUser?.name ?? 'Utilisateur inconnu'}
									</span>
									<span class="inline-flex items-center gap-1">
										<Calendar class="h-3 w-3" />
										{formatDate(request.createdAt)}
									</span>
									{#if request.resolvedAt}
										<span class="inline-flex items-center gap-1 text-success">
											<CheckCircle2 class="h-3 w-3" />
											Résolue le {formatDate(request.resolvedAt)}
										</span>
									{/if}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{/if}
</div>
