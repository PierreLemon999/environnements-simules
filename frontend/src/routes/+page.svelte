<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAuthenticated, user } from '$lib/stores/auth';

	// Redirect based on auth state
	$effect(() => {
		if ($isAuthenticated && $user) {
			if ($user.role === 'admin') {
				goto('/admin', { replaceState: true });
			} else {
				goto('/view', { replaceState: true });
			}
		} else {
			goto('/login', { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>Environnements Simulés — Lemon Learning</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="flex items-center gap-3">
		<div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
		<span class="text-sm text-muted-foreground">Redirection...</span>
	</div>
</div>
