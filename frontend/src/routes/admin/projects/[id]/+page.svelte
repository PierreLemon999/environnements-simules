<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { get, post, put, del } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
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
	} from 'lucide-svelte';

	interface Version {
		id: string;
		projectId: string;
		name: string;
		status: 'active' | 'test' | 'deprecated';
		language: string;
		authorId: string;
		createdAt: string;
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
	}

	let project: ProjectDetail | null = $state(null);
	let loading = $state(true);
	let error = $state('');

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

	// Duplicate version state
	let duplicateSubmitting = $state<string | null>(null);
	let exportingVersion = $state<string | null>(null);

	let projectId = $derived($page.params.id);

	// Status badge variant mapping
	function getStatusVariant(status: string): 'success' | 'warning' | 'secondary' {
		switch (status) {
			case 'active':
				return 'success';
			case 'test':
				return 'warning';
			case 'deprecated':
				return 'secondary';
			default:
				return 'secondary';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'active':
				return 'Actif';
			case 'test':
				return 'Test';
			case 'deprecated':
				return 'Obsolète';
			default:
				return status;
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

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

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

	onMount(async () => {
		try {
			const res = await get<{ data: ProjectDetail }>(`/projects/${projectId}`);
			project = res.data;
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
	<!-- Back + Header -->
	<div>
		<button
			class="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
			onclick={() => goto('/admin/projects')}
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Retour aux projets
		</button>

		{#if loading}
			<div class="space-y-2">
				<div class="skeleton h-6 w-64"></div>
				<div class="skeleton h-4 w-40"></div>
			</div>
		{:else if error}
			<Card>
				<CardContent class="py-16 text-center">
					<p class="text-sm text-destructive">{error}</p>
					<Button variant="outline" size="sm" class="mt-4" onclick={() => goto('/admin/projects')}>
						Retour aux projets
					</Button>
				</CardContent>
			</Card>
		{:else if project}
			<div class="flex items-start justify-between">
				<div>
					<h1 class="text-lg font-semibold text-foreground">{project.name}</h1>
					<div class="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
						<span class="inline-flex items-center gap-1">
							<Globe class="h-3.5 w-3.5" />
							{project.subdomain}.demo.lemonlearning.com
						</span>
						<span>·</span>
						<span>{project.toolName}</span>
					</div>
					{#if project.description}
						<p class="mt-2 max-w-xl text-sm text-muted-foreground">{project.description}</p>
					{/if}
				</div>
				<Button size="sm" class="gap-1.5" onclick={openCreateVersionDialog}>
					<Plus class="h-3.5 w-3.5" />
					Nouvelle version
				</Button>
			</div>
		{/if}
	</div>

	<!-- Versions list -->
	{#if !loading && !error && project}
		<Card>
			<CardHeader class="pb-3">
				<div class="flex items-center justify-between">
					<CardTitle class="text-base">
						Versions
						<span class="ml-1 text-sm font-normal text-muted-foreground">
							({project.versions.length})
						</span>
					</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				{#if project.versions.length === 0}
					<div class="flex flex-col items-center justify-center py-12">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
							<Layers class="h-6 w-6 text-muted" />
						</div>
						<p class="mt-4 text-sm font-medium text-foreground">Aucune version</p>
						<p class="mt-1 text-sm text-muted-foreground">Créez la première version de ce projet.</p>
						<Button size="sm" class="mt-4 gap-1.5" onclick={openCreateVersionDialog}>
							<Plus class="h-3.5 w-3.5" />
							Nouvelle version
						</Button>
					</div>
				{:else}
					<!-- Versions table -->
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead>
								<tr class="border-b border-border">
									<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nom</th>
									<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
									<th class="hidden pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">Langue</th>
									<th class="hidden pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Créée le</th>
									<th class="pb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each project.versions as version}
									<tr class="group border-b border-border last:border-0">
										<td class="py-3 pr-4">
											<div class="flex items-center gap-3">
												<div class="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-xs font-medium text-foreground">
													{version.name.slice(0, 2).toUpperCase()}
												</div>
												<div>
													<p class="text-sm font-medium text-foreground">{version.name}</p>
												</div>
											</div>
										</td>
										<td class="py-3 pr-4">
											<Badge variant={getStatusVariant(version.status)}>
												{getStatusLabel(version.status)}
											</Badge>
										</td>
										<td class="hidden py-3 pr-4 sm:table-cell">
											<span class="text-sm text-muted-foreground">{getLanguageLabel(version.language)}</span>
										</td>
										<td class="hidden py-3 pr-4 md:table-cell">
											<span class="text-sm text-muted-foreground">{formatDate(version.createdAt)}</span>
										</td>
										<td class="py-3 text-right">
											<div class="flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="icon"
													class="h-8 w-8"
													onclick={() => goto(`/admin/tree?version=${version.id}`)}
													title="Voir l'arborescence"
												>
													<ExternalLink class="h-3.5 w-3.5" />
												</Button>
												<DropdownMenu>
													<DropdownMenuTrigger>
														<button class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground">
															<MoreVertical class="h-4 w-4" />
														</button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem onclick={() => openEditVersionDialog(version)}>
															<Pencil class="mr-2 h-3.5 w-3.5" />
															Modifier
														</DropdownMenuItem>
														<DropdownMenuItem
															onclick={() => handleDuplicateVersion(version)}
															disabled={duplicateSubmitting === version.id}
														>
															<Copy class="mr-2 h-3.5 w-3.5" />
															{duplicateSubmitting === version.id ? 'Duplication...' : 'Dupliquer'}
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
					<option value="deprecated">Obsolète</option>
				</select>
			</div>

			<div class="space-y-2">
				<label for="version-language" class="text-sm font-medium text-foreground">Langue</label>
				<select
					id="version-language"
					bind:value={versionLanguage}
					class="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<option value="fr">Français</option>
					<option value="en">English</option>
					<option value="de">Deutsch</option>
					<option value="es">Español</option>
					<option value="it">Italiano</option>
					<option value="pt">Português</option>
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
