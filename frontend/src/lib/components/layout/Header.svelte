<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Badge } from '$components/ui/badge';
	import {
		Search,
		Bell,
		Plus,
		Download,
		Check,
		ChevronRight,
		AlertTriangle,
	} from 'lucide-svelte';

	let { collapsed = false, onOpenCommandPalette }: { collapsed?: boolean; onOpenCommandPalette?: () => void } = $props();

	// Extension detection state
	let extensionStatus = $state<'checking' | 'installed' | 'outdated' | 'not-installed'>('checking');
	let extensionVersion = $state('');

	const CURRENT_EXTENSION_VERSION = '0.1.0';

	// Check for extension on mount
	$effect(() => {
		checkExtension();
	});

	function checkExtension() {
		// Try to detect extension via DOM element or message
		const extensionEl = document.getElementById('es-extension-installed');
		if (extensionEl) {
			const version = extensionEl.getAttribute('data-version') || '';
			extensionVersion = version;
			extensionStatus = version && version !== CURRENT_EXTENSION_VERSION ? 'outdated' : 'installed';
			return;
		}

		// Alternative: try postMessage approach
		const timeout = setTimeout(() => {
			extensionStatus = 'not-installed';
		}, 1500);

		function onMessage(event: MessageEvent) {
			if (event.data?.type === 'ES_EXTENSION_PONG') {
				clearTimeout(timeout);
				window.removeEventListener('message', onMessage);
				extensionVersion = event.data.version || '';
				extensionStatus = extensionVersion && extensionVersion !== CURRENT_EXTENSION_VERSION ? 'outdated' : 'installed';
			}
		}

		window.addEventListener('message', onMessage);
		window.postMessage({ type: 'ES_EXTENSION_PING' }, '*');
	}

	// Build breadcrumb from current path
	let breadcrumbs = $derived(() => {
		const pathname = $page.url.pathname;
		const segments = pathname.split('/').filter(Boolean);
		const labels: Record<string, string> = {
			admin: 'Administration',
			projects: 'Projets',
			tree: 'Arborescence',
			analytics: 'Analytics',
			invitations: 'Invitations',
			users: 'Utilisateurs',
			obfuscation: 'Obfuscation',
			'update-requests': 'Demandes MAJ',
			settings: 'Paramètres',
		};
		return segments.map((segment, i) => ({
			label: labels[segment] ?? segment,
			href: '/' + segments.slice(0, i + 1).join('/'),
			isLast: i === segments.length - 1,
		}));
	});
</script>

<header
	class="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-sm transition-all duration-300"
	style="margin-left: {collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}"
>
	<!-- Breadcrumb -->
	<nav class="flex items-center gap-1 text-sm">
		{#each breadcrumbs() as crumb}
			{#if !crumb.isLast}
				<a href={crumb.href} class="text-muted-foreground transition-colors hover:text-foreground">{crumb.label}</a>
				<ChevronRight class="h-3.5 w-3.5 text-muted" />
			{:else}
				<span class="font-medium text-foreground">{crumb.label}</span>
			{/if}
		{/each}
	</nav>

	<div class="flex-1"></div>

	<!-- Search trigger -->
	<button
		class="flex h-8 w-64 items-center gap-2 rounded-md border border-border bg-input px-3 text-sm text-muted transition-colors hover:bg-accent"
		onclick={() => onOpenCommandPalette?.()}
	>
		<Search class="h-3.5 w-3.5" />
		<span>Rechercher...</span>
		<kbd class="ml-auto rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted">
			⌘K
		</kbd>
	</button>

	<!-- Action buttons -->
	<button
		class="relative rounded-md p-2 text-muted transition-colors hover:bg-accent hover:text-foreground"
		title="Notifications"
	>
		<Bell class="h-4 w-4" />
	</button>

	{#if extensionStatus === 'installed'}
		<Button variant="outline" size="sm" class="gap-1.5 border-success/30 text-success hover:bg-success/5" title="Extension installée (v{extensionVersion || CURRENT_EXTENSION_VERSION})">
			<Check class="h-3.5 w-3.5" />
			Extension
		</Button>
	{:else if extensionStatus === 'outdated'}
		<Button variant="outline" size="sm" class="gap-1.5 border-warning/30 text-warning hover:bg-warning/5" title="Mise à jour disponible">
			<AlertTriangle class="h-3.5 w-3.5" />
			Mettre à jour
		</Button>
	{:else}
		<Button variant="outline" size="sm" class="gap-1.5" title="Installer l'extension Chrome">
			<Download class="h-3.5 w-3.5" />
			Extension
		</Button>
	{/if}

	<Button size="sm" class="gap-1.5">
		<Plus class="h-3.5 w-3.5" />
		Nouveau projet
	</Button>
</header>
