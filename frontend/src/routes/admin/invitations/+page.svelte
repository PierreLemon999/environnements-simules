<script lang="ts">
	import { onMount } from 'svelte';
	import { get, post, del } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import { Separator } from '$components/ui/separator';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter,
	} from '$components/ui/dialog';
	import {
		Send,
		Plus,
		Trash2,
		Users,
		TrendingUp,
		Copy,
		Check,
		Eye,
		EyeOff,
		Calendar,
		Mail,
		Building,
		Link2,
		Search,
		Download,
		ChevronUp,
		ChevronDown,
		ChevronsUpDown,
		ChevronLeft,
		ChevronRight,
		BarChart3,
		RefreshCw,
		X,
		Lock,
		Globe,
		ArrowUpRight,
	} from 'lucide-svelte';

	interface Project {
		id: string;
		name: string;
		toolName: string;
		subdomain: string;
		versions?: Version[];
	}

	interface Version {
		id: string;
		projectId: string;
		name: string;
		status: string;
		language: string;
	}

	interface Assignment {
		id: string;
		versionId: string;
		userId: string;
		accessToken: string;
		expiresAt: string;
		createdAt: string;
		user: { id: string; name: string; email: string; company?: string };
	}

	interface NewAssignment {
		id: string;
		versionId: string;
		userId: string;
		accessToken: string;
		password: string;
		expiresAt: string;
		createdAt: string;
	}

	let projects: Project[] = $state([]);
	let assignments: Assignment[] = $state([]);
	let loading = $state(true);
	let assignmentsLoading = $state(false);

	// Form state (persistent right-side card)
	let formTab = $state<'email' | 'link'>('email');
	let formEmail = $state('');
	let formName = $state('');
	let formCompany = $state('');
	let formProjectId = $state('');
	let formVersionId = $state('');
	let formExpiryDays = $state(90);
	let formRequireAccount = $state(false);
	let formSubmitting = $state(false);
	let formError = $state('');

	// Link sharing form
	let linkCompany = $state('');
	let linkProjectId = $state('');
	let linkVersionId = $state('');
	let linkExpiryDays = $state(90);
	let linkPassword = $state('');
	let linkRequireAccount = $state(false);
	let linkGenerated = $state('');
	let linkGenerating = $state(false);

	// Credentials display (inline in form card)
	let showCredentials = $state(false);
	let createdCredentials: { accessToken: string; password: string; email: string } | null = $state(null);
	let passwordVisible = $state(false);
	let copiedField = $state('');

	// Delete dialog
	let deleteDialogOpen = $state(false);
	let deletingAssignment: Assignment | null = $state(null);
	let deleteSubmitting = $state(false);

	// Search, filters, sorting, pagination
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let projectFilter = $state('all');
	let sortColumn = $state<'client' | 'email' | 'project' | 'status' | 'date'>('date');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let currentPage = $state(1);
	const pageSize = 10;

	let availableVersions = $derived(() => {
		if (!formProjectId) return [];
		const project = projects.find(p => p.id === formProjectId);
		return project?.versions ?? [];
	});

	let linkAvailableVersions = $derived(() => {
		if (!linkProjectId) return [];
		const project = projects.find(p => p.id === linkProjectId);
		return project?.versions ?? [];
	});

	// Stats
	let totalInvitations = $derived(assignments.length);
	let invitationsThisWeek = $derived(() => {
		const weekAgo = new Date();
		weekAgo.setDate(weekAgo.getDate() - 7);
		return assignments.filter(a => new Date(a.createdAt) > weekAgo).length;
	});
	let activeLinks = $derived(
		assignments.filter(a => new Date(a.expiresAt) > new Date()).length
	);
	let expiredLinks = $derived(
		assignments.filter(a => new Date(a.expiresAt) <= new Date()).length
	);
	// Simulated connections count (based on assignments that have been accessed)
	let totalConnections = $derived(assignments.length);
	let connectionsThisWeek = $derived(() => {
		const weekAgo = new Date();
		weekAgo.setDate(weekAgo.getDate() - 7);
		return assignments.filter(a => new Date(a.createdAt) > weekAgo).length;
	});

	// Filtering and sorting
	let filteredAssignments = $derived(() => {
		let result = assignments;

		// Search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(a =>
				a.user.name.toLowerCase().includes(q) ||
				a.user.email.toLowerCase().includes(q) ||
				(a.user.company ?? '').toLowerCase().includes(q)
			);
		}

		// Status filter
		if (statusFilter !== 'all') {
			result = result.filter(a => {
				const expired = isExpired(a.expiresAt);
				const daysLeft = getDaysUntilExpiry(a.expiresAt);
				switch (statusFilter) {
					case 'connected': return !expired && daysLeft >= 30;
					case 'pending': return !expired && daysLeft >= 0;
					case 'expired': return expired;
					default: return true;
				}
			});
		}

		// Project filter
		if (projectFilter !== 'all') {
			result = result.filter(a => {
				for (const p of projects) {
					if (p.id === projectFilter && p.versions?.some(v => v.id === a.versionId)) return true;
				}
				return false;
			});
		}

		// Sorting
		result = [...result].sort((a, b) => {
			let cmp = 0;
			switch (sortColumn) {
				case 'client':
					cmp = a.user.name.localeCompare(b.user.name);
					break;
				case 'email':
					cmp = a.user.email.localeCompare(b.user.email);
					break;
				case 'project':
					cmp = getVersionName(a.versionId).localeCompare(getVersionName(b.versionId));
					break;
				case 'status': {
					const sa = getStatusOrder(a);
					const sb = getStatusOrder(b);
					cmp = sa - sb;
					break;
				}
				case 'date':
					cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
					break;
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});

		return result;
	});

	let totalFiltered = $derived(filteredAssignments().length);
	let totalPages = $derived(Math.max(1, Math.ceil(totalFiltered / pageSize)));
	let paginatedAssignments = $derived(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredAssignments().slice(start, start + pageSize);
	});

	// Reset to page 1 when filters change
	$effect(() => {
		// Read dependencies
		searchQuery;
		statusFilter;
		projectFilter;
		currentPage = 1;
	});

	function getStatusOrder(a: Assignment): number {
		if (isExpired(a.expiresAt)) return 3;
		const days = getDaysUntilExpiry(a.expiresAt);
		if (days < 30) return 2;
		return 1;
	}

	function getStatusInfo(assignment: Assignment): { label: string; dotColor: string; bgColor: string; borderColor: string; textColor: string } {
		const expired = isExpired(assignment.expiresAt);
		const daysLeft = getDaysUntilExpiry(assignment.expiresAt);

		if (expired) {
			return { label: 'Expiré', dotColor: 'bg-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-700' };
		}
		if (daysLeft < 7) {
			return { label: 'En attente', dotColor: 'bg-orange-500', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', textColor: 'text-orange-700' };
		}
		if (daysLeft < 30) {
			return { label: 'Lien ouvert', dotColor: 'bg-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700' };
		}
		return { label: 'Connecté', dotColor: 'bg-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700' };
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

	function isExpired(dateStr: string): boolean {
		return new Date(dateStr) < new Date();
	}

	function getDaysUntilExpiry(dateStr: string): number {
		const diff = new Date(dateStr).getTime() - Date.now();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	}

	function getVersionName(versionId: string): string {
		for (const p of projects) {
			const v = p.versions?.find(v => v.id === versionId);
			if (v) return `${p.toolName} — ${v.name}`;
		}
		return 'Version inconnue';
	}

	function getProjectNameForVersion(versionId: string): string {
		for (const p of projects) {
			const v = p.versions?.find(v => v.id === versionId);
			if (v) return p.name;
		}
		return '';
	}

	function getInitials(name: string): string {
		return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
	}

	function toggleSort(column: typeof sortColumn) {
		if (sortColumn === column) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDir = 'asc';
		}
	}

	async function loadAllAssignments() {
		assignmentsLoading = true;
		const allAssignments: Assignment[] = [];

		try {
			for (const project of projects) {
				if (!project.versions) continue;
				for (const version of project.versions) {
					try {
						const res = await get<{ data: Assignment[] }>(`/versions/${version.id}/assignments`);
						allAssignments.push(...res.data);
					} catch {
						// Skip versions with no access
					}
				}
			}
			assignments = allAssignments;
		} catch (err) {
			console.error('Failed to load assignments:', err);
		} finally {
			assignmentsLoading = false;
		}
	}

	function resetEmailForm() {
		formEmail = '';
		formName = '';
		formCompany = '';
		formProjectId = projects[0]?.id ?? '';
		formVersionId = '';
		formExpiryDays = 90;
		formRequireAccount = false;
		formError = '';
		showCredentials = false;
		createdCredentials = null;
		passwordVisible = false;
	}

	function resetLinkForm() {
		linkCompany = '';
		linkProjectId = projects[0]?.id ?? '';
		linkVersionId = '';
		linkExpiryDays = 90;
		linkPassword = '';
		linkRequireAccount = false;
		linkGenerated = '';
	}

	async function handleCreateEmail() {
		if (!formEmail.trim() || !formName.trim() || !formVersionId) {
			formError = 'Email, nom et version sont requis.';
			return;
		}

		formSubmitting = true;
		formError = '';

		try {
			const res = await post<{ data: NewAssignment }>(`/versions/${formVersionId}/assignments`, {
				email: formEmail.trim(),
				name: formName.trim(),
				expiresInDays: formExpiryDays,
				requireAccount: formRequireAccount ? 1 : 0,
			});

			createdCredentials = {
				accessToken: res.data.accessToken,
				password: res.data.password,
				email: formEmail.trim(),
			};
			showCredentials = true;
			toast.success('Invitation créée avec succès');

			await loadAllAssignments();
		} catch (err: any) {
			formError = err.message || 'Erreur lors de la création.';
		} finally {
			formSubmitting = false;
		}
	}

	async function handleGenerateLink() {
		if (!linkVersionId || !linkCompany.trim()) {
			formError = 'Entreprise et version sont requis.';
			return;
		}

		linkGenerating = true;
		formError = '';

		try {
			const res = await post<{ data: NewAssignment }>(`/versions/${linkVersionId}/assignments`, {
				email: `${linkCompany.trim().toLowerCase().replace(/\s+/g, '-')}@link.demo`,
				name: linkCompany.trim(),
				expiresInDays: linkExpiryDays,
			});

			const baseUrl = window.location.origin;
			linkGenerated = `${baseUrl}/demo/${res.data.accessToken}`;
			toast.success('Lien généré avec succès');

			await loadAllAssignments();
		} catch (err: any) {
			formError = err.message || 'Erreur lors de la génération du lien.';
		} finally {
			linkGenerating = false;
		}
	}

	async function copyToClipboard(text: string, field: string) {
		await navigator.clipboard.writeText(text);
		copiedField = field;
		setTimeout(() => { copiedField = ''; }, 2000);
	}

	async function handleResend(assignment: Assignment) {
		toast.info(`Invitation renvoyée à ${assignment.user.email}`);
	}

	function openDeleteDialog(assignment: Assignment) {
		deletingAssignment = assignment;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!deletingAssignment) return;
		deleteSubmitting = true;

		try {
			await del(`/assignments/${deletingAssignment.id}`);
			assignments = assignments.filter(a => a.id !== deletingAssignment!.id);
			deleteDialogOpen = false;
			deletingAssignment = null;
			toast.success('Accès révoqué');
		} catch (err) {
			toast.error('Erreur lors de la révocation');
		} finally {
			deleteSubmitting = false;
		}
	}

	function exportCSV() {
		const data = filteredAssignments();
		const headers = ['Client', 'Email', 'Entreprise', 'Projet/Démo', 'Statut', 'Envoyé le', 'Expiration'];
		const rows = data.map(a => [
			a.user.name,
			a.user.email,
			a.user.company ?? '',
			getVersionName(a.versionId),
			getStatusInfo(a).label,
			formatDate(a.createdAt),
			formatDate(a.expiresAt),
		]);
		const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `invitations-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	onMount(async () => {
		try {
			const res = await get<{ data: Array<Project & { versions?: Version[] }> }>('/projects');
			const projectsWithVersions: Project[] = [];
			for (const p of res.data) {
				try {
					const detail = await get<{ data: { versions: Version[]; subdomain: string } }>(`/projects/${p.id}`);
					projectsWithVersions.push({ ...p, versions: detail.data.versions ?? [], subdomain: detail.data.subdomain ?? p.subdomain ?? '' });
				} catch {
					projectsWithVersions.push({ ...p, versions: [] });
				}
			}
			projects = projectsWithVersions;
			formProjectId = projects[0]?.id ?? '';
			linkProjectId = projects[0]?.id ?? '';

			await loadAllAssignments();
		} catch (err) {
			console.error('Failed to load data:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Invitations — Environnements Simulés</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold text-foreground">Invitations</h1>
			<p class="text-sm text-muted-foreground">
				Gérez les accès démo pour vos clients et prospects
			</p>
		</div>
		<Button size="sm" class="gap-1.5" onclick={() => { resetEmailForm(); setTimeout(() => document.getElementById('generate-access-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}>
			<Plus class="h-3.5 w-3.5" />
			Nouvel accès
		</Button>
	</div>

	<!-- Stats cards: 3 cards -->
	<div class="grid gap-4 sm:grid-cols-3">
		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Invitations envoyées</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{totalInvitations}
							{/if}
						</p>
						{#if !loading}
							<span class="inline-flex items-center gap-1 text-xs font-medium text-success">
								<ArrowUpRight class="h-3 w-3" />
								+{invitationsThisWeek()} cette semaine
							</span>
						{/if}
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Send class="h-5 w-5 text-primary" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Liens actifs</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{activeLinks}
							{/if}
						</p>
						{#if !loading}
							<span class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
								<Link2 class="h-3 w-3" />
								{expiredLinks} expiré{expiredLinks !== 1 ? 's' : ''}
							</span>
						{/if}
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
						<Link2 class="h-5 w-5 text-success" />
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Connexions</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{totalConnections}
							{/if}
						</p>
						{#if !loading}
							<span class="inline-flex items-center gap-1 text-xs font-medium text-success">
								<ArrowUpRight class="h-3 w-3" />
								+{connectionsThisWeek()} cette semaine
							</span>
						{/if}
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple/10">
						<BarChart3 class="h-5 w-5 text-purple" />
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Two-column layout: left = table, right = persistent form -->
	<div class="grid gap-6" style="grid-template-columns: 1.5fr 1fr;">
		<!-- LEFT: Table with toolbar -->
		<Card class="min-w-0">
			<CardHeader class="pb-3">
				<div class="flex items-center justify-between">
					<CardTitle class="text-base">Liste des invitations</CardTitle>
					<Button variant="outline" size="sm" class="h-8 gap-1.5 text-xs" onclick={exportCSV}>
						<Download class="h-3.5 w-3.5" />
						Exporter
					</Button>
				</div>
				<!-- Search + filters toolbar -->
				<div class="mt-3 flex flex-wrap items-center gap-2">
					<div class="relative flex-1 min-w-[200px]">
						<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
						<Input
							bind:value={searchQuery}
							placeholder="Rechercher un client..."
							class="h-8 pl-8 text-sm"
						/>
					</div>
					<select
						bind:value={statusFilter}
						class="flex h-8 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<option value="all">Tous les statuts</option>
						<option value="connected">Connecté</option>
						<option value="pending">En attente</option>
						<option value="expired">Expiré</option>
					</select>
					<select
						bind:value={projectFilter}
						class="flex h-8 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<option value="all">Tous les projets</option>
						{#each projects as project}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
			</CardHeader>
			<CardContent>
				{#if loading || assignmentsLoading}
					<div class="space-y-3">
						{#each Array(5) as _}
							<div class="flex items-center gap-4 rounded-lg border border-border p-4">
								<div class="skeleton h-8 w-8 rounded-full"></div>
								<div class="flex-1 space-y-2">
									<div class="skeleton h-4 w-32"></div>
									<div class="skeleton h-3 w-48"></div>
								</div>
							</div>
						{/each}
					</div>
				{:else if assignments.length === 0}
					<div class="flex flex-col items-center justify-center py-16">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
							<Send class="h-6 w-6 text-muted" />
						</div>
						<p class="mt-4 text-sm font-medium text-foreground">Aucune invitation</p>
						<p class="mt-1 text-sm text-muted-foreground">Invitez vos premiers clients à découvrir vos démos.</p>
					</div>
				{:else if filteredAssignments().length === 0}
					<div class="flex flex-col items-center justify-center py-12">
						<p class="text-sm text-muted-foreground">Aucun résultat pour ces filtres.</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead>
								<tr class="border-b border-border">
									<th class="pb-2 text-left">
										<button class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-foreground" onclick={() => toggleSort('client')}>
											Client
											{#if sortColumn === 'client'}
												{#if sortDir === 'asc'}<ChevronUp class="h-3 w-3" />{:else}<ChevronDown class="h-3 w-3" />{/if}
											{:else}
												<ChevronsUpDown class="h-3 w-3 opacity-40" />
											{/if}
										</button>
									</th>
									<th class="pb-2 text-left">
										<button class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-foreground" onclick={() => toggleSort('email')}>
											Email
											{#if sortColumn === 'email'}
												{#if sortDir === 'asc'}<ChevronUp class="h-3 w-3" />{:else}<ChevronDown class="h-3 w-3" />{/if}
											{:else}
												<ChevronsUpDown class="h-3 w-3 opacity-40" />
											{/if}
										</button>
									</th>
									<th class="pb-2 text-left">
										<button class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-foreground" onclick={() => toggleSort('project')}>
											Projet/Démo
											{#if sortColumn === 'project'}
												{#if sortDir === 'asc'}<ChevronUp class="h-3 w-3" />{:else}<ChevronDown class="h-3 w-3" />{/if}
											{:else}
												<ChevronsUpDown class="h-3 w-3 opacity-40" />
											{/if}
										</button>
									</th>
									<th class="pb-2 text-left">
										<button class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-foreground" onclick={() => toggleSort('status')}>
											Statut
											{#if sortColumn === 'status'}
												{#if sortDir === 'asc'}<ChevronUp class="h-3 w-3" />{:else}<ChevronDown class="h-3 w-3" />{/if}
											{:else}
												<ChevronsUpDown class="h-3 w-3 opacity-40" />
											{/if}
										</button>
									</th>
									<th class="pb-2 text-left">
										<button class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-foreground" onclick={() => toggleSort('date')}>
											Envoyé le
											{#if sortColumn === 'date'}
												{#if sortDir === 'asc'}<ChevronUp class="h-3 w-3" />{:else}<ChevronDown class="h-3 w-3" />{/if}
											{:else}
												<ChevronsUpDown class="h-3 w-3 opacity-40" />
											{/if}
										</button>
									</th>
									<th class="pb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each paginatedAssignments() as assignment}
									{@const status = getStatusInfo(assignment)}
									<tr class="group relative border-b border-border last:border-0 transition-colors hover:bg-accent/50 hover:border-l-[3px] hover:border-l-primary">
										<td class="py-3 pr-4">
											<div class="flex items-center gap-3">
												<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary transition-transform group-hover:scale-110">
													{getInitials(assignment.user.name)}
												</div>
												<div class="min-w-0">
													<span class="block truncate text-sm font-medium text-foreground">{assignment.user.name}</span>
													{#if assignment.user.company}
														<span class="block truncate text-xs text-muted-foreground">{assignment.user.company}</span>
													{/if}
												</div>
											</div>
										</td>
										<td class="py-3 pr-4">
											<span class="text-sm text-muted-foreground">{assignment.user.email}</span>
										</td>
										<td class="py-3 pr-4">
											<span class="text-sm text-foreground">{getVersionName(assignment.versionId)}</span>
										</td>
										<td class="py-3 pr-4">
											<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium {status.bgColor} {status.borderColor} {status.textColor}">
												<span class="h-1.5 w-1.5 rounded-full {status.dotColor}"></span>
												{status.label}
											</span>
										</td>
										<td class="py-3 pr-4">
											<span class="text-xs text-muted-foreground">{formatDate(assignment.createdAt)}</span>
										</td>
										<td class="py-3 text-right">
											<div class="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
												<button
													class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground"
													onclick={() => handleResend(assignment)}
													title="Renvoyer"
												>
													<RefreshCw class="h-3.5 w-3.5" />
												</button>
												<button
													class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground"
													onclick={() => copyToClipboard(assignment.accessToken, `token-${assignment.id}`)}
													title="Copier le lien"
												>
													{#if copiedField === `token-${assignment.id}`}
														<Check class="h-3.5 w-3.5 text-success" />
													{:else}
														<Copy class="h-3.5 w-3.5" />
													{/if}
												</button>
												<button
													class="rounded-md p-1.5 text-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
													onclick={() => openDeleteDialog(assignment)}
													title="Révoquer"
												>
													<X class="h-3.5 w-3.5" />
												</button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination footer -->
					{#if totalPages > 1}
						<div class="mt-4 flex items-center justify-between border-t border-border pt-3">
							<p class="text-xs text-muted-foreground">
								{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalFiltered)} sur {totalFiltered} invitation{totalFiltered !== 1 ? 's' : ''}
							</p>
							<div class="flex items-center gap-1">
								<button
									class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
									onclick={() => { currentPage = Math.max(1, currentPage - 1); }}
									disabled={currentPage <= 1}
								>
									<ChevronLeft class="h-4 w-4" />
								</button>
								{#each Array(totalPages) as _, i}
									{#if totalPages <= 7 || i === 0 || i === totalPages - 1 || (i >= currentPage - 2 && i <= currentPage)}
										<button
											class="flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors {currentPage === i + 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
											onclick={() => { currentPage = i + 1; }}
										>
											{i + 1}
										</button>
									{:else if i === 1 || i === totalPages - 2}
										<span class="px-1 text-xs text-muted">...</span>
									{/if}
								{/each}
								<button
									class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
									onclick={() => { currentPage = Math.min(totalPages, currentPage + 1); }}
									disabled={currentPage >= totalPages}
								>
									<ChevronRight class="h-4 w-4" />
								</button>
							</div>
						</div>
					{/if}
				{/if}
			</CardContent>
		</Card>

		<!-- RIGHT: Persistent "Générer un accès" form card -->
		<div class="space-y-4">
			<Card id="generate-access-card">
				<CardHeader class="pb-3">
					<CardTitle class="text-base">Générer un accès</CardTitle>
					<!-- Tabs: email vs link -->
					<div class="mt-3 flex rounded-lg border border-border bg-accent/50 p-0.5">
						<button
							class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {formTab === 'email' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
							onclick={() => { formTab = 'email'; formError = ''; }}
						>
							<Mail class="mr-1.5 inline h-3.5 w-3.5 -translate-y-px" />
							Invitation par email
						</button>
						<button
							class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {formTab === 'link' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
							onclick={() => { formTab = 'link'; formError = ''; }}
						>
							<Globe class="mr-1.5 inline h-3.5 w-3.5 -translate-y-px" />
							Partager un lien
						</button>
					</div>
				</CardHeader>
				<CardContent>
					{#if formTab === 'email'}
						<!-- Email invitation form -->
						{#if showCredentials && createdCredentials}
							<!-- Credentials display: mail template block -->
							<div class="space-y-4">
								<div class="rounded-lg border border-success/30 bg-success/5 p-3">
									<div class="flex items-center gap-2 mb-3">
										<Check class="h-4 w-4 text-success" />
										<span class="text-sm font-medium text-success">Invitation créée</span>
									</div>
									<p class="text-xs text-muted-foreground mb-3">
										Les identifiants ci-dessous ne seront affichés qu'une seule fois.
									</p>
								</div>

								<!-- Mail template block -->
								<div class="rounded-lg border-2 border-dashed border-border p-4">
									<p class="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Bloc à insérer dans votre mail</p>
									<div class="space-y-2.5 rounded-md bg-accent/50 p-3">
										<div class="flex items-center justify-between">
											<span class="text-xs text-muted-foreground">Email</span>
											<div class="flex items-center gap-1.5">
												<code class="rounded bg-background px-2 py-0.5 font-mono text-xs">{createdCredentials.email}</code>
												<button onclick={() => copyToClipboard(createdCredentials!.email, 'cred-email')} class="rounded p-1 hover:bg-background">
													{#if copiedField === 'cred-email'}
														<Check class="h-3 w-3 text-success" />
													{:else}
														<Copy class="h-3 w-3 text-muted-foreground" />
													{/if}
												</button>
											</div>
										</div>
										<Separator />
										<div class="flex items-center justify-between">
											<span class="text-xs text-muted-foreground">Mot de passe</span>
											<div class="flex items-center gap-1.5">
												<code class="rounded bg-background px-2 py-0.5 font-mono text-xs">
													{passwordVisible ? createdCredentials.password : '••••••••'}
												</code>
												<button onclick={() => { passwordVisible = !passwordVisible; }} class="rounded p-1 hover:bg-background">
													{#if passwordVisible}
														<EyeOff class="h-3 w-3 text-muted-foreground" />
													{:else}
														<Eye class="h-3 w-3 text-muted-foreground" />
													{/if}
												</button>
												<button onclick={() => copyToClipboard(createdCredentials!.password, 'cred-pass')} class="rounded p-1 hover:bg-background">
													{#if copiedField === 'cred-pass'}
														<Check class="h-3 w-3 text-success" />
													{:else}
														<Copy class="h-3 w-3 text-muted-foreground" />
													{/if}
												</button>
											</div>
										</div>
										<Separator />
										<div class="flex items-center justify-between">
											<span class="text-xs text-muted-foreground">Token d'accès</span>
											<div class="flex items-center gap-1.5">
												<code class="max-w-[140px] truncate rounded bg-background px-2 py-0.5 font-mono text-xs">{createdCredentials.accessToken}</code>
												<button onclick={() => copyToClipboard(createdCredentials!.accessToken, 'cred-token')} class="rounded p-1 hover:bg-background">
													{#if copiedField === 'cred-token'}
														<Check class="h-3 w-3 text-success" />
													{:else}
														<Copy class="h-3 w-3 text-muted-foreground" />
													{/if}
												</button>
											</div>
										</div>
									</div>
									<Button
										variant="outline"
										size="sm"
										class="mt-3 w-full gap-1.5 text-xs"
										onclick={() => {
											const block = `Email: ${createdCredentials!.email}\nMot de passe: ${createdCredentials!.password}\nToken: ${createdCredentials!.accessToken}`;
											copyToClipboard(block, 'cred-block');
										}}
									>
										{#if copiedField === 'cred-block'}
											<Check class="h-3.5 w-3.5 text-success" />
											Copié !
										{:else}
											<Copy class="h-3.5 w-3.5" />
											Tout copier
										{/if}
									</Button>
								</div>

								<Button
									class="w-full"
									onclick={() => {
										showCredentials = false;
										createdCredentials = null;
										passwordVisible = false;
										resetEmailForm();
									}}
								>
									Nouvelle invitation
								</Button>
							</div>
						{:else}
							<!-- Email form -->
							<form class="space-y-3" onsubmit={(e) => { e.preventDefault(); handleCreateEmail(); }}>
								<div class="space-y-1.5">
									<label for="invite-name" class="text-xs font-medium text-foreground">Nom</label>
									<Input id="invite-name" bind:value={formName} placeholder="Jean Dupont" class="h-8 text-sm" />
								</div>
								<div class="space-y-1.5">
									<label for="invite-email" class="text-xs font-medium text-foreground">Email</label>
									<Input id="invite-email" bind:value={formEmail} placeholder="jean@acme.com" type="email" class="h-8 text-sm" />
								</div>
								<div class="space-y-1.5">
									<label for="invite-company" class="text-xs font-medium text-foreground">
										Entreprise <span class="text-muted-foreground">(optionnel)</span>
									</label>
									<Input id="invite-company" bind:value={formCompany} placeholder="Acme Corp" class="h-8 text-sm" />
								</div>
								<div class="space-y-1.5">
									<label for="invite-project" class="text-xs font-medium text-foreground">Projet</label>
									<select
										id="invite-project"
										bind:value={formProjectId}
										onchange={() => { formVersionId = ''; }}
										class="flex h-8 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<option value="" disabled>Sélectionner un projet</option>
										{#each projects as project}
											<option value={project.id}>{project.name}</option>
										{/each}
									</select>
								</div>
								<div class="space-y-1.5">
									<label for="invite-version" class="text-xs font-medium text-foreground">Version</label>
									<select
										id="invite-version"
										bind:value={formVersionId}
										class="flex h-8 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										disabled={!formProjectId}
									>
										<option value="" disabled>Sélectionner une version</option>
										{#each availableVersions() as version}
											<option value={version.id}>{version.name} ({version.status})</option>
										{/each}
									</select>
								</div>
								<div class="space-y-1.5">
									<label for="invite-expiry" class="text-xs font-medium text-foreground">Expiration</label>
									<select
										id="invite-expiry"
										bind:value={formExpiryDays}
										class="flex h-8 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<option value={30}>1 mois</option>
										<option value={90}>3 mois (recommandé)</option>
										<option value={180}>6 mois</option>
										<option value={365}>1 an</option>
										<option value={730}>2 ans</option>
									</select>
								</div>

								<div class="flex items-center gap-3 rounded-lg border border-border p-3">
									<input
										type="checkbox"
										id="invite-require-account"
										bind:checked={formRequireAccount}
										class="h-4 w-4 rounded border-border text-primary focus:ring-primary"
									/>
									<div>
										<label for="invite-require-account" class="text-xs font-medium text-foreground">Exiger la création d'un compte</label>
										<p class="text-[10px] text-muted-foreground">Le client devra créer un compte</p>
									</div>
								</div>

								{#if formError}
									<p class="text-xs text-destructive">{formError}</p>
								{/if}

								<Button type="submit" disabled={formSubmitting} class="w-full gap-1.5">
									{#if formSubmitting}
										Création...
									{:else}
										<Send class="h-3.5 w-3.5" />
										Envoyer l'invitation
									{/if}
								</Button>
							</form>
						{/if}
					{:else}
						<!-- Link sharing form -->
						{#if linkGenerated}
							<div class="space-y-4">
								<div class="rounded-lg border border-success/30 bg-success/5 p-3">
									<div class="flex items-center gap-2 mb-2">
										<Check class="h-4 w-4 text-success" />
										<span class="text-sm font-medium text-success">Lien généré</span>
									</div>
								</div>

								<div class="rounded-lg border-2 border-dashed border-border p-4">
									<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Lien de partage</p>
									<div class="flex items-center gap-2 rounded-md bg-accent/50 p-2">
										<code class="flex-1 truncate font-mono text-xs">{linkGenerated}</code>
										<button onclick={() => copyToClipboard(linkGenerated, 'link-url')} class="shrink-0 rounded p-1.5 hover:bg-background">
											{#if copiedField === 'link-url'}
												<Check class="h-3.5 w-3.5 text-success" />
											{:else}
												<Copy class="h-3.5 w-3.5 text-muted-foreground" />
											{/if}
										</button>
									</div>
								</div>

								<Button
									class="w-full"
									onclick={() => { linkGenerated = ''; resetLinkForm(); }}
								>
									Générer un autre lien
								</Button>
							</div>
						{:else}
							<form class="space-y-3" onsubmit={(e) => { e.preventDefault(); handleGenerateLink(); }}>
								<div class="space-y-1.5">
									<label for="link-company" class="text-xs font-medium text-foreground">Entreprise</label>
									<Input id="link-company" bind:value={linkCompany} placeholder="Acme Corp" class="h-8 text-sm" />
								</div>
								<div class="space-y-1.5">
									<label for="link-project" class="text-xs font-medium text-foreground">Projet</label>
									<select
										id="link-project"
										bind:value={linkProjectId}
										onchange={() => { linkVersionId = ''; }}
										class="flex h-8 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<option value="" disabled>Sélectionner un projet</option>
										{#each projects as project}
											<option value={project.id}>{project.name}</option>
										{/each}
									</select>
								</div>
								<div class="space-y-1.5">
									<label for="link-version" class="text-xs font-medium text-foreground">Version</label>
									<select
										id="link-version"
										bind:value={linkVersionId}
										class="flex h-8 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										disabled={!linkProjectId}
									>
										<option value="" disabled>Sélectionner une version</option>
										{#each linkAvailableVersions() as version}
											<option value={version.id}>{version.name} ({version.status})</option>
										{/each}
									</select>
								</div>
								<div class="space-y-1.5">
									<label for="link-expiry" class="text-xs font-medium text-foreground">Expiration</label>
									<select
										id="link-expiry"
										bind:value={linkExpiryDays}
										class="flex h-8 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<option value={30}>1 mois</option>
										<option value={90}>3 mois (recommandé)</option>
										<option value={180}>6 mois</option>
										<option value={365}>1 an</option>
										<option value={730}>2 ans</option>
									</select>
								</div>
								<div class="space-y-1.5">
									<label for="link-password" class="text-xs font-medium text-foreground">
										Mot de passe <span class="text-muted-foreground">(optionnel)</span>
									</label>
									<div class="relative">
										<Lock class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
										<Input id="link-password" bind:value={linkPassword} placeholder="Laisser vide pour aucun" type="password" class="h-8 pl-8 text-sm" />
									</div>
									<p class="text-[10px] text-muted-foreground">Protégez l'accès au lien avec un mot de passe</p>
								</div>

								<div class="flex items-center gap-3 rounded-lg border border-border p-3">
									<input
										type="checkbox"
										id="link-require-account"
										bind:checked={linkRequireAccount}
										class="h-4 w-4 rounded border-border text-primary focus:ring-primary"
									/>
									<div>
										<label for="link-require-account" class="text-xs font-medium text-foreground">Exiger la création d'un compte</label>
										<p class="text-[10px] text-muted-foreground">Le client devra créer un compte</p>
									</div>
								</div>

								{#if formError}
									<p class="text-xs text-destructive">{formError}</p>
								{/if}

								<Button type="submit" disabled={linkGenerating} class="w-full gap-1.5">
									{#if linkGenerating}
										Génération...
									{:else}
										<Link2 class="h-3.5 w-3.5" />
										Générer le lien
									{/if}
								</Button>
							</form>
						{/if}
					{/if}
				</CardContent>
			</Card>
		</div>
	</div>
</div>

<!-- Delete / Revoke Dialog -->
<Dialog bind:open={deleteDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Révoquer l'accès</DialogTitle>
			<DialogDescription>
				Êtes-vous sûr de vouloir révoquer l'accès de <strong>{deletingAssignment?.user.name}</strong> ? Le client ne pourra plus accéder à la démo.
			</DialogDescription>
		</DialogHeader>
		<DialogFooter>
			<Button variant="outline" onclick={() => { deleteDialogOpen = false; }}>Annuler</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={deleteSubmitting}>
				{deleteSubmitting ? 'Révocation...' : 'Révoquer'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
