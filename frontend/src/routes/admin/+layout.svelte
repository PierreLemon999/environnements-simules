<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import Sidebar from '$components/layout/Sidebar.svelte';
	import Header from '$components/layout/Header.svelte';
	import CommandPalette from '$components/layout/CommandPalette.svelte';

	let { children } = $props();

	let collapsed = $state(false);
	let commandPalette: ReturnType<typeof CommandPalette> | undefined = $state();
	let userHasToggled = $state(false);

	// Restore persisted sidebar state, or auto-collapse on small screens
	$effect(() => {
		if (!browser) return;

		const stored = localStorage.getItem('sidebar-collapsed');
		if (stored !== null) {
			collapsed = stored === 'true';
			userHasToggled = true;
		} else {
			collapsed = window.innerWidth < 1024;
		}
	});

	// Persist collapse state whenever user toggles
	$effect(() => {
		if (!browser) return;
		if (userHasToggled) {
			localStorage.setItem('sidebar-collapsed', String(collapsed));
		}
	});

	function handleGlobalKeydown(e: KeyboardEvent) {
		const metaOrCtrl = e.metaKey || e.ctrlKey;

		// Cmd+N → go to projects (new project)
		if (metaOrCtrl && e.key === 'n' && !e.shiftKey) {
			e.preventDefault();
			goto('/admin/projects');
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="min-h-screen bg-background">
	<Sidebar bind:collapsed onToggle={() => { userHasToggled = true; }} />
	<Header {collapsed} onOpenCommandPalette={() => commandPalette?.toggle()} />
	<CommandPalette bind:this={commandPalette} />

	<main
		class="min-h-[calc(100vh-var(--header-height))] p-6 transition-all duration-300"
		style="margin-left: {collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}"
	>
		{@render children()}
	</main>
</div>
