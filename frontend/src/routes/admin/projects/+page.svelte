<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { get, post, put, del } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { Card, CardContent } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import { Tabs, TabsList, TabsTrigger } from '$components/ui/tabs';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter,
	} from '$components/ui/dialog';
	import { selectProject } from '$lib/stores/project';
	import {
		FolderKanban,
		Plus,
		Search,
		FileText,
		Calendar,
		Layers,
		MoreVertical,
		Pencil,
		Trash2,
		ImagePlus,
		X,
		Check,
		Loader2,
		ChevronDown,
	} from 'lucide-svelte';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
	} from '$components/ui/dropdown-menu';

	interface Project {
		id: string;
		name: string;
		toolName: string;
		subdomain: string;
		description: string | null;
		logoUrl: string | null;
		iconColor: string | null;
		createdAt: string;
		updatedAt: string;
		versionCount: number;
		pageCount: number;
	}

	let projects: Project[] = $state([]);
	let loading = $state(true);
	let statusFilter = $state('all');
	let searchQuery = $state('');

	// Create/Edit dialog state
	let dialogOpen = $state(false);
	let editingProject: Project | null = $state(null);
	let formName = $state('');
	let formSubdomain = $state('');
	let formDescription = $state('');
	let formLogoUrl = $state('');
	let formIconColor = $state('');
	let formVersionName = $state('Version 1');
	let formSubmitting = $state(false);
	let formError = $state('');

	let logoFileInput: HTMLInputElement | undefined = $state();

	// Subdomain reactive validation
	let subdomainStatus: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' = $state('idle');
	let subdomainCheckTimer: ReturnType<typeof setTimeout> | undefined;

	// Delete confirmation dialog
	let deleteDialogOpen = $state(false);
	let deletingProject: Project | null = $state(null);
	let deleteSubmitting = $state(false);

	// FAB visibility — shown when header "Nouveau projet" button is scrolled out of view
	let headerButtonEl: HTMLElement | undefined = $state();
	let showFab = $state(false);

	// Scroll hint — subtle down arrow when more projects are below
	let gridBottomEl: HTMLElement | undefined = $state();
	let showScrollHint = $state(false);

	// Color palette for icon
	const colorPalette = [
		'#2B72EE', '#00A1E0', '#10B981', '#F5A623',
		'#FF7A59', '#C74634', '#6D7481', '#03363D',
	];

	async function handleLogoChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const { optimizeLogoImage, extractDominantColor } = await import('$lib/utils');
			formLogoUrl = await optimizeLogoImage(file);
			formIconColor = await extractDominantColor(formLogoUrl);
		} catch {
			// Fallback to raw data URL
			const reader = new FileReader();
			reader.onload = () => { formLogoUrl = reader.result as string; };
			reader.readAsDataURL(file);
		}
	}

	function removeLogo() {
		formLogoUrl = '';
		formIconColor = '';
		if (logoFileInput) logoFileInput.value = '';
	}

	// Fallback color for project initials
	function getToolColor(name: string): string {
		const colors: Record<string, string> = {
			'Salesforce': '#00A1E0',
			'SAP SuccessFactors': '#0070F2',
			'Workday': '#F5A623',
			'ServiceNow': '#81B5A1',
			'HubSpot': '#FF7A59',
			'Zendesk': '#03363D',
			'Oracle': '#C74634',
			'Microsoft Dynamics': '#0078D4',
			'Jira': '#0052CC',
			'Confluence': '#1868DB',
		};
		return colors[name] ?? '#6D7481';
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

	function generateSubdomain(name: string): string {
		return name
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function checkSubdomain(subdomain: string) {
		clearTimeout(subdomainCheckTimer);

		if (!subdomain.trim()) {
			subdomainStatus = 'idle';
			return;
		}

		if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
			subdomainStatus = 'invalid';
			return;
		}

		subdomainStatus = 'checking';
		subdomainCheckTimer = setTimeout(async () => {
			try {
				const params = new URLSearchParams({ subdomain });
				if (editingProject) params.set('excludeId', editingProject.id);
				const res = await get<{ data: { available: boolean } }>(`/projects/check-subdomain?${params}`);
				subdomainStatus = res.data.available ? 'available' : 'taken';
			} catch {
				subdomainStatus = 'idle';
			}
		}, 400);
	}

	let filteredProjects = $derived(() => {
		let result = projects;

		if (statusFilter === 'active') {
			result = result.filter((p) => p.versionCount > 0);
		} else if (statusFilter === 'archived') {
			result = result.filter((p) => p.versionCount === 0);
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(p) =>
					p.name.toLowerCase().includes(q) ||
					p.subdomain.toLowerCase().includes(q) ||
					(p.toolName || '').toLowerCase().includes(q)
			);
		}

		return result;
	});

	function openCreateDialog() {
		editingProject = null;
		formName = '';
		formSubdomain = '';
		formDescription = '';
		formLogoUrl = '';
		formIconColor = '';
		formVersionName = 'Version 1';
		formError = '';
		subdomainStatus = 'idle';
		dialogOpen = true;
	}

	function openEditDialog(project: Project) {
		editingProject = project;
		formName = project.name;
		formSubdomain = project.subdomain;
		formDescription = project.description ?? '';
		formLogoUrl = project.logoUrl ?? '';
		formIconColor = project.iconColor ?? getToolColor(project.name);
		formError = '';
		subdomainStatus = 'idle';
		dialogOpen = true;
	}

	function openDeleteDialog(project: Project) {
		deletingProject = project;
		deleteDialogOpen = true;
	}

	async function handleSubmit() {
		if (!formName.trim()) {
			formError = 'Le nom du projet est requis.';
			return;
		}

		if (subdomainStatus === 'taken') {
			formError = 'Ce sous-domaine est déjà utilisé.';
			return;
		}
		if (subdomainStatus === 'invalid') {
			formError = 'Format de sous-domaine invalide.';
			return;
		}

		formSubmitting = true;
		formError = '';

		try {
			const body = {
				name: formName.trim(),
				toolName: formName.trim(),
				subdomain: formSubdomain.trim() || generateSubdomain(formName),
				description: formDescription.trim() || null,
				logoUrl: formLogoUrl || null,
				iconColor: formIconColor || null,
			};

			if (editingProject) {
				const res = await put<{ data: Project }>(`/projects/${editingProject.id}`, body);
				const idx = projects.findIndex((p) => p.id === editingProject!.id);
				if (idx !== -1) {
					projects[idx] = { ...projects[idx], ...res.data };
				}
				toast.success('Projet modifié avec succès');
			} else {
				const res = await post<{ data: Project }>('/projects', body);
				let versionCount = 0;

				// Create initial version if name is provided
				if (formVersionName.trim()) {
					try {
						await post(`/projects/${res.data.id}/versions`, {
							name: formVersionName.trim(),
							status: 'active',
							language: 'fr',
						});
						versionCount = 1;
					} catch (versionErr: any) {
						console.error('Version creation failed:', versionErr);
						toast.error(`Projet créé, mais la version n'a pas pu être ajoutée : ${versionErr.message || 'Erreur inconnue'}`);
					}
				}

				projects = [{ ...res.data, versionCount, pageCount: 0 }, ...projects];
				toast.success('Projet créé avec succès');
			}

			dialogOpen = false;
		} catch (err: any) {
			formError = err.message || 'Erreur lors de la sauvegarde.';
		} finally {
			formSubmitting = false;
		}
	}

	async function handleDelete() {
		if (!deletingProject) return;
		deleteSubmitting = true;

		try {
			await del(`/projects/${deletingProject.id}`);
			projects = projects.filter((p) => p.id !== deletingProject!.id);
			deleteDialogOpen = false;
			deletingProject = null;
			toast.success('Projet supprimé');
		} catch (err: any) {
			toast.error('Erreur lors de la suppression du projet');
		} finally {
			deleteSubmitting = false;
		}
	}

	import { onDestroy } from 'svelte';

	function handleCreateProjectEvent() {
		openCreateDialog();
	}

	let observer: IntersectionObserver | undefined;
	let gridBottomObserver: IntersectionObserver | undefined;

	onMount(async () => {
		window.addEventListener('open-create-project', handleCreateProjectEvent);

		try {
			const res = await get<{ data: Project[] }>('/projects');
			projects = res.data;
		} catch (err) {
			console.error('Projects fetch error:', err);
		} finally {
			loading = false;
		}
	});

	// Watch header button visibility for FAB
	$effect(() => {
		if (!headerButtonEl) return;
		observer?.disconnect();
		observer = new IntersectionObserver(
			([entry]) => { showFab = !entry.isIntersecting; },
			{ threshold: 0 }
		);
		observer.observe(headerButtonEl);
		return () => observer?.disconnect();
	});

	// Watch grid bottom sentinel for scroll hint arrow
	$effect(() => {
		if (!gridBottomEl) { showScrollHint = false; return; }
		gridBottomObserver?.disconnect();
		gridBottomObserver = new IntersectionObserver(
			([entry]) => { showScrollHint = !entry.isIntersecting; },
			{ threshold: 0 }
		);
		gridBottomObserver.observe(gridBottomEl);
		return () => gridBottomObserver?.disconnect();
	});

	onDestroy(() => {
		window.removeEventListener('open-create-project', handleCreateProjectEvent);
		observer?.disconnect();
		gridBottomObserver?.disconnect();
		clearTimeout(subdomainCheckTimer);
	});
