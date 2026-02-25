<script lang="ts">
	import { goto } from '$app/navigation';
	import { login, loginWithGoogle } from '$lib/stores/auth';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$components/ui/card';
	import { LogIn, Chrome, Mail, Lock, Loader2 } from 'lucide-svelte';

	let mode: 'client' | 'admin' = $state('client');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleClientLogin(e: Event) {
		e.preventDefault();
		if (!email || !password) {
			error = 'Veuillez remplir tous les champs.';
			return;
		}

		loading = true;
		error = '';

		try {
			const user = await login(email, password);
			if (user.role === 'client') {
				goto('/view');
			} else {
				goto('/admin');
			}
		} catch (err: unknown) {
			if (err && typeof err === 'object' && 'message' in err) {
				error = (err as Error).message;
			} else {
				error = 'Une erreur est survenue lors de la connexion.';
			}
		} finally {
			loading = false;
		}
	}

	async function handleGoogleLogin() {
		// In a real scenario, we'd use Google Identity Services SDK
		// For demo purposes, we simulate by calling the backend directly
		// with mock data matching seed admin users
		loading = true;
		error = '';

		try {
			const user = await loginWithGoogle(
				'mock-google-token',
				'marie.laurent@lemonlearning.com',
				'Marie Laurent',
				'google-marie-001',
				undefined
			);
			goto('/admin');
		} catch (err: unknown) {
			if (err && typeof err === 'object' && 'message' in err) {
				error = (err as Error).message;
			} else {
				error = 'Une erreur est survenue lors de la connexion Google.';
			}
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Connexion — Environnements Simulés</title>
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
	<!-- Decorative background circles -->
	<div class="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/5"></div>
	<div class="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/3"></div>

	<div class="relative z-10 w-full max-w-md px-4">
		<!-- Logo -->
		<div class="mb-8 text-center">
			<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white">
				ES
			</div>
			<h1 class="text-xl font-semibold text-foreground">Environnements Simulés</h1>
			<p class="mt-1 text-sm text-muted-foreground">Plateforme de démonstrations Lemon Learning</p>
		</div>

		<Card>
			<CardHeader class="pb-4">
				<!-- Mode tabs -->
				<div class="flex rounded-lg bg-input p-1">
					<button
						class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {mode === 'client' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => { mode = 'client'; error = ''; }}
					>
						Accès client
					</button>
					<button
						class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {mode === 'admin' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => { mode = 'admin'; error = ''; }}
					>
						Administration
					</button>
				</div>
			</CardHeader>

			<CardContent>
				{#if mode === 'client'}
					<!-- Client login: email + password -->
					<form onsubmit={handleClientLogin} class="space-y-4">
						<div class="space-y-2">
							<label for="email" class="text-sm font-medium text-foreground">Email</label>
							<div class="relative">
								<Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
								<Input
									id="email"
									type="email"
									placeholder="vous@entreprise.com"
									bind:value={email}
									class="pl-10"
									disabled={loading}
								/>
							</div>
						</div>

						<div class="space-y-2">
							<label for="password" class="text-sm font-medium text-foreground">Mot de passe</label>
							<div class="relative">
								<Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
								<Input
									id="password"
									type="password"
									placeholder="Votre mot de passe"
									bind:value={password}
									class="pl-10"
									disabled={loading}
								/>
							</div>
						</div>

						{#if error}
							<p class="text-sm text-destructive">{error}</p>
						{/if}

						<Button type="submit" class="w-full" disabled={loading}>
							{#if loading}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<LogIn class="mr-2 h-4 w-4" />
							{/if}
							Se connecter
						</Button>
					</form>
				{:else}
					<!-- Admin login: Google SSO only -->
					<div class="space-y-4">
						<p class="text-sm text-muted-foreground">
							Connectez-vous avec votre compte Google Lemon Learning pour accéder à l'administration.
						</p>

						{#if error}
							<p class="text-sm text-destructive">{error}</p>
						{/if}

						<Button
							variant="outline"
							class="w-full"
							onclick={handleGoogleLogin}
							disabled={loading}
						>
							{#if loading}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<Chrome class="mr-2 h-4 w-4" />
							{/if}
							Continuer avec Google
						</Button>
						<p class="text-center text-xs text-muted">(admin uniquement)</p>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
