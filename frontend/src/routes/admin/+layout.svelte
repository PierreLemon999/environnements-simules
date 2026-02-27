<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import Sidebar from '$components/layout/Sidebar.svelte';
	import Header from '$components/layout/Header.svelte';
	import CommandPalette from '$components/layout/CommandPalette.svelte';

	let { children } = $props();

	let collapsed = $state(false);
	let commandPalette: ReturnType<typeof CommandPalette> | undefined = $state();

	// Restore persisted sidebar state (default: open)
	$effect(() => {
		if (!browser) return;
		const stored = localStorage.getItem('sidebar-collapsed');
		if (stored !== null) {
			collapsed = stored === 'true';
		}
	});

	// Sidebar toggles collapsed via $bindable — we just persist
	function handleToggle() {
		if (browser) {
			localStorage.setItem('sidebar-collapsed', String(collapsed));
		}
	}

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

<div class="min-h-screen bg-background" style="--sidebar-current-width: {collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}">
	<Sidebar bind:collapsed onToggle={handleToggle} />
	<Header {collapsed} onOpenCommandPalette={() => commandPalette?.toggle()} />
	<CommandPalette bind:this={commandPalette} />

	<main
		class="min-h-[calc(100vh-var(--header-height))] p-6 transition-all duration-300"
		style="margin-left: var(--sidebar-current-width)"
	>
		{@render children()}
	</main>
</div>
