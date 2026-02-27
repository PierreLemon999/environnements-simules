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
	let formToolName = $state('');
	let formSubdomain = $state('');
	let formDescription = $state('');
	let formLogoUrl = $state('');
	let formIconColor = $state('');
	let formVersionName = $state('Version 1');
	let formSubmitting = $state(false);
	let formError = $state('');

	// Tool selector state
	let toolSearchQuery = $state('');
	let toolDropdownOpen = $state(false);
	let customTools: string[] = $state([]);
	let creatingNewTool = $state(false);
	let newToolName = $state('');
	let logoFileInput: HTMLInputElement | undefined = $state();

	// Delete confirmation dialog
	let deleteDialogOpen = $state(false);
	let deletingProject: Project | null = $state(null);
	let deleteSubmitting = $state(false);

	// FAB visibility — shown when header "Nouveau projet" button is scrolled out of view
	let headerButtonEl: HTMLElement | undefined = $state();
	let showFab = $state(false);

	// Tool name options
	const toolOptions = [
		'Salesforce',
		'SAP SuccessFactors',
		'Workday',
		'ServiceNow',
		'HubSpot',
		'Zendesk',
		'Oracle',
		'Microsoft Dynamics',
		'Jira',
		'Confluence',
		'Autre',
	];

	// Filtered tools for searchable dropdown
	let filteredTools = $derived(() => {
		const all = [...toolOptions.filter(t => t !== 'Autre'), ...customTools];
		if (!toolSearchQuery.trim()) return all;
		const q = toolSearchQuery.toLowerCase();
		return all.filter(t => t.toLowerCase().includes(q));
	});

	function selectTool(tool: string) {
		formToolName = tool;
		toolSearchQuery = '';
		toolDropdownOpen = false;
	}

	function startCreateTool() {
		creatingNewTool = true;
		newToolName = toolSearchQuery;
	}

	function confirmCreateTool() {
		if (newToolName.trim()) {
			customTools = [...customTools, newToolName.trim()];
			formToolName = newToolName.trim();
			newToolName = '';
			creatingNewTool = false;
			toolDropdownOpen = false;
			toolSearchQuery = '';
		}
	}

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
			'Microsoft Dynamics': '#0078D4',
			'Jira': '#0052CC',
			'Confluence': '#1868DB',
		};
		return colors[toolName] ?? '#6D7481';
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

	let filteredProjects = $derived(() => {
		let result = projects;

		// Status filter — requires per-project version status data (active/test/deprecated)
		// which is not loaded in the list endpoint. For now, we approximate:
		// - "active" = has at least one version (versionCount > 0)
		// - "archived" = no versions (versionCount === 0)
		// - "test" = not distinguishable without version-level status data
		// TODO: add version status breakdown to GET /projects response for proper filtering
		if (statusFilter === 'active') {
			result = result.filter((p) => p.versionCount > 0);
		} else if (statusFilter === 'archived') {
			result = result.filter((p) => p.versionCount === 0);
		}
		// 'test' filter is a no-op until version status data is available

		// Search filter
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(p) =>
					p.name.toLowerCase().includes(q) ||
					p.toolName.toLowerCase().includes(q) ||
					p.subdomain.toLowerCase().includes(q)
			);
		}

		return result;
	});

	function openCreateDialog() {
		editingProject = null;
		formName = '';
		formToolName = '';
		formSubdomain = '';
		formDescription = '';
		formLogoUrl = '';
		formIconColor = '';
		formVersionName = 'Version 1';
		formError = '';
		toolSearchQuery = '';
		toolDropdownOpen = false;
		creatingNewTool = false;
		dialogOpen = true;
	}

	function openEditDialog(project: Project) {
		editingProject = project;
		formName = project.name;
		formToolName = project.toolName;
		formSubdomain = project.subdomain;
		formDescription = project.description ?? '';
		formLogoUrl = project.logoUrl ?? '';
		formIconColor = project.iconColor ?? getToolColor(project.toolName);
		formError = '';
		toolSearchQuery = '';
		toolDropdownOpen = false;
		creatingNewTool = false;
		dialogOpen = true;
	}

	function openDeleteDialog(project: Project) {
		deletingProject = project;
		deleteDialogOpen = true;
	}

	async function handleSubmit() {
		if (!formName.trim() || !formToolName.trim()) {
			formError = 'Le nom et l\'outil sont requis.';
			return;
		}

		formSubmitting = true;
		formError = '';

		try {
			const body = {
				name: formName.trim(),
				toolName: formToolName.trim(),
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
					} catch {
						// Project created but version failed — not blocking
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

	onDestroy(() => {
		window.removeEventListener('open-create-project', handleCreateProjectEvent);
		observer?.disconnect();
	});
</script>

<svelte:window onclick={(e) => {
	if (toolDropdownOpen) {
		const target = e.target as HTMLElement;
		if (!target.closest('.tool-dropdown-container')) {
			toolDropdownOpen = false;
			creatingNewTool = false;
		}
	}
}} />

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
						<a href="/admin/projects/{project.id}" class="block">
							<div class="flex items-start gap-3">
								{#if project.logoUrl}
									<img
										src={project.logoUrl}
										alt={project.toolName}
										class="h-10 w-10 shrink-0 rounded-lg object-cover"
									/>
								{:else}
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
										style="background-color: {project.iconColor || getToolColor(project.toolName)}"
									>
										{project.toolName.slice(0, 2).toUpperCase()}
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
									<p class="text-xs text-muted-foreground">{project.toolName}</p>
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
	{/if}
</div>

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
				</div>

				<!-- Name + Tool -->
				<div class="flex-1 space-y-3">
					<div class="space-y-1.5">
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

					<!-- Searchable tool selector -->
					<div class="space-y-1.5">
						<label class="text-sm font-medium text-foreground">Outil simulé</label>
						<div class="relative tool-dropdown-container">
							<button
								type="button"
								class="flex h-9 w-full items-center justify-between rounded-md border border-border bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onclick={() => { toolDropdownOpen = !toolDropdownOpen; creatingNewTool = false; }}
							>
								<span class={formToolName ? 'text-foreground' : 'text-muted'}>
									{formToolName || 'Sélectionner un outil'}
								</span>
								<ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
							</button>

							{#if toolDropdownOpen}
								<div class="absolute left-0 top-[calc(100%+4px)] z-50 w-full rounded-md border border-border bg-card shadow-lg">
									<!-- Search input -->
									<div class="border-b border-border p-2">
										<div class="relative">
											<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
											<input
												type="text"
												class="h-8 w-full rounded-md border border-border bg-transparent pl-8 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring"
												placeholder="Rechercher un outil..."
												bind:value={toolSearchQuery}
											/>
										</div>
									</div>

									{#if creatingNewTool}
										<!-- Create new tool inline -->
										<div class="p-2 space-y-2">
											<p class="text-xs font-medium text-muted-foreground px-1">Nouvel outil</p>
											<div class="flex gap-2">
												<input
													type="text"
													class="h-8 flex-1 rounded-md border border-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
													placeholder="Nom de l'outil..."
													bind:value={newToolName}
													onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmCreateTool(); } }}
												/>
												<Button size="sm" type="button" class="h-8 px-3" onclick={confirmCreateTool}>
													Créer
												</Button>
											</div>
										</div>
									{:else}
										<!-- Tool list -->
										<div class="max-h-48 overflow-y-auto p-1">
											{#each filteredTools() as tool}
												<button
													type="button"
													class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent {tool === formToolName ? 'bg-accent font-medium text-primary' : 'text-foreground'}"
													onclick={() => selectTool(tool)}
												>
													<span
														class="h-2.5 w-2.5 shrink-0 rounded-full"
														style="background-color: {getToolColor(tool)}"
													></span>
													{tool}
												</button>
											{:else}
												<p class="px-3 py-2 text-sm text-muted-foreground">Aucun outil trouvé</p>
											{/each}
										</div>

										<!-- Create new tool button -->
										<div class="border-t border-border p-1">
											<button
												type="button"
												class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-accent"
												onclick={startCreateTool}
											>
												<Plus class="h-3.5 w-3.5" />
												Créer un nouvel outil
											</button>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<div class="space-y-1.5">
				<label for="project-subdomain" class="text-sm font-medium text-foreground">Sous-domaine des démos</label>
				<div class="flex items-center gap-2">
					<Input
						id="project-subdomain"
						bind:value={formSubdomain}
						placeholder="salesforce-crm"
						class="flex-1"
					/>
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

			<div class="space-y-1.5">
				<label for="project-icon-color" class="text-sm font-medium text-foreground">Couleur de l'icône</label>
				<div class="flex items-center gap-3">
					<label class="relative h-8 w-8 shrink-0 cursor-pointer rounded-full border border-border shadow-xs transition-shadow hover:shadow-md" style="background-color: {formIconColor || '#6D7481'}">
						<input type="color" id="project-icon-color" bind:value={formIconColor} class="absolute inset-0 cursor-pointer opacity-0" />
					</label>
					<span class="text-xs text-muted-foreground font-mono">{formIconColor || '#6D7481'}</span>
					<span class="text-xs text-muted-foreground">Extraite automatiquement du logo</span>
				</div>
			</div>

			{#if !editingProject}
				<div class="space-y-1.5">
					<label for="project-version" class="text-sm font-medium text-foreground">Première version <span class="text-muted-foreground">(optionnel)</span></label>
					<Input
						id="project-version"
						bind:value={formVersionName}
						placeholder="Version 1"
						class=""
					/>
					<p class="text-xs text-muted-foreground">Laissez vide pour ne pas créer de version.</p>
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
