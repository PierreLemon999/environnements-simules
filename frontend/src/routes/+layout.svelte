<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import { loadFromStorage } from '$lib/stores/auth';
	import ToastContainer from '$lib/components/ui/toast/ToastContainer.svelte';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
	let ready = $state(false);

	onMount(async () => {
		await loadFromStorage();
		ready = true;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="description" content="Environnements Simulés - Lemon Learning" />
</svelte:head>

{#if ready}
	{@render children()}
{:else}
	<div class="flex min-h-screen items-center justify-center bg-background">
		<div class="flex items-center gap-3">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
			<span class="text-sm text-muted-foreground">Chargement...</span>
		</div>
	</div>
{/if}

<ToastContainer />