</script>

<svelte:head>
	<title>Projets — Lemon Lab</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-semibold text-foreground">Projets</h1>
			<p class="text-sm text-muted-foreground">
				Gérez vos environnements simulés
			</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<Tabs value={statusFilter} onValueChange={(v) => { statusFilter = v; }}>
			<TabsList>
				<TabsTrigger value="all">Tous</TabsTrigger>
				<TabsTrigger value="active">Actifs</TabsTrigger>
				<TabsTrigger value="test">Test</TabsTrigger>
				<TabsTrigger value="archived">Archivés</TabsTrigger>
			</TabsList>
		</Tabs>

		<div class="flex items-center gap-2">
			<div class="relative w-full sm:w-64">
				<Search class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
				<Input
					bind:value={searchQuery}
					placeholder="Rechercher un projet..."
					class="pl-9"
				/>
			</div>
			<span bind:this={headerButtonEl}>
				<Button size="sm" class="gap-1.5 shrink-0" onclick={openCreateDialog}>
					<Plus class="h-3.5 w-3.5" />
					Nouveau projet
				</Button>
			</span>
		</div>
	</div>

	<!-- Project cards -->
	{#if loading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _}
				<Card>
					<CardContent class="p-5">
						<div class="flex items-start gap-3">
							<div class="skeleton h-10 w-10 rounded-lg"></div>
							<div class="flex-1 space-y-2">
								<div class="skeleton h-4 w-32"></div>
								<div class="skeleton h-3 w-20"></div>
							</div>
						</div>
						<div class="mt-4 flex items-center gap-4">
							<div class="skeleton h-3 w-16"></div>
							<div class="skeleton h-3 w-16"></div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{:else if filteredProjects().length === 0}
		<Card>
			<CardContent class="flex flex-col items-center justify-center py-16">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
					<FolderKanban class="h-6 w-6 text-muted" />
				</div>
				<p class="mt-4 text-sm font-medium text-foreground">
					{searchQuery ? 'Aucun projet trouvé' : 'Aucun projet'}
				</p>
				<p class="mt-1 text-sm text-muted-foreground">
					{searchQuery ? 'Essayez avec d\'autres termes de recherche.' : 'Créez votre premier environnement simulé.'}
				</p>
				{#if !searchQuery}
					<Button size="sm" class="mt-4 gap-1.5" onclick={openCreateDialog}>
						<Plus class="h-3.5 w-3.5" />
						Nouveau projet
					</Button>
				{/if}
			</CardContent>
		</Card>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredProjects() as project}
				<Card class="group relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
					<CardContent class="p-5">
						<!-- Actions dropdown -->
						<div class="absolute right-3 top-3">
							<DropdownMenu>
								<DropdownMenuTrigger>
									<button class="rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100">
										<MoreVertical class="h-4 w-4" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onclick={() => openEditDialog(project)}>
										<Pencil class="mr-2 h-3.5 w-3.5" />
										Modifier
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem class="text-destructive" onclick={() => openDeleteDialog(project)}>
										<Trash2 class="mr-2 h-3.5 w-3.5" />
										Supprimer
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>

						<!-- Card content (clickable) -->
						<a href="/admin/projects/{project.id}" class="block" onclick={() => selectProject(project.id)}>
							<div class="flex items-start gap-3">
								{#if project.logoUrl}
									<img
										src={project.logoUrl}
										alt={project.name}
										class="h-10 w-10 shrink-0 rounded-lg object-cover"
									/>
								{:else}
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
										style="background-color: {project.iconColor || getToolColor(project.name)}"
									>
										{project.name.slice(0, 2).toUpperCase()}
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<p class="font-medium text-foreground group-hover:text-primary">{project.name}</p>
										{#if project.versionCount > 0}
											<Badge variant="success" class="text-[10px]">Actif</Badge>
										{:else}
											<Badge variant="secondary" class="text-[10px]">Vide</Badge>
										{/if}
									</div>
									<p class="text-xs text-muted-foreground">{project.subdomain}</p>
								</div>
							</div>

							{#if project.description}
								<p class="mt-3 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
							{/if}

							<div class="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
								<span class="inline-flex items-center gap-1">
									<Layers class="h-3 w-3" />
									{project.versionCount} version{project.versionCount !== 1 ? 's' : ''}
								</span>
								<span class="inline-flex items-center gap-1">
									<FileText class="h-3 w-3" />
									{project.pageCount} page{project.pageCount !== 1 ? 's' : ''}
								</span>
								<span class="ml-auto inline-flex items-center gap-1">
									<Calendar class="h-3 w-3" />
									{formatDate(project.updatedAt)}
								</span>
							</div>
						</a>
					</CardContent>
				</Card>
			{/each}
		</div>
		<!-- Scroll sentinel -->
		<div bind:this={gridBottomEl} class="h-1"></div>
	{/if}
</div>

<!-- Scroll hint arrow — visible when more projects are below the fold -->
{#if showScrollHint}
	<div
		class="fixed bottom-5 z-30 pointer-events-none animate-fade-in"
		style="left: var(--sidebar-current-width, var(--sidebar-width)); right: 0"
	>
		<div class="flex justify-center">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 border border-border/50 shadow-sm backdrop-blur-sm animate-bounce-subtle">
				<ChevronDown class="h-3.5 w-3.5 text-muted" />
			</div>
		</div>
	</div>
{/if}

<!-- Floating action button — visible when header button is scrolled out of view -->
{#if showFab}
	<button
		class="fixed bottom-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl hover:scale-105 active:scale-95"
		style="left: calc(var(--sidebar-current-width, var(--sidebar-width)) + 24px)"
		onclick={openCreateDialog}
		title="Nouveau projet"
	>
		<Plus class="h-5 w-5" />
	</button>
{/if}

<!-- Create/Edit Project Dialog -->
<Dialog bind:open={dialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>{editingProject ? 'Modifier le projet' : 'Nouveau projet'}</DialogTitle>
			<DialogDescription>
				{editingProject ? 'Modifiez les informations du projet.' : 'Créez un nouvel environnement simulé.'}
			</DialogDescription>
		</DialogHeader>

		<form
			class="space-y-4"
			onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
		>
			<!-- Logo + Name row -->
			<div class="flex items-start gap-4">
				<!-- Logo upload -->
				<div class="shrink-0">
					<input
						type="file"
						accept="image/*"
						class="hidden"
						bind:this={logoFileInput}
						onchange={handleLogoChange}
					/>
					{#if formLogoUrl}
						<div class="group relative">
							<button
								type="button"
								class="h-16 w-16 overflow-hidden rounded-lg border border-border"
								onclick={() => logoFileInput?.click()}
							>
								<img src={formLogoUrl} alt="Logo" class="h-full w-full object-cover" />
							</button>
							<button
								type="button"
								class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
								onclick={removeLogo}
								title="Supprimer le logo"
							>
								<X class="h-3 w-3" />
							</button>
						</div>
					{:else}
						<button
							type="button"
							class="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary"
							onclick={() => logoFileInput?.click()}
						>
							<ImagePlus class="h-5 w-5" />
							<span class="text-[9px] font-medium">Logo</span>
						</button>
					{/if}

					<!-- Color palette under logo -->
					<div class="mt-2 flex flex-wrap gap-1 max-w-[64px] justify-center">
						{#each colorPalette as color}
							<button
								type="button"
								class="h-4 w-4 rounded-full transition-all {formIconColor === color ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'hover:scale-110'}"
								style="background-color: {color}"
								onclick={() => { formIconColor = color; }}
								title={color}
							></button>
						{/each}
						<label
							class="relative h-4 w-4 rounded-full cursor-pointer border border-border transition-all hover:scale-110 overflow-hidden"
							style="background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red)"
							title="Couleur personnalisée"
						>
							<input
								type="color"
								bind:value={formIconColor}
								class="absolute inset-0 cursor-pointer opacity-0"
							/>
						</label>
					</div>
					{#if formIconColor}
						<p class="mt-1 text-center text-[9px] font-mono text-muted-foreground">{formIconColor}</p>
					{/if}
				</div>

				<!-- Name -->
				<div class="flex-1 space-y-1.5">
					<label for="project-name" class="text-sm font-medium text-foreground">Nom du projet</label>
					<Input
						id="project-name"
						bind:value={formName}
						placeholder="ex: Salesforce CRM — Démo commerciale"
						oninput={() => {
							if (!editingProject && !formSubdomain) {
								formSubdomain = generateSubdomain(formName);
							}
						}}
					/>
				</div>
			</div>

			<!-- Subdomain with reactive validation -->
			<div class="space-y-1.5">
				<label for="project-subdomain" class="text-sm font-medium text-foreground">Sous-domaine des démos</label>
				<div class="flex items-center gap-2">
					<div class="relative flex-1">
						<Input
							id="project-subdomain"
							bind:value={formSubdomain}
							placeholder="salesforce-crm"
							oninput={() => checkSubdomain(formSubdomain)}
						/>
						{#if subdomainStatus === 'checking'}
							<div class="absolute right-2.5 top-1/2 -translate-y-1/2">
								<Loader2 class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
							</div>
						{:else if subdomainStatus === 'available'}
							<div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
								<Check class="h-3.5 w-3.5 text-emerald-500" />
								<span class="text-[10px] font-medium text-emerald-500">Disponible</span>
							</div>
						{:else if subdomainStatus === 'taken'}
							<div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
								<X class="h-3.5 w-3.5 text-destructive" />
								<span class="text-[10px] font-medium text-destructive">Indisponible</span>
							</div>
						{:else if subdomainStatus === 'invalid'}
							<div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
								<X class="h-3.5 w-3.5 text-destructive" />
								<span class="text-[10px] font-medium text-destructive">Format invalide</span>
							</div>
						{/if}
					</div>
					<span class="text-xs text-muted-foreground shrink-0">.env-ll.com</span>
				</div>
			</div>

			<div class="space-y-1.5">
				<label for="project-description" class="text-sm font-medium text-foreground">Description <span class="text-muted-foreground">(optionnel)</span></label>
				<textarea
					id="project-description"
					bind:value={formDescription}
					placeholder="Description du projet..."
					rows="2"
					class="flex w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>

			{#if !editingProject}
				<div class="space-y-1.5">
					<label for="project-version" class="text-sm font-medium text-foreground">Version (sous projet)</label>
					<Input
						id="project-version"
						bind:value={formVersionName}
						placeholder="Version 1"
					/>
				</div>
			{/if}

			{#if formError}
				<p class="text-sm text-destructive">{formError}</p>
			{/if}

			<DialogFooter>
				<Button variant="outline" type="button" onclick={() => { dialogOpen = false; }}>
					Annuler
				</Button>
				<Button type="submit" disabled={formSubmitting}>
					{#if formSubmitting}
						Enregistrement...
					{:else}
						{editingProject ? 'Enregistrer' : 'Créer le projet'}
					{/if}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>

<!-- Delete Confirmation Dialog -->
<Dialog bind:open={deleteDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Supprimer le projet</DialogTitle>
			<DialogDescription>
				Êtes-vous sûr de vouloir supprimer <strong>{deletingProject?.name}</strong> ? Cette action est irréversible et supprimera toutes les versions et pages associées.
			</DialogDescription>
		</DialogHeader>
		<DialogFooter>
			<Button variant="outline" onclick={() => { deleteDialogOpen = false; }}>
				Annuler
			</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={deleteSubmitting}>
				{deleteSubmitting ? 'Suppression...' : 'Supprimer'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
