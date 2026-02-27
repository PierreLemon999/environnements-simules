<script lang="ts">
	import { onMount } from 'svelte';
	import { get, post, put, del } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { user as currentUser } from '$lib/stores/auth';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import { Tabs, TabsList, TabsTrigger } from '$components/ui/tabs';
	import { Avatar, AvatarFallback, AvatarImage } from '$components/ui/avatar';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter,
	} from '$components/ui/dialog';
	import { SearchableSelect } from '$components/ui/searchable-select';
	import {
		Users,
		Plus,
		Search,
		Pencil,
		Trash2,
		Shield,
		User,
		Mail,
		Calendar,
		MoreVertical,
	} from 'lucide-svelte';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
	} from '$components/ui/dropdown-menu';

	interface UserRecord {
		id: string;
		name: string;
		email: string;
		role: 'admin' | 'client';
		company: string | null;
		avatarUrl: string | null;
		googleId: string | null;
		language: string;
		createdAt: string;
	}

	let users: UserRecord[] = $state([]);
	let loading = $state(true);
	let roleFilter = $state('all');
	let searchQuery = $state('');

	// Create/Edit dialog
	let dialogOpen = $state(false);
	let editingUser: UserRecord | null = $state(null);
	let formName = $state('');
	let formEmail = $state('');
	let formPassword = $state('');
	let formRole = $state<'admin' | 'client'>('client');
	let formCompany = $state('');
	let formSubmitting = $state(false);
	let formError = $state('');

	// Delete dialog
	let deleteDialogOpen = $state(false);
	let deletingUser: UserRecord | null = $state(null);
	let deleteSubmitting = $state(false);
	let deleteError = $state('');

	let filteredUsers = $derived.by(() => {
		let result = users;

		if (roleFilter !== 'all') {
			result = result.filter(u => u.role === roleFilter);
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(u =>
				u.name.toLowerCase().includes(q) ||
				u.email.toLowerCase().includes(q) ||
				(u.company ?? '').toLowerCase().includes(q)
			);
		}

		return result;
	});

	let adminCount = $derived(users.filter(u => u.role === 'admin').length);
	let clientCount = $derived(users.filter(u => u.role === 'client').length);

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		});
	}

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map(n => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	function openCreateDialog() {
		editingUser = null;
		formName = '';
		formEmail = '';
		formPassword = '';
		formRole = 'client';
		formCompany = '';
		formError = '';
		dialogOpen = true;
	}

	function openEditDialog(user: UserRecord) {
		editingUser = user;
		formName = user.name;
		formEmail = user.email;
		formPassword = '';
		formRole = user.role;
		formCompany = user.company ?? '';
		formError = '';
		dialogOpen = true;
	}

	function openDeleteDialog(user: UserRecord) {
		deletingUser = user;
		deleteError = '';
		deleteDialogOpen = true;
	}

	async function handleSubmit() {
		if (!formName.trim() || !formEmail.trim()) {
			formError = 'Le nom et l\'email sont requis.';
			return;
		}

		formSubmitting = true;
		formError = '';

		try {
			const body: Record<string, unknown> = {
				name: formName.trim(),
				email: formEmail.trim(),
				role: formRole,
			};
			if (formRole === 'client' && formCompany.trim()) {
				body.company = formCompany.trim();
			}
			if (formPassword.trim()) {
				body.password = formPassword.trim();
			}

			if (editingUser) {
				const res = await put<{ data: UserRecord }>(`/users/${editingUser.id}`, body);
				users = users.map(u => u.id === editingUser!.id ? res.data : u);
				toast.success('Utilisateur modifié');
			} else {
				if (!formPassword.trim()) {
					formError = 'Un mot de passe est requis pour les nouveaux utilisateurs.';
					formSubmitting = false;
					return;
				}
				const res = await post<{ data: UserRecord }>('/users', body);
				users = [res.data, ...users];
				toast.success('Utilisateur créé');
			}
			dialogOpen = false;
		} catch (err: any) {
			formError = err.message || 'Erreur lors de la sauvegarde.';
		} finally {
			formSubmitting = false;
		}
	}

	async function handleDelete() {
		if (!deletingUser) return;
		deleteSubmitting = true;
		deleteError = '';

		try {
			await del(`/users/${deletingUser.id}`);
			users = users.filter(u => u.id !== deletingUser!.id);
			deleteDialogOpen = false;
			deletingUser = null;
			toast.success('Utilisateur supprimé');
		} catch (err: any) {
			deleteError = err.message || 'Impossible de supprimer cet utilisateur.';
			toast.error(deleteError);
		} finally {
			deleteSubmitting = false;
		}
	}

	onMount(async () => {
		try {
			const res = await get<{ data: UserRecord[] }>('/users');
			users = res.data;
		} catch (err) {
			console.error('Failed to load users:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Utilisateurs — Environnements Simulés</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold text-foreground">Utilisateurs</h2>
			<p class="text-sm text-muted-foreground">
				{users.length} utilisateur{users.length !== 1 ? 's' : ''} — {adminCount} admin{adminCount !== 1 ? 's' : ''}, {clientCount} client{clientCount !== 1 ? 's' : ''}
			</p>
		</div>
		<Button size="sm" class="gap-1.5" onclick={openCreateDialog}>
			<Plus class="h-3.5 w-3.5" />
			Nouvel utilisateur
		</Button>
	</div>

	<!-- Filters -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<Tabs value={roleFilter} onValueChange={(v) => { roleFilter = v; }}>
			<TabsList>
				<TabsTrigger value="all">Tous ({users.length})</TabsTrigger>
				<TabsTrigger value="admin">Admins ({adminCount})</TabsTrigger>
				<TabsTrigger value="client">Clients ({clientCount})</TabsTrigger>
			</TabsList>
		</Tabs>

		<div class="relative w-full sm:w-64">
			<Search class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
			<Input bind:value={searchQuery} placeholder="Rechercher un utilisateur..." class="pl-9" />
		</div>
	</div>

	<!-- User list -->
	{#if loading}
		<div class="space-y-2">
			{#each Array(5) as _}
				<Card>
					<CardContent class="p-4">
						<div class="flex items-center gap-4">
							<div class="skeleton h-10 w-10 rounded-full"></div>
							<div class="flex-1 space-y-2">
								<div class="skeleton h-4 w-32"></div>
								<div class="skeleton h-3 w-48"></div>
							</div>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{:else if filteredUsers.length === 0}
		<Card>
			<CardContent class="flex flex-col items-center justify-center py-16">
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
					<Users class="h-6 w-6 text-muted" />
				</div>
				<p class="mt-4 text-sm font-medium text-foreground">
					{searchQuery ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}
				</p>
				<p class="mt-1 text-sm text-muted-foreground">
					{searchQuery ? 'Essayez avec d\'autres termes.' : 'Ajoutez votre premier utilisateur.'}
				</p>
			</CardContent>
		</Card>
	{:else}
		<div class="space-y-2">
			{#each filteredUsers as user}
				{@const isCurrentUser = $currentUser?.id === user.id}
				<Card class="group transition-shadow hover:shadow-md">
					<CardContent class="p-4">
						<div class="flex items-center gap-4">
							<!-- Avatar -->
							<Avatar class="h-10 w-10">
								<AvatarImage src={user.avatarUrl} alt={user.name} />
								<AvatarFallback class={user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground'}>
									{getInitials(user.name)}
								</AvatarFallback>
							</Avatar>

							<!-- User info -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<p class="font-medium text-foreground">{user.name}</p>
									{#if isCurrentUser}
										<Badge variant="secondary" class="text-[10px]">Vous</Badge>
									{/if}
								</div>
								<div class="flex items-center gap-3 text-xs text-muted-foreground">
									<span class="inline-flex items-center gap-1">
										<Mail class="h-3 w-3" />
										{user.email}
									</span>
									{#if user.company}
										<span class="text-muted">·</span>
										<span>{user.company}</span>
									{/if}
									{#if user.googleId}
										<span class="inline-flex items-center gap-1 text-primary">
											<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none">
												<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
												<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
												<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
												<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
											</svg>
											Google SSO
										</span>
									{/if}
								</div>
							</div>

							<!-- Role badge -->
							<Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
								{#if user.role === 'admin'}
									<Shield class="mr-1 h-3 w-3" />
								{:else}
									<User class="mr-1 h-3 w-3" />
								{/if}
								{user.role === 'admin' ? 'Administrateur' : 'Client'}
							</Badge>

							<!-- Date -->
							<div class="hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
								<Calendar class="h-3 w-3" />
								{formatDate(user.createdAt)}
							</div>

							<!-- Actions -->
							<DropdownMenu>
								<DropdownMenuTrigger>
									<button class="rounded-md p-1 text-muted opacity-50 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100">
										<MoreVertical class="h-4 w-4" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onclick={() => openEditDialog(user)}>
										<Pencil class="mr-2 h-3.5 w-3.5" />
										Modifier
									</DropdownMenuItem>
									{#if !isCurrentUser}
										<DropdownMenuSeparator />
										<DropdownMenuItem class="text-destructive" onclick={() => openDeleteDialog(user)}>
											<Trash2 class="mr-2 h-3.5 w-3.5" />
											Supprimer
										</DropdownMenuItem>
									{/if}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- Create/Edit Dialog -->
<Dialog bind:open={dialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>{editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
			<DialogDescription>
				{editingUser ? 'Modifiez les informations de l\'utilisateur.' : 'Créez un nouveau compte utilisateur.'}
			</DialogDescription>
		</DialogHeader>
		<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<div class="space-y-2">
				<label for="user-name" class="text-sm font-medium text-foreground">Nom</label>
				<Input id="user-name" bind:value={formName} placeholder="Jean Dupont" />
			</div>
			<div class="space-y-2">
				<label for="user-email" class="text-sm font-medium text-foreground">Email</label>
				<Input id="user-email" bind:value={formEmail} placeholder="jean@example.com" type="email" />
			</div>
			<div class="space-y-2">
				<label for="user-password" class="text-sm font-medium text-foreground">
					Mot de passe
					{#if editingUser}
						<span class="text-muted-foreground">(laisser vide pour ne pas modifier)</span>
					{/if}
				</label>
				<Input id="user-password" bind:value={formPassword} placeholder="••••••••" type="password" />
			</div>
			<div class="space-y-2">
				<label for="user-role" class="text-sm font-medium text-foreground">Rôle</label>
				<SearchableSelect
					bind:value={formRole}
					options={[
						{ value: 'admin', label: 'Administrateur' },
						{ value: 'client', label: 'Client' },
					]}
					placeholder="Sélectionner un rôle"
				/>
			</div>
			{#if formRole === 'client'}
				<div class="space-y-2">
					<label for="user-company" class="text-sm font-medium text-foreground">Entreprise</label>
					<Input id="user-company" bind:value={formCompany} placeholder="Nom de l'entreprise" />
				</div>
			{/if}

			{#if formError}
				<p class="text-sm text-destructive">{formError}</p>
			{/if}

			<DialogFooter>
				<Button variant="outline" type="button" onclick={() => { dialogOpen = false; }}>Annuler</Button>
				<Button type="submit" disabled={formSubmitting}>
					{formSubmitting ? 'Enregistrement...' : (editingUser ? 'Enregistrer' : 'Créer')}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>

<!-- Delete Dialog -->
<Dialog bind:open={deleteDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Supprimer l'utilisateur</DialogTitle>
			<DialogDescription>
				Êtes-vous sûr de vouloir supprimer <strong>{deletingUser?.name}</strong> ({deletingUser?.email}) ? Cette action est irréversible.
			</DialogDescription>
		</DialogHeader>
		{#if deleteError}
			<p class="text-sm text-destructive">{deleteError}</p>
		{/if}
		<DialogFooter>
			<Button variant="outline" onclick={() => { deleteDialogOpen = false; }}>Annuler</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={deleteSubmitting}>
				{deleteSubmitting ? 'Suppression...' : 'Supprimer'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
