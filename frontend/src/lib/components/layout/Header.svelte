<script lang="ts">
	import { page } from '$app/stores';
	import { get } from '$lib/api';
	import { Button } from '$components/ui/button';
	import {
		Bell,
		Plus,
		Download,
		Check,
		ChevronRight,
		AlertTriangle,
		HelpCircle,
	} from 'lucide-svelte';

	let { collapsed = false, onOpenCommandPalette }: { collapsed?: boolean; onOpenCommandPalette?: () => void } = $props();

	// Extension detection state
	let extensionStatus = $state<'checking' | 'installed' | 'outdated' | 'not-installed'>('checking');
	let extensionVersion = $state('');

	const CURRENT_EXTENSION_VERSION = '0.1.0';

	// Cache for resolved entity names (project names, etc.)
	let resolvedNames = $state<Record<string, string>>({});

	// Check for extension on mount
	$effect(() => {
		checkExtension();
	});

	// Resolve project names when the URL changes
	$effect(() => {
		const pathname = $page.url.pathname;
		const segments = pathname.split('/').filter(Boolean);

		// If we're on /admin/projects/:id, resolve the project name
		if (segments.length >= 3 && segments[0] === 'admin' && segments[1] === 'projects') {
			const projectId = segments[2];
			if (!resolvedNames[projectId]) {
				resolveProjectName(projectId);
			}
		}
	});

	async function resolveProjectName(projectId: string) {
		try {
			const res = await get<{ data: { name: string } }>(`/projects/${projectId}`);
			resolvedNames = { ...resolvedNames, [projectId]: res.data.name };
		} catch {
			// Keep showing the ID if resolution fails
		}
	}

	function checkExtension() {
		const extensionEl = document.getElementById('es-extension-installed');
		if (extensionEl) {
			const version = extensionEl.getAttribute('data-version') || '';
			extensionVersion = version;
			extensionStatus = version && version !== CURRENT_EXTENSION_VERSION ? 'outdated' : 'installed';
			return;
		}

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

	// Determine if we're on the projects page (to show Nouveau projet button)
	let isOnProjectsPage = $derived(
		$page.url.pathname === '/admin/projects'
	);

	// Page title map
	const pageTitles: Record<string, string> = {
		admin: 'Dashboard',
		projects: 'Projets',
		tree: 'Arborescence',
		analytics: 'Analytics',
		invitations: 'Invitations',
		users: 'Utilisateurs',
		obfuscation: 'Obfuscation',
		'update-requests': 'Demandes MAJ',
		settings: 'Paramètres',
	};

	// Build breadcrumb from current path
	let pageTitle = $derived(() => {
		const pathname = $page.url.pathname;
		const segments = pathname.split('/').filter(Boolean);
		// Get the last meaningful segment
		for (let i = segments.length - 1; i >= 0; i--) {
			if (pageTitles[segments[i]]) return pageTitles[segments[i]];
		}
		return 'Dashboard';
	});

	let breadcrumbs = $derived(() => {
		const pathname = $page.url.pathname;
		const segments = pathname.split('/').filter(Boolean);
		const labels: Record<string, string> = {
			admin: 'Accueil',
			projects: 'Projets',
			tree: 'Arborescence',
			analytics: 'Analytics',
			invitations: 'Invitations',
			users: 'Utilisateurs',
			obfuscation: 'Obfuscation',
			'update-requests': 'Demandes MAJ',
			settings: 'Paramètres',
		};

		const crumbs: Array<{ label: string; href: string; isLast: boolean }> = [];

		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			const label = resolvedNames[segment] ?? labels[segment] ?? segment;
			const href = '/' + segments.slice(0, i + 1).join('/');
			const isLast = i === segments.length - 1;

			crumbs.push({ label, href, isLast });
		}

		return crumbs;
	});
</script>

<header
	class="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-sm transition-all duration-300"
	style="margin-left: {collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}"
>
	<!-- Page title + Breadcrumb -->
	<div class="flex items-center gap-2">
		<h1 class="text-lg font-bold text-foreground">{pageTitle()}</h1>
		<nav class="flex items-center gap-1 text-sm">
			{#each breadcrumbs() as crumb}
				{#if !crumb.isLast}
					<ChevronRight class="h-3.5 w-3.5 text-muted" />
					<a href={crumb.href} class="text-muted-foreground transition-colors hover:text-foreground">{crumb.label}</a>
				{/if}
			{/each}
		</nav>
	</div>

	<div class="flex-1"></div>

	<!-- Action buttons -->
	<button
		class="relative rounded-md p-2 text-muted transition-colors hover:bg-accent hover:text-foreground"
		title="Notifications"
	>
		<Bell class="h-4 w-4" />
		<!-- Notification dot -->
		<span class="absolute right-1.5 top-1.5 flex h-1.5 w-1.5">
			<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
			<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive"></span>
		</span>
	</button>

	<button
		class="relative rounded-md p-2 text-muted transition-colors hover:bg-accent hover:text-foreground"
		title="Aide"
	>
		<HelpCircle class="h-4 w-4" />
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

	{#if isOnProjectsPage}
		<Button size="sm" class="gap-1.5" onclick={() => { window.dispatchEvent(new CustomEvent('open-create-project')); }}>
			<Plus class="h-3.5 w-3.5" />
			Nouveau projet
		</Button>
	{/if}
</header>
