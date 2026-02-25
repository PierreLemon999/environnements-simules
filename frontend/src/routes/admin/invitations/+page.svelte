<script lang="ts">
	import { onMount } from 'svelte';
	import { get, post, del } from '$lib/api';
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
	} from 'lucide-svelte';

	interface Project {
		id: string;
		name: string;
		toolName: string;
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
		user: { id: string; name: string; email: string };
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

	// Create dialog
	let createDialogOpen = $state(false);
	let formEmail = $state('');
	let formName = $state('');
	let formCompany = $state('');
	let formProjectId = $state('');
	let formVersionId = $state('');
	let formExpiryDays = $state(90);
	let formSubmitting = $state(false);
	let formError = $state('');

	// Credentials display
	let showCredentials = $state(false);
	let createdCredentials: { accessToken: string; password: string; email: string } | null = $state(null);
	let passwordVisible = $state(false);
	let copiedField = $state('');

	// Delete dialog
	let deleteDialogOpen = $state(false);
	let deletingAssignment: Assignment | null = $state(null);
	let deleteSubmitting = $state(false);

	let availableVersions = $derived(() => {
		if (!formProjectId) return [];
		const project = projects.find(p => p.id === formProjectId);
		return project?.versions ?? [];
	});

	let totalInvitations = $derived(assignments.length);
	let activeClients = $derived(
		assignments.filter(a => new Date(a.expiresAt) > new Date()).length
	);

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

	function openCreateDialog() {
		formEmail = '';
		formName = '';
		formCompany = '';
		formProjectId = projects[0]?.id ?? '';
		formVersionId = '';
		formExpiryDays = 90;
		formError = '';
		showCredentials = false;
		createdCredentials = null;
		createDialogOpen = true;
	}

	async function handleCreate() {
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
			});

			createdCredentials = {
				accessToken: res.data.accessToken,
				password: res.data.password,
				email: formEmail.trim(),
			};
			showCredentials = true;
			toast.success('Invitation créée');

			// Reload assignments
			await loadAllAssignments();
		} catch (err: any) {
			formError = err.message || 'Erreur lors de la création.';
		} finally {
			formSubmitting = false;
		}
	}

	async function copyToClipboard(text: string, field: string) {
		await navigator.clipboard.writeText(text);
		copiedField = field;
		setTimeout(() => { copiedField = ''; }, 2000);
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
			toast.success('Invitation supprimée');
		} catch (err) {
			toast.error('Erreur lors de la suppression');
		} finally {
			deleteSubmitting = false;
		}
	}

	onMount(async () => {
		try {
			const res = await get<{ data: Array<Project & { versions?: Version[] }> }>('/projects');
			// Load versions for each project
			const projectsWithVersions: Project[] = [];
			for (const p of res.data) {
				try {
					const detail = await get<{ data: { versions: Version[] } }>(`/projects/${p.id}`);
					projectsWithVersions.push({ ...p, versions: detail.data.versions ?? [] });
				} catch {
					projectsWithVersions.push({ ...p, versions: [] });
				}
			}
			projects = projectsWithVersions;

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
		<Button size="sm" class="gap-1.5" onclick={openCreateDialog}>
			<Plus class="h-3.5 w-3.5" />
			Nouvelle invitation
		</Button>
	</div>

	<!-- Stats cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
								<TrendingUp class="h-3 w-3" />
								Total
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
						<p class="text-xs font-medium text-muted-foreground">Clients actifs</p>
						<p class="mt-1 text-2xl font-bold text-foreground">
							{#if loading}
								<span class="skeleton inline-block h-8 w-12"></span>
							{:else}
								{activeClients}
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
						<Users class="h-5 w-5 text-success" />
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Client list -->
	<Card>
		<CardHeader class="pb-3">
			<CardTitle class="text-base">Liste des clients</CardTitle>
		</CardHeader>
		<CardContent>
			{#if loading || assignmentsLoading}
				<div class="space-y-3">
					{#each Array(4) as _}
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
					<Button size="sm" class="mt-4 gap-1.5" onclick={openCreateDialog}>
						<Plus class="h-3.5 w-3.5" />
						Nouvelle invitation
					</Button>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-border">
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Client</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Email</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Démo assignée</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Expiration</th>
								<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Statut</th>
								<th class="pb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each assignments as assignment}
								{@const expired = isExpired(assignment.expiresAt)}
								{@const daysLeft = getDaysUntilExpiry(assignment.expiresAt)}
								<tr class="border-b border-border last:border-0">
									<td class="py-3 pr-4">
										<div class="flex items-center gap-3">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
												{assignment.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
											</div>
											<span class="text-sm font-medium text-foreground">{assignment.user.name}</span>
										</div>
									</td>
									<td class="py-3 pr-4">
										<span class="text-sm text-muted-foreground">{assignment.user.email}</span>
									</td>
									<td class="py-3 pr-4">
										<span class="text-sm text-foreground">{getVersionName(assignment.versionId)}</span>
									</td>
									<td class="py-3 pr-4">
										<div class="flex items-center gap-1.5">
											<Calendar class="h-3 w-3 text-muted" />
											<span class="text-xs text-muted-foreground">{formatDate(assignment.expiresAt)}</span>
										</div>
									</td>
									<td class="py-3 pr-4">
										{#if expired}
											<Badge variant="destructive">Expiré</Badge>
										{:else if daysLeft < 30}
											<Badge variant="warning">Expire bientôt</Badge>
										{:else}
											<Badge variant="success">Actif</Badge>
										{/if}
									</td>
									<td class="py-3 text-right">
										<div class="flex items-center justify-end gap-1">
											<button
												class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground"
												onclick={() => copyToClipboard(assignment.accessToken, `token-${assignment.id}`)}
												title="Copier le token d'accès"
											>
												{#if copiedField === `token-${assignment.id}`}
													<Check class="h-3.5 w-3.5 text-success" />
												{:else}
													<Link2 class="h-3.5 w-3.5" />
												{/if}
											</button>
											<button
												class="rounded-md p-1.5 text-muted transition-colors hover:bg-destructive-bg hover:text-destructive"
												onclick={() => openDeleteDialog(assignment)}
												title="Supprimer"
											>
												<Trash2 class="h-3.5 w-3.5" />
											</button>
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
</div>

<!-- Create Invitation Dialog -->
<Dialog bind:open={createDialogOpen}>
	<DialogContent class="max-w-lg">
		{#if showCredentials && createdCredentials}
			<DialogHeader>
				<DialogTitle>Invitation créée</DialogTitle>
				<DialogDescription>
					Les identifiants ci-dessous ne seront affichés qu'une seule fois. Copiez-les maintenant.
				</DialogDescription>
			</DialogHeader>
			<div class="space-y-4">
				<div class="rounded-lg border border-success-border bg-success-bg p-4">
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-foreground">Email</span>
							<div class="flex items-center gap-2">
								<code class="rounded bg-white px-2 py-0.5 font-mono text-sm">{createdCredentials.email}</code>
								<button onclick={() => copyToClipboard(createdCredentials!.email, 'cred-email')} class="rounded p-1 hover:bg-white/50">
									{#if copiedField === 'cred-email'}
										<Check class="h-3.5 w-3.5 text-success" />
									{:else}
										<Copy class="h-3.5 w-3.5 text-muted-foreground" />
									{/if}
								</button>
							</div>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-foreground">Mot de passe</span>
							<div class="flex items-center gap-2">
								<code class="rounded bg-white px-2 py-0.5 font-mono text-sm">
									{passwordVisible ? createdCredentials.password : '••••••••'}
								</code>
								<button onclick={() => { passwordVisible = !passwordVisible; }} class="rounded p-1 hover:bg-white/50">
									{#if passwordVisible}
										<EyeOff class="h-3.5 w-3.5 text-muted-foreground" />
									{:else}
										<Eye class="h-3.5 w-3.5 text-muted-foreground" />
									{/if}
								</button>
								<button onclick={() => copyToClipboard(createdCredentials!.password, 'cred-pass')} class="rounded p-1 hover:bg-white/50">
									{#if copiedField === 'cred-pass'}
										<Check class="h-3.5 w-3.5 text-success" />
									{:else}
										<Copy class="h-3.5 w-3.5 text-muted-foreground" />
									{/if}
								</button>
							</div>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-foreground">Token d'accès</span>
							<div class="flex items-center gap-2">
								<code class="max-w-40 truncate rounded bg-white px-2 py-0.5 font-mono text-sm">{createdCredentials.accessToken}</code>
								<button onclick={() => copyToClipboard(createdCredentials!.accessToken, 'cred-token')} class="rounded p-1 hover:bg-white/50">
									{#if copiedField === 'cred-token'}
										<Check class="h-3.5 w-3.5 text-success" />
									{:else}
										<Copy class="h-3.5 w-3.5 text-muted-foreground" />
									{/if}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
			<DialogFooter>
				<Button onclick={() => { createDialogOpen = false; showCredentials = false; createdCredentials = null; passwordVisible = false; }}>
					Fermer
				</Button>
			</DialogFooter>
		{:else}
			<DialogHeader>
				<DialogTitle>Nouvelle invitation</DialogTitle>
				<DialogDescription>
					Invitez un client à accéder à une démo. Un mot de passe sera généré automatiquement.
				</DialogDescription>
			</DialogHeader>
			<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<label for="invite-name" class="text-sm font-medium text-foreground">Nom</label>
						<Input id="invite-name" bind:value={formName} placeholder="Jean Dupont" />
					</div>
					<div class="space-y-2">
						<label for="invite-email" class="text-sm font-medium text-foreground">Email</label>
						<Input id="invite-email" bind:value={formEmail} placeholder="jean@acme.com" type="email" />
					</div>
				</div>

				<div class="space-y-2">
					<label for="invite-company" class="text-sm font-medium text-foreground">Entreprise <span class="text-muted-foreground">(optionnel)</span></label>
					<Input id="invite-company" bind:value={formCompany} placeholder="Acme Corp" />
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<label for="invite-project" class="text-sm font-medium text-foreground">Projet</label>
						<select
							id="invite-project"
							bind:value={formProjectId}
							onchange={() => { formVersionId = ''; }}
							class="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<option value="" disabled>Sélectionner un projet</option>
							{#each projects as project}
								<option value={project.id}>{project.name}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<label for="invite-version" class="text-sm font-medium text-foreground">Version</label>
						<select
							id="invite-version"
							bind:value={formVersionId}
							class="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							disabled={!formProjectId}
						>
							<option value="" disabled>Sélectionner une version</option>
							{#each availableVersions() as version}
								<option value={version.id}>{version.name} ({version.status})</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="space-y-2">
					<label for="invite-expiry" class="text-sm font-medium text-foreground">Expiration</label>
					<select
						id="invite-expiry"
						bind:value={formExpiryDays}
						class="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<option value={30}>1 mois</option>
						<option value={90}>3 mois (recommandé)</option>
						<option value={180}>6 mois</option>
						<option value={365}>1 an</option>
						<option value={730}>2 ans</option>
					</select>
				</div>

				{#if formError}
					<p class="text-sm text-destructive">{formError}</p>
				{/if}

				<DialogFooter>
					<Button variant="outline" type="button" onclick={() => { createDialogOpen = false; }}>Annuler</Button>
					<Button type="submit" disabled={formSubmitting} class="gap-1.5">
						{#if formSubmitting}
							Création...
						{:else}
							<Send class="h-3.5 w-3.5" />
							Envoyer l'invitation
						{/if}
					</Button>
				</DialogFooter>
			</form>
		{/if}
	</DialogContent>
</Dialog>

<!-- Delete Dialog -->
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
