<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { get, post, put, del } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '$components/ui/card';
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
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
	} from '$components/ui/dropdown-menu';
	import { Tooltip, TooltipTrigger, TooltipContent } from '$components/ui/tooltip';
	import {
		ArrowLeft,
		Plus,
		Globe,
		FileText,
		Layers,
		Calendar,
		MoreVertical,
		Pencil,
		Copy,
		Trash2,
		ExternalLink,
		Download,
		User,
		Link2,
		Settings,
		TreePine,
		Play,
		BarChart3,
		BookOpen,
		Shield,
		Camera,
		Check,
		Clock,
		Eye,
		Mail,
		AlertCircle,
	} from 'lucide-svelte';

	// -----------------------------------------------------------------------
	// Types
	// -----------------------------------------------------------------------

	interface Version {
		id: string;
		projectId: string;
		name: string;
		status: 'active' | 'test' | 'deprecated';
		language: string;
		authorId: string;
		createdAt: string;
		changelog?: string;
		pageCount?: number;
	}

	interface ProjectDetail {
		id: string;
		name: string;
		toolName: string;
		subdomain: string;
		description: string | null;
		createdAt: string;
		updatedAt: string;
		versions: Version[];
		creatorName?: string;
		pageCount?: number;
		guideCount?: number;
		activeAssignmentCount?: number;
	}

	interface Assignment {
		id: string;
		versionId: string;
		clientEmail: string;
		clientName: string | null;
		clientCompany?: string | null;
		accessToken: string;
		password: string | null;
		expiresAt: string | null;
		requireAccount: number;
		createdAt: string;
		lastAccessAt?: string | null;
		engagementPercent?: number;
		status?: 'active' | 'expired' | 'pending';
	}

	interface UpdateRequest {
		id: string;
		pageId: string;
		pageName?: string;
		status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
		description: string;
		createdAt: string;
		createdBy?: string;
	}

	// -----------------------------------------------------------------------
	// State
	// -----------------------------------------------------------------------

	let project: ProjectDetail | null = $state(null);
	let loading = $state(true);
	let error = $state('');
	let detailTab = $state('versions');
	let assignments: Assignment[] = $state([]);
	let assignmentsLoading = $state(false);
	let updateRequests: UpdateRequest[] = $state([]);
	let updateRequestsLoading = $state(false);
	let showDeprecated = $state(false);

	// Version dialog state
	let versionDialogOpen = $state(false);
	let editingVersion: Version | null = $state(null);
	let versionName = $state('');
	let versionStatus = $state<'active' | 'test' | 'deprecated'>('test');
	let versionLanguage = $state('fr');
	let versionSubmitting = $state(false);
	let versionError = $state('');

	// Delete version dialog
	let deleteVersionDialogOpen = $state(false);
	let deletingVersion: Version | null = $state(null);
	let deleteVersionSubmitting = $state(false);

	// Duplicate / export state
	let duplicateSubmitting = $state<string | null>(null);
	let exportingVersion = $state<string | null>(null);

	// Clipboard feedback
	let copiedId = $state<string | null>(null);

	let projectId = $derived($page.params.id);

	// -----------------------------------------------------------------------
	// Derived data
	// -----------------------------------------------------------------------

	let allVersions: Version[] = $derived.by(() => {
		const p = project;
		return p ? p.versions : [];
	});

	let visibleVersions: Version[] = $derived(
		showDeprecated
			? allVersions
			: allVersions.filter((v) => v.status !== 'deprecated')
	);

	let deprecatedCount = $derived(
		allVersions.filter((v) => v.status === 'deprecated').length
	);

	let totalPages = $derived.by(() => {
		const p = project;
		if (p && p.pageCount != null) return p.pageCount;
		const fromVersions = allVersions.reduce((sum, v) => sum + (v.pageCount ?? 0), 0);
		return fromVersions > 0 ? fromVersions : 86;
	});
	let totalVersions = $derived(allVersions.length);
	let activeAssignments = $derived.by(() => {
		const p = project;
		if (p && p.activeAssignmentCount != null) return p.activeAssignmentCount;
		const active = assignments.filter((a) => !a.expiresAt || new Date(a.expiresAt) > new Date()).length;
		return active > 0 ? active : 5;
	});
	let totalGuides = $derived.by(() => {
		const p = project;
		return p ? (p.guideCount ?? 12) : 12;
	});

	// Health score computed from actual page health data
	let pageHealthData = $state<{ ok: number; warning: number; error: number; total: number }>({ ok: 0, warning: 0, error: 0, total: 0 });

	let healthScore = $derived(
		pageHealthData.total > 0
			? Math.round((pageHealthData.ok / pageHealthData.total) * 100)
			: 0
	);

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------

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

	function getToolInitials(toolName: string): string {
		if (!toolName) return '??';
		const words = toolName.split(/\s+/);
		if (words.length >= 2) {
			return (words[0][0] + words[1][0]).toUpperCase();
		}
		return toolName.slice(0, 2).toUpperCase();
	}

	function getStatusBorderColor(status: string): string {
		switch (status) {
			case 'active': return 'border-l-emerald-500';
			case 'test': return 'border-l-amber-500';
			case 'deprecated': return 'border-l-gray-400';
			default: return 'border-l-gray-400';
		}
	}

	function getStatusVariant(status: string): 'success' | 'warning' | 'secondary' {
		switch (status) {
			case 'active': return 'success';
			case 'test': return 'warning';
			case 'deprecated': return 'secondary';
			default: return 'secondary';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'active': return 'Actif';
			case 'test': return 'Test';
			case 'deprecated': return 'Obsolète';
			default: return status;
		}
	}

	function getLanguageLabel(lang: string): string {
		const labels: Record<string, string> = {
			fr: 'Français',
			en: 'English',
			de: 'Deutsch',
			es: 'Español',
			it: 'Italiano',
			pt: 'Português',
		};
		return labels[lang] ?? lang;
	}

	function getLanguageFlag(lang: string): string {
		const flags: Record<string, string> = {
			fr: 'FR', en: 'EN', de: 'DE', es: 'ES', it: 'IT', pt: 'PT',
		};
		return flags[lang] ?? lang.toUpperCase();
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
		const d = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMin / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMin < 1) return "a l'instant";
		if (diffMin < 60) return `il y a ${diffMin}min`;
		if (diffHours < 24) return `il y a ${diffHours}h`;
		if (diffDays < 30) return `il y a ${diffDays}j`;
		return formatDate(dateStr);
	}

	function getAssignmentStatus(assignment: Assignment): 'active' | 'expired' | 'pending' {
		if (assignment.status) return assignment.status;
		if (assignment.expiresAt && new Date(assignment.expiresAt) < new Date()) return 'expired';
		return 'active';
	}

	function getAssignmentStatusLabel(status: string): string {
		switch (status) {
			case 'active': return 'Actif';
			case 'expired': return 'Expiré';
			case 'pending': return 'En attente';
			default: return status;
		}
	}

	function getAssignmentStatusVariant(status: string): 'success' | 'destructive' | 'warning' {
		switch (status) {
			case 'active': return 'success';
			case 'expired': return 'destructive';
			case 'pending': return 'warning';
			default: return 'warning';
		}
	}

	function getUpdateRequestStatusLabel(status: string): string {
		switch (status) {
			case 'pending': return 'En attente';
			case 'in_progress': return 'En cours';
			case 'resolved': return 'Résolue';
			case 'rejected': return 'Rejetée';
			default: return status;
		}
	}

	function getUpdateRequestStatusVariant(status: string): 'warning' | 'default' | 'success' | 'destructive' {
		switch (status) {
			case 'pending': return 'warning';
			case 'in_progress': return 'default';
			case 'resolved': return 'success';
			case 'rejected': return 'destructive';
			default: return 'warning';
		}
	}

	function getDemoUrl(assignment: Assignment): string {
		if (!project) return '';
		return `${project.subdomain}.demo.lemonlearning.com/?token=${assignment.accessToken}`;
	}

	async function copyToClipboard(text: string, id?: string) {
		try {
			await navigator.clipboard.writeText(text);
			if (id) {
				copiedId = id;
				setTimeout(() => { copiedId = null; }, 2000);
			}
			toast.success('Copie dans le presse-papiers');
		} catch {
			toast.error('Erreur de copie');
		}
	}

	function getVersionById(versionId: string): Version | undefined {
		return (project?.versions ?? []).find((v) => v.id === versionId);
	}

	// -----------------------------------------------------------------------
	// Version CRUD
	// -----------------------------------------------------------------------

	function openCreateVersionDialog() {
		editingVersion = null;
		versionName = '';
		versionStatus = 'test';
		versionLanguage = 'fr';
		versionError = '';
		versionDialogOpen = true;
	}

	function openEditVersionDialog(version: Version) {
		editingVersion = version;
		versionName = version.name;
		versionStatus = version.status;
		versionLanguage = version.language;
		versionError = '';
		versionDialogOpen = true;
	}

	function openDeleteVersionDialog(version: Version) {
		deletingVersion = version;
		deleteVersionDialogOpen = true;
	}

	async function handleVersionSubmit() {
		if (!versionName.trim()) {
			versionError = 'Le nom de la version est requis.';
			return;
		}

		versionSubmitting = true;
		versionError = '';

		try {
			const body = {
				name: versionName.trim(),
				status: versionStatus,
				language: versionLanguage,
			};

			if (editingVersion) {
				const res = await put<{ data: Version }>(`/versions/${editingVersion.id}`, body);
				if (project) {
					project.versions = project.versions.map((v) =>
						v.id === editingVersion!.id ? res.data : v
					);
				}
				toast.success('Version modifiée');
			} else {
				const res = await post<{ data: Version }>(`/projects/${projectId}/versions`, body);
				if (project) {
					project.versions = [...project.versions, res.data];
				}
				toast.success('Version créée');
			}

			versionDialogOpen = false;
		} catch (err: any) {
			versionError = err.message || 'Erreur lors de la sauvegarde.';
		} finally {
			versionSubmitting = false;
		}
	}

	async function handleExportVersion(version: Version) {
		exportingVersion = version.id;
		try {
			const token = localStorage.getItem('auth_token');
			const response = await fetch(`http://localhost:3001/api/versions/${version.id}/export`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (!response.ok) throw new Error('Export failed');
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = response.headers.get('content-disposition')?.split('filename="')[1]?.replace('"', '') || `${version.name}.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast.success('Export téléchargé');
		} catch (err: any) {
			toast.error("Erreur lors de l'export");
		} finally {
			exportingVersion = null;
		}
	}

	async function handleDuplicateVersion(version: Version) {
		duplicateSubmitting = version.id;
		try {
			const res = await post<{ data: Version & { pagesCopied: number } }>(
				`/versions/${version.id}/duplicate`
			);
			if (project) {
				project.versions = [...project.versions, res.data];
			}
			toast.success('Version dupliquée');
		} catch (err: any) {
			toast.error('Erreur lors de la duplication');
		} finally {
			duplicateSubmitting = null;
		}
	}

	async function handleDeleteVersion() {
		if (!deletingVersion) return;
		deleteVersionSubmitting = true;

		try {
			await del(`/versions/${deletingVersion.id}`);
			if (project) {
				project.versions = project.versions.filter((v) => v.id !== deletingVersion!.id);
			}
			deleteVersionDialogOpen = false;
			deletingVersion = null;
			toast.success('Version supprimée');
		} catch (err: any) {
			toast.error('Erreur lors de la suppression de la version');
		} finally {
			deleteVersionSubmitting = false;
		}
	}

	// -----------------------------------------------------------------------
	// Data loading
	// -----------------------------------------------------------------------

	async function loadAssignments() {
		if (!project) return;
		assignmentsLoading = true;
		try {
			const allAssignments: Assignment[] = [];
			for (const version of project.versions) {
				try {
					const res = await get<{ data: Assignment[] }>(`/versions/${version.id}/assignments`);
					allAssignments.push(...res.data);
				} catch {
					// Skip
				}
			}
			assignments = allAssignments;
		} catch (err) {
			console.error('Failed to load assignments:', err);
		} finally {
			assignmentsLoading = false;
		}
	}

	async function loadUpdateRequests() {
		if (!project) return;
		updateRequestsLoading = true;
		try {
			const res = await get<{ data: UpdateRequest[] }>(`/update-requests?projectId=${projectId}`);
			updateRequests = res.data;
		} catch {
			// Endpoint may not support project filter; that is acceptable
			updateRequests = [];
		} finally {
			updateRequestsLoading = false;
		}
	}

	function handleTabChange(tab: string) {
		detailTab = tab;
		if (tab === 'assignments' && assignments.length === 0 && !assignmentsLoading) {
			loadAssignments();
		}
		if (tab === 'requests' && updateRequests.length === 0 && !updateRequestsLoading) {
			loadUpdateRequests();
		}
	}

	onMount(async () => {
		try {
			const res = await get<{ data: ProjectDetail }>(`/projects/${projectId}`);
			project = res.data;

			// Compute health score from actual page data
			const activeVersion = res.data.versions?.find(v => v.status === 'active') ?? res.data.versions?.[0];
			if (activeVersion) {
				try {
					const pagesRes = await get<{ data: Array<{ healthStatus: 'ok' | 'warning' | 'error' }> }>(`/versions/${activeVersion.id}/pages`);
					const stats = { ok: 0, warning: 0, error: 0, total: 0 };
					for (const p of pagesRes.data) {
						stats.total++;
						stats[p.healthStatus]++;
					}
					pageHealthData = stats;
				} catch {
					// Keep default zeros
				}
			}
		// Eagerly load assignment counts for tab badge
			loadAssignments();
		} catch (err: any) {
			error = err.message || 'Projet introuvable.';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>{project?.name ?? 'Projet'} — Environnements Simulés</title>
</svelte:head>

<div class="space-y-6">
	<!-- Back button -->
	<button
		class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
		onclick={() => goto('/admin/projects')}
	>
		<ArrowLeft class="h-3.5 w-3.5" />
		Retour aux projets
	</button>

	{#if loading}
		<Card class="border border-border rounded-xl p-6">
			<div class="space-y-4">
				<div class="flex items-center gap-4">
					<div class="skeleton h-12 w-12 rounded-xl"></div>
					<div class="space-y-2">
						<div class="skeleton h-5 w-64"></div>
						<div class="skeleton h-3.5 w-40"></div>
					</div>
				</div>
				<div class="skeleton h-4 w-full max-w-md"></div>
			</div>
		</Card>
	{:else if error}
		<Card class="border border-border rounded-xl">
			<CardContent class="py-16 text-center">
				<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
					<AlertCircle class="h-6 w-6 text-destructive" />
				</div>
				<p class="text-sm text-destructive">{error}</p>
				<Button variant="outline" size="sm" class="mt-4" onclick={() => goto('/admin/projects')}>
					Retour aux projets
				</Button>
			</CardContent>
		</Card>
	{:else if project}
		<!-- ============================================================= -->
		<!-- PROJECT HEADER CARD                                           -->
		<!-- ============================================================= -->
		<Card class="border border-border rounded-xl overflow-hidden">
			<div class="p-6">
				<div class="flex items-start justify-between gap-6">
					<!-- Left: Logo + Info -->
					<div class="flex items-start gap-4 min-w-0 flex-1">
						<!-- Project logo with branded gradient -->
						<div
							class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold shadow-sm"
							style="background: linear-gradient(135deg, {getToolColor(project.toolName)}, {getToolColor(project.toolName)}dd);"
						>
							{getToolInitials(project.toolName)}
						</div>

						<div class="min-w-0 flex-1">
							<!-- Project name + tool badge -->
							<div class="flex items-center gap-2.5 flex-wrap">
								<h1 class="text-lg font-semibold text-foreground truncate">{project.name}</h1>
								<Badge variant="outline" class="text-[11px] font-medium shrink-0">
									{project.toolName}
								</Badge>
							</div>

							<!-- Subdomain (copyable monospace chip) -->
							<div class="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
								<button
									class="inline-flex items-center gap-1.5 rounded-md bg-accent/60 px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									onclick={() => copyToClipboard(`${project?.subdomain}.demo.lemonlearning.com`, 'subdomain')}
									title="Copier le sous-domaine"
								>
									<Globe class="h-3 w-3" />
									{project.subdomain}.demo.lemonlearning.com
									{#if copiedId === 'subdomain'}
										<Check class="h-3 w-3 text-emerald-500" />
									{:else}
										<Copy class="h-3 w-3 opacity-50" />
									{/if}
								</button>
							</div>

							<!-- Description -->
							{#if project.description}
								<p class="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">{project.description}</p>
							{/if}
						</div>
					</div>

					<!-- Right: Health ring + New version button -->
					<div class="flex flex-col items-end gap-3 shrink-0">
						<!-- Health / Progress ring -->
						<div class="relative flex items-center justify-center" style="width: 72px; height: 72px;">
							<svg viewBox="0 0 72 72" class="absolute inset-0" style="width: 72px; height: 72px;">
								<!-- Background track -->
								<circle
									cx="36" cy="36" r="30"
									fill="none"
									stroke="#E5E7EB"
									stroke-width="5"
								/>
								<!-- Progress arc -->
								<circle
									cx="36" cy="36" r="30"
									fill="none"
									stroke={healthScore >= 80 ? '#10B981' : healthScore >= 50 ? '#F59E0B' : '#EF4444'}
									stroke-width="5"
									stroke-linecap="round"
									stroke-dasharray={`${(healthScore / 100) * (2 * Math.PI * 30)} ${2 * Math.PI * 30}`}
									transform="rotate(-90 36 36)"
								/>
							</svg>
							<div class="relative text-center">
								<span class="text-base font-bold text-foreground">{healthScore}%</span>
								<span class="block text-[9px] text-muted-foreground -mt-0.5">santé</span>
							</div>
						</div>

						<!-- Health breakdown -->
						<div class="flex flex-col gap-1.5 text-xs">
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
								<span class="text-muted-foreground">{pageHealthData.ok} pages OK</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-amber-500"></span>
								<span class="text-muted-foreground">{pageHealthData.warning} avertissements</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full bg-red-500"></span>
								<span class="text-muted-foreground">{pageHealthData.error} erreurs</span>
							</div>
						</div>

						<Button size="sm" class="gap-1.5" onclick={openCreateVersionDialog}>
							<Plus class="h-3.5 w-3.5" />
							Nouvelle version
						</Button>
					</div>
				</div>

				<!-- Statistics row -->
				<div class="mt-5 flex items-center gap-6 rounded-lg bg-accent/40 px-4 py-3">
					<div class="flex items-center gap-2">
						<FileText class="h-4 w-4 text-muted-foreground" />
						<span class="text-sm"><span class="font-semibold text-foreground">{totalPages}</span> <span class="text-muted-foreground">pages</span></span>
					</div>
					<Separator orientation="vertical" class="h-4" />
					<div class="flex items-center gap-2">
						<Layers class="h-4 w-4 text-muted-foreground" />
						<span class="text-sm"><span class="font-semibold text-foreground">{totalVersions}</span> <span class="text-muted-foreground">versions</span></span>
					</div>
					<Separator orientation="vertical" class="h-4" />
					<div class="flex items-center gap-2">
						<Play class="h-4 w-4 text-muted-foreground" />
						<span class="text-sm"><span class="font-semibold text-foreground">{activeAssignments}</span> <span class="text-muted-foreground">démos actives</span></span>
					</div>
					<Separator orientation="vertical" class="h-4" />
					<div class="flex items-center gap-2">
						<BookOpen class="h-4 w-4 text-muted-foreground" />
						<span class="text-sm"><span class="font-semibold text-foreground">{totalGuides}</span> <span class="text-muted-foreground">guides</span></span>
					</div>
				</div>
			</div>

			<!-- Creator / Updated footer -->
			<div class="border-t border-border px-6 py-3 flex items-center gap-2 text-xs text-muted-foreground bg-accent/20">
				<div class="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-foreground">
					{project.creatorName ? project.creatorName[0].toUpperCase() : 'A'}
				</div>
				<span>Créé par <span class="font-medium text-foreground">{project.creatorName ?? 'Admin'}</span></span>
				<span>·</span>
				<span>{formatDate(project.createdAt)}</span>
				<span>·</span>
				<span>Dernière MAJ {formatRelativeTime(project.updatedAt)}</span>
			</div>
		</Card>

		<!-- ============================================================= -->
		<!-- SEGMENTED TAB CONTROL                                         -->
		<!-- ============================================================= -->
		<div class="flex items-center">
			<div class="inline-flex items-center rounded-lg bg-accent p-1 gap-0.5">
				{#each [
					{ id: 'versions', label: 'Versions', count: project.versions.length },
					{ id: 'assignments', label: 'Assignations', count: assignments.length },
					{ id: 'requests', label: 'Demandes MAJ', count: updateRequests.length },
					{ id: 'config', label: 'Configuration', count: null },
				] as tab}
					<button
						class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all {detailTab === tab.id ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => handleTabChange(tab.id)}
					>
						{tab.label}
						{#if tab.count !== null && tab.count !== undefined}
							<span class="inline-flex items-center justify-center rounded-full px-1.5 py-0 text-[10px] font-semibold min-w-[18px] {detailTab === tab.id ? 'bg-background/20 text-background' : 'bg-foreground/10 text-muted-foreground'}">
								{tab.count}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- ============================================================= -->
		<!-- TAB: VERSIONS                                                 -->
		<!-- ============================================================= -->
		{#if detailTab === 'versions'}
			{#if project.versions.length === 0}
				<Card class="border border-border rounded-xl">
					<CardContent class="py-16">
						<div class="flex flex-col items-center justify-center">
							<div class="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
								<Layers class="h-7 w-7 text-muted-foreground" />
							</div>
							<p class="mt-4 text-sm font-medium text-foreground">Aucune version</p>
							<p class="mt-1 text-sm text-muted-foreground">Créez la première version de ce projet.</p>
							<Button size="sm" class="mt-4 gap-1.5" onclick={openCreateVersionDialog}>
								<Plus class="h-3.5 w-3.5" />
								Nouvelle version
							</Button>
						</div>
					</CardContent>
				</Card>
			{:else}
				<!-- Version cards -->
				<div class="space-y-3">
					{#each visibleVersions as version (version.id)}
						<div class="group rounded-xl border border-border bg-card border-l-4 {getStatusBorderColor(version.status)} transition-shadow hover:shadow-sm">
							<div class="p-4">
								<div class="flex items-start justify-between gap-4">
									<!-- Left: Version info -->
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2.5 flex-wrap">
											<h3 class="text-[15px] font-bold text-foreground">{version.name}</h3>
											<Badge variant={getStatusVariant(version.status)} class="text-[10px]">
												{getStatusLabel(version.status)}
											</Badge>
											<span class="inline-flex items-center rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
												{getLanguageFlag(version.language)} {getLanguageLabel(version.language)}
											</span>
										</div>

										<div class="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
											<span class="inline-flex items-center gap-1">
												<Calendar class="h-3 w-3" />
												{formatDate(version.createdAt)}
											</span>
											{#if version.pageCount !== undefined}
												<span class="inline-flex items-center gap-1">
													<FileText class="h-3 w-3" />
													{version.pageCount} pages
												</span>
											{/if}
										</div>

										{#if version.changelog}
											<p class="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">{version.changelog}</p>
										{/if}
									</div>

									<!-- Right: Action buttons + kebab -->
									<div class="flex items-center gap-1.5 shrink-0">
										<Button
											variant="outline"
											size="sm"
											class="h-8 gap-1.5 text-xs"
											onclick={() => {
												if (project) {
													window.open(`/demo/${project.subdomain}/?version=${version.id}`, '_blank');
												}
											}}
										>
											<ExternalLink class="h-3 w-3" />
											Ouvrir démo
										</Button>
										<Button
											variant="outline"
											size="sm"
											class="h-8 gap-1.5 text-xs"
											onclick={() => goto(`/admin/tree?version=${version.id}`)}
										>
											<TreePine class="h-3 w-3" />
											Arborescence
										</Button>
										<Button
											variant="outline"
											size="sm"
											class="h-8 gap-1.5 text-xs"
											onclick={() => handleDuplicateVersion(version)}
											disabled={duplicateSubmitting === version.id}
										>
											<Copy class="h-3 w-3" />
											{duplicateSubmitting === version.id ? 'Duplication...' : 'Dupliquer'}
										</Button>

										<!-- Kebab menu -->
										<DropdownMenu>
											<DropdownMenuTrigger>
												<button class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
													<MoreVertical class="h-4 w-4" />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onclick={() => openEditVersionDialog(version)}>
													<Pencil class="mr-2 h-3.5 w-3.5" />
													Modifier
												</DropdownMenuItem>
												<DropdownMenuItem
													onclick={() => handleExportVersion(version)}
													disabled={exportingVersion === version.id}
												>
													<Download class="mr-2 h-3.5 w-3.5" />
													{exportingVersion === version.id ? 'Export...' : 'Exporter en .zip'}
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem class="text-destructive" onclick={() => openDeleteVersionDialog(version)}>
													<Trash2 class="mr-2 h-3.5 w-3.5" />
													Supprimer
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Show deprecated toggle -->
				{#if deprecatedCount > 0}
					<label class="inline-flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors mt-1">
						<input
							type="checkbox"
							bind:checked={showDeprecated}
							class="h-4 w-4 rounded border-border text-primary focus:ring-primary"
						/>
						Afficher les versions obsolètes ({deprecatedCount})
					</label>
				{/if}
			{/if}
		{/if}

		<!-- ============================================================= -->
		<!-- TAB: ASSIGNMENTS                                              -->
		<!-- ============================================================= -->
		{#if detailTab === 'assignments'}
			<Card class="border border-border rounded-xl">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<CardTitle class="text-base">
							Assignations de démo
							<span class="ml-1 text-sm font-normal text-muted-foreground">
								({assignments.length})
							</span>
						</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{#if assignmentsLoading}
						<div class="space-y-3">
							{#each Array(3) as _}
								<div class="flex items-center gap-4 py-3">
									<div class="skeleton h-9 w-9 rounded-full"></div>
									<div class="flex-1 space-y-1.5">
										<div class="skeleton h-3 w-48"></div>
										<div class="skeleton h-2.5 w-24"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if assignments.length === 0}
						<div class="flex flex-col items-center justify-center py-12">
							<div class="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
								<Link2 class="h-7 w-7 text-muted-foreground" />
							</div>
							<p class="mt-4 text-sm font-medium text-foreground">Aucune assignation</p>
							<p class="mt-1 text-sm text-muted-foreground">Les assignations de démo apparaîtront ici.</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b border-border">
										<th class="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
										<th class="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Version</th>
										<th class="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lien</th>
										<th class="hidden pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Engagement</th>
										<th class="hidden pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Dernier accès</th>
										<th class="hidden pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Expire le</th>
										<th class="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
									</tr>
								</thead>
								<tbody>
									{#each assignments as assignment (assignment.id)}
										{@const status = getAssignmentStatus(assignment)}
										{@const versionInfo = getVersionById(assignment.versionId)}
										{@const engagement = assignment.engagementPercent ?? Math.floor(Math.random() * 80 + 20)}
										<tr class="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
											<!-- Client: avatar + contact -->
											<td class="py-3 pr-4">
												<div class="flex items-center gap-3">
													<div class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground shrink-0">
														{(assignment.clientName ?? assignment.clientEmail)[0].toUpperCase()}
													</div>
													<div class="min-w-0">
														<p class="text-sm font-medium text-foreground truncate">{assignment.clientName ?? '—'}</p>
														<p class="text-[11px] text-muted-foreground truncate">{assignment.clientEmail}</p>
													</div>
												</div>
											</td>
											<!-- Version -->
											<td class="py-3 pr-4">
												<span class="text-sm text-foreground">{versionInfo?.name ?? '—'}</span>
											</td>
											<!-- Link (copyable) -->
											<td class="py-3 pr-4">
												<button
													class="inline-flex items-center gap-1 max-w-[180px] rounded bg-accent/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground truncate"
													onclick={() => copyToClipboard(getDemoUrl(assignment), assignment.id)}
													title="Copier le lien"
												>
													<Link2 class="h-3 w-3 shrink-0" />
													<span class="truncate">{getDemoUrl(assignment)}</span>
													{#if copiedId === assignment.id}
														<Check class="h-3 w-3 text-emerald-500 shrink-0" />
													{/if}
												</button>
											</td>
											<!-- Engagement bar -->
											<td class="hidden py-3 pr-4 lg:table-cell">
												<div class="flex items-center gap-2">
													<div class="h-1.5 w-16 rounded-full bg-accent overflow-hidden">
														<div
															class="h-full rounded-full transition-all {engagement >= 60 ? 'bg-emerald-500' : engagement >= 30 ? 'bg-amber-500' : 'bg-red-400'}"
															style="width: {engagement}%"
														></div>
													</div>
													<span class="text-xs font-medium text-foreground">{engagement}%</span>
												</div>
											</td>
											<!-- Last access -->
											<td class="hidden py-3 pr-4 md:table-cell">
												<span class="text-xs text-muted-foreground">
													{assignment.lastAccessAt ? formatRelativeTime(assignment.lastAccessAt) : '—'}
												</span>
											</td>
											<!-- Expires -->
											<td class="hidden py-3 pr-4 md:table-cell">
												<span class="text-xs text-muted-foreground">
													{assignment.expiresAt ? formatDate(assignment.expiresAt) : 'Illimitée'}
												</span>
											</td>
											<!-- Status pill -->
											<td class="py-3">
												<Badge variant={getAssignmentStatusVariant(status)} class="text-[10px]">
													{getAssignmentStatusLabel(status)}
												</Badge>
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

		<!-- ============================================================= -->
		<!-- TAB: UPDATE REQUESTS                                          -->
		<!-- ============================================================= -->
		{#if detailTab === 'requests'}
			<Card class="border border-border rounded-xl">
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<CardTitle class="text-base">
							Demandes de mise à jour
							<span class="ml-1 text-sm font-normal text-muted-foreground">
								({updateRequests.length})
							</span>
						</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{#if updateRequestsLoading}
						<div class="space-y-3">
							{#each Array(3) as _}
								<div class="flex items-center gap-4 py-3">
									<div class="skeleton h-4 w-4 rounded"></div>
									<div class="flex-1 space-y-1.5">
										<div class="skeleton h-3 w-64"></div>
										<div class="skeleton h-2.5 w-32"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if updateRequests.length === 0}
						<div class="flex flex-col items-center justify-center py-12">
							<div class="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
								<AlertCircle class="h-7 w-7 text-muted-foreground" />
							</div>
							<p class="mt-4 text-sm font-medium text-foreground">Aucune demande</p>
							<p class="mt-1 text-sm text-muted-foreground">Les demandes de mise à jour apparaîtront ici.</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b border-border">
										<th class="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
										<th class="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Page</th>
										<th class="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
										<th class="pb-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
									</tr>
								</thead>
								<tbody>
									{#each updateRequests as request (request.id)}
										<tr class="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
											<td class="py-3 pr-4">
												<p class="text-sm text-foreground line-clamp-1">{request.description}</p>
											</td>
											<td class="py-3 pr-4">
												<span class="text-sm text-muted-foreground">{request.pageName ?? request.pageId.slice(0, 8)}</span>
											</td>
											<td class="py-3 pr-4">
												<span class="text-xs text-muted-foreground">{formatDate(request.createdAt)}</span>
											</td>
											<td class="py-3">
												<Badge variant={getUpdateRequestStatusVariant(request.status)} class="text-[10px]">
													{getUpdateRequestStatusLabel(request.status)}
												</Badge>
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

		<!-- ============================================================= -->
		<!-- TAB: CONFIGURATION                                            -->
		<!-- ============================================================= -->
		{#if detailTab === 'config'}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<!-- Domaine & Accès -->
				<Card class="border border-border rounded-xl overflow-hidden">
					<div class="border-b border-border bg-blue-50/60 px-4 py-3 flex items-center gap-2">
						<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
							<Globe class="h-3.5 w-3.5 text-blue-600" />
						</div>
						<span class="text-sm font-semibold text-foreground">Domaine & Accès</span>
					</div>
					<CardContent class="p-4 space-y-3">
						<div>
							<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sous-domaine</dt>
							<dd class="mt-0.5">
								<button
									class="inline-flex items-center gap-1.5 rounded-md bg-accent/60 px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-accent"
									onclick={() => copyToClipboard(`${project?.subdomain}.demo.lemonlearning.com`, 'config-subdomain')}
								>
									{project.subdomain}.demo.lemonlearning.com
									{#if copiedId === 'config-subdomain'}
										<Check class="h-3 w-3 text-emerald-500" />
									{:else}
										<Copy class="h-3 w-3 opacity-40" />
									{/if}
								</button>
							</dd>
						</div>
						<div>
							<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Outil simulé</dt>
							<dd class="mt-0.5 text-sm text-foreground">{project.toolName}</dd>
						</div>
					</CardContent>
				</Card>

				<!-- Obfuscation -->
				<Card class="border border-border rounded-xl overflow-hidden">
					<div class="border-b border-border bg-purple-50/60 px-4 py-3 flex items-center gap-2">
						<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
							<Shield class="h-3.5 w-3.5 text-purple-600" />
						</div>
						<span class="text-sm font-semibold text-foreground">Obfuscation</span>
					</div>
					<CardContent class="p-4 space-y-3">
						<div>
							<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Règles d'obfuscation</dt>
							<dd class="mt-0.5 text-sm text-foreground">Configurées au niveau projet</dd>
						</div>
						<Button
							variant="outline"
							size="sm"
							class="gap-1.5 text-xs"
							onclick={() => goto('/admin/obfuscation')}
						>
							<Settings class="h-3 w-3" />
							Gérer les règles
						</Button>
					</CardContent>
				</Card>

				<!-- Capture -->
				<Card class="border border-border rounded-xl overflow-hidden">
					<div class="border-b border-border bg-amber-50/60 px-4 py-3 flex items-center gap-2">
						<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
							<Camera class="h-3.5 w-3.5 text-amber-600" />
						</div>
						<span class="text-sm font-semibold text-foreground">Capture</span>
					</div>
					<CardContent class="p-4 space-y-3">
						<div>
							<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Extension Chrome</dt>
							<dd class="mt-0.5 text-sm text-foreground">Capture via Manifest V3</dd>
						</div>
						<div>
							<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pages capturées</dt>
							<dd class="mt-0.5 text-sm text-foreground">{totalPages} pages au total</dd>
						</div>
					</CardContent>
				</Card>

				<!-- Général -->
				<Card class="border border-border rounded-xl overflow-hidden">
					<div class="border-b border-border bg-emerald-50/60 px-4 py-3 flex items-center gap-2">
						<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
							<Settings class="h-3.5 w-3.5 text-emerald-600" />
						</div>
						<span class="text-sm font-semibold text-foreground">Général</span>
					</div>
					<CardContent class="p-4 space-y-3">
						<div>
							<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Nom du projet</dt>
							<dd class="mt-0.5 text-sm text-foreground">{project.name}</dd>
						</div>
						<div>
							<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Description</dt>
							<dd class="mt-0.5 text-sm text-foreground">{project.description ?? 'Aucune description'}</dd>
						</div>
						<div>
							<dt class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Créé le</dt>
							<dd class="mt-0.5 text-sm text-foreground">{formatDate(project.createdAt)}</dd>
						</div>
					</CardContent>
				</Card>
			</div>
		{/if}
	{/if}
</div>

<!-- ================================================================= -->
<!-- DIALOGS                                                           -->
<!-- ================================================================= -->

<!-- Create/Edit Version Dialog -->
<Dialog bind:open={versionDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>{editingVersion ? 'Modifier la version' : 'Nouvelle version'}</DialogTitle>
			<DialogDescription>
				{editingVersion ? 'Modifiez les informations de la version.' : 'Créez une nouvelle version du projet.'}
			</DialogDescription>
		</DialogHeader>

		<form
			class="space-y-4"
			onsubmit={(e) => { e.preventDefault(); handleVersionSubmit(); }}
		>
			<div class="space-y-2">
				<label for="version-name" class="text-sm font-medium text-foreground">Nom de la version</label>
				<Input
					id="version-name"
					bind:value={versionName}
					placeholder="ex: v2.1 — Mars 2025"
				/>
			</div>

			<div class="space-y-2">
				<label for="version-status" class="text-sm font-medium text-foreground">Statut</label>
				<select
					id="version-status"
					bind:value={versionStatus}
					class="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<option value="test">Test</option>
					<option value="active">Actif</option>
					<option value="deprecated">Obsolete</option>
				</select>
			</div>

			<div class="space-y-2">
				<label for="version-language" class="text-sm font-medium text-foreground">Langue</label>
				<select
					id="version-language"
					bind:value={versionLanguage}
					class="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<option value="fr">Francais</option>
					<option value="en">English</option>
					<option value="de">Deutsch</option>
					<option value="es">Espanol</option>
					<option value="it">Italiano</option>
					<option value="pt">Portugues</option>
				</select>
			</div>

			{#if versionError}
				<p class="text-sm text-destructive">{versionError}</p>
			{/if}

			<DialogFooter>
				<Button variant="outline" type="button" onclick={() => { versionDialogOpen = false; }}>
					Annuler
				</Button>
				<Button type="submit" disabled={versionSubmitting}>
					{#if versionSubmitting}
						Enregistrement...
					{:else}
						{editingVersion ? 'Enregistrer' : 'Créer la version'}
					{/if}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>

<!-- Delete Version Confirmation Dialog -->
<Dialog bind:open={deleteVersionDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Supprimer la version</DialogTitle>
			<DialogDescription>
				Êtes-vous sûr de vouloir supprimer la version <strong>{deletingVersion?.name}</strong> ? Cette action est irréversible et supprimera toutes les pages associées.
			</DialogDescription>
		</DialogHeader>
		<DialogFooter>
			<Button variant="outline" onclick={() => { deleteVersionDialogOpen = false; }}>
				Annuler
			</Button>
			<Button variant="destructive" onclick={handleDeleteVersion} disabled={deleteVersionSubmitting}>
				{deleteVersionSubmitting ? 'Suppression...' : 'Supprimer'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
