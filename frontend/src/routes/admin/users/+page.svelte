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
		Eye,
		EyeOff,
		Copy,
		Check,
		RefreshCw,
		Send,
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
	let showPassword = $state(false);
	let passwordCopied = $state(false);
	let sendEmail = $state(false);

	// Delete dialog
	let deleteDialogOpen = $state(false);
	let deletingUser: UserRecord | null = $state(null);
	let deleteSubmitting = $state(false);
	let deleteError = $state('');

	// Companies extracted from existing users
	let companyOptions = $derived.by(() => {
		const companies = new Set<string>();
		for (const u of users) {
			if (u.company) companies.add(u.company);
		}
		return [...companies].sort().map(c => ({ value: c, label: c }));
	});

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

	// Password validation
	let passwordErrors = $derived.by(() => {
		const pw = formPassword;
		if (!pw) return [];
		const errors: string[] = [];
		if (pw.length < 12) errors.push('Au moins 12 caractères');
		if (!/[A-Z]/.test(pw)) errors.push('Au moins une majuscule');
		if (!/[a-z]/.test(pw)) errors.push('Au moins une minuscule');
		if (!/[0-9]/.test(pw)) errors.push('Au moins un chiffre');
		if (!/[^A-Za-z0-9]/.test(pw)) errors.push('Au moins un caractère spécial');
		if (/lemon/i.test(pw)) errors.push('Ne doit pas contenir "lemon"');
		return errors;
	});

	let passwordStrong = $derived(formPassword.length > 0 && passwordErrors.length === 0);

	function generatePassword(): string {
		const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
		const lower = 'abcdefghjkmnpqrstuvwxyz';
		const digits = '23456789';
		const specials = '!@#$%&*-_+=?';
		const all = upper + lower + digits + specials;

		let pw: string;
		do {
			const chars: string[] = [
				upper[Math.floor(Math.random() * upper.length)],
				upper[Math.floor(Math.random() * upper.length)],
				lower[Math.floor(Math.random() * lower.length)],
				lower[Math.floor(Math.random() * lower.length)],
				lower[Math.floor(Math.random() * lower.length)],
				digits[Math.floor(Math.random() * digits.length)],
				digits[Math.floor(Math.random() * digits.length)],
				specials[Math.floor(Math.random() * specials.length)],
				specials[Math.floor(Math.random() * specials.length)],
			];
			while (chars.length < 16) {
				chars.push(all[Math.floor(Math.random() * all.length)]);
			}
			// Shuffle
			for (let i = chars.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[chars[i], chars[j]] = [chars[j], chars[i]];
			}
			pw = chars.join('');
		} while (/lemon/i.test(pw));

		return pw;
	}

	function handleGeneratePassword() {
		formPassword = generatePassword();
		showPassword = true;
	}

	function copyPassword() {
		if (!formPassword) return;
		navigator.clipboard.writeText(formPassword);
		passwordCopied = true;
		setTimeout(() => { passwordCopied = false; }, 2000);
		toast.success('Mot de passe copié');
	}

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
		showPassword = false;
		passwordCopied = false;
		sendEmail = false;
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
		showPassword = false;
		passwordCopied = false;
		sendEmail = false;
		dialogOpen = true;
	}

	function openDeleteDialog(user: UserRecord) {
		deletingUser = user;
		deleteError = '';
		deleteDialogOpen = true;
	}

	async function handleSubmit(withEmail = false) {
		if (!formName.trim() || !formEmail.trim()) {
			formError = 'Le nom et l\'email sont requis.';
			return;
		}

		const isNew = !editingUser;

		if (isNew && !formPassword.trim()) {
			formError = 'Un mot de passe est requis pour les nouveaux utilisateurs.';
			return;
		}

		if (formPassword.trim() && passwordErrors.length > 0) {
			formError = 'Le mot de passe ne respecte pas les critères de sécurité.';
			return;
		}

		formSubmitting = true;
		formError = '';
		sendEmail = withEmail;

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
				body.sendEmail = withEmail;
				const res = await post<{ data: UserRecord }>('/users', body);
				users = [res.data, ...users];
				toast.success(withEmail ? 'Utilisateur créé et email envoyé' : 'Utilisateur créé');
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
	<title>Utilisateurs — Lemon Lab</title>
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
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle>{editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
			<DialogDescription>
				{editingUser ? 'Modifiez les informations de l\'utilisateur.' : 'Créez un nouveau compte utilisateur.'}
			</DialogDescription>
		</DialogHeader>
		<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit(false); }}>
			<div class="space-y-2">
				<label for="user-name" class="text-sm font-medium text-foreground">Nom</label>
				<Input id="user-name" bind:value={formName} placeholder="Jean Dupont" />
			</div>
			<div class="space-y-2">
				<label for="user-email" class="text-sm font-medium text-foreground">Email</label>
				<Input id="user-email" bind:value={formEmail} placeholder="jean@example.com" type="email" />
			</div>

			<!-- Password field with generate/copy/show -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label for="user-password" class="text-sm font-medium text-foreground">
						Mot de passe
						{#if editingUser}
							<span class="font-normal text-muted-foreground">(laisser vide pour ne pas modifier)</span>
						{/if}
					</label>
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
						onclick={handleGeneratePassword}
					>
						<RefreshCw class="h-3 w-3" />
						Générer
					</button>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="relative flex-1">
						<Input
							id="user-password"
							bind:value={formPassword}
							placeholder="••••••••••••"
							type={showPassword ? 'text' : 'password'}
							class="pr-10 font-mono text-sm"
						/>
						<button
							type="button"
							class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
							onclick={() => { showPassword = !showPassword; }}
						>
							{#if showPassword}
								<EyeOff class="h-3.5 w-3.5" />
							{:else}
								<Eye class="h-3.5 w-3.5" />
							{/if}
						</button>
					</div>
					<Button
						type="button"
						variant="outline"
						size="icon"
						class="h-9 w-9 shrink-0"
						onclick={copyPassword}
						disabled={!formPassword}
						title="Copier le mot de passe"
					>
						{#if passwordCopied}
							<Check class="h-3.5 w-3.5 text-green-500" />
						{:else}
							<Copy class="h-3.5 w-3.5" />
						{/if}
					</Button>
				</div>
				<!-- Password strength indicators -->
				{#if formPassword}
					<div class="space-y-1">
						{#if passwordErrors.length > 0}
							<div class="flex flex-wrap gap-1.5">
								{#each passwordErrors as err}
									<span class="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">{err}</span>
								{/each}
							</div>
						{:else}
							<span class="inline-flex items-center gap-1 text-[11px] text-green-600">
								<Check class="h-3 w-3" />
								Mot de passe sécurisé
							</span>
						{/if}
					</div>
				{/if}
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
					<SearchableSelect
						bind:value={formCompany}
						options={companyOptions}
						placeholder="Rechercher ou créer une entreprise..."
						searchable={true}
						searchPlaceholder="Tapez pour rechercher..."
						creatable={true}
						createLabel="Créer l'entreprise"
					/>
				</div>
			{/if}

			{#if formError}
				<p class="text-sm text-destructive">{formError}</p>
			{/if}

			<DialogFooter>
				<Button variant="outline" type="button" onclick={() => { dialogOpen = false; }}>Annuler</Button>
				{#if editingUser}
					<Button type="submit" disabled={formSubmitting}>
						{formSubmitting ? 'Enregistrement...' : 'Enregistrer'}
					</Button>
				{:else}
					<Button type="submit" disabled={formSubmitting} variant="outline">
						{formSubmitting && !sendEmail ? 'Création...' : 'Créer'}
					</Button>
					<Button type="button" disabled={formSubmitting} class="gap-1.5" onclick={() => handleSubmit(true)}>
						<Send class="h-3.5 w-3.5" />
						{formSubmitting && sendEmail ? 'Envoi...' : 'Créer et envoyer un mail'}
					</Button>
				{/if}
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
