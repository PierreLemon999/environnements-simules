<script lang="ts">
	import { page } from '$app/stores';
	import { get } from '$lib/api';
	import { Button } from '$components/ui/button';
	import {
		Bell,
		Download,
		Check,
		AlertTriangle,
		HelpCircle,
		Search,
		ExternalLink,
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


	// Route segment to French label map
	const segmentLabels: Record<string, string> = {
		admin: 'Accueil',
		projects: 'Projets',
		tree: 'Arborescence',
		analytics: 'Statistiques',
		invitations: 'Invitations',
		users: 'Utilisateurs',
		obfuscation: 'Obfuscation',
		'update-requests': 'Demandes MAJ',
		settings: 'Paramètres',
		editor: 'Éditeur',
		'live-edit': 'Édition en direct',
		components: 'Composants',
	};

	// Current page title: last known segment label, or resolved entity name
	let pageTitle = $derived(() => {
		const pathname = $page.url.pathname;
		const segments = pathname.split('/').filter(Boolean);

		if (segments.length <= 1) return 'Dashboard';

		// For deep pages like /admin/projects/:id, show the resolved name or fallback
		const lastSegment = segments[segments.length - 1];
		if (resolvedNames[lastSegment]) return resolvedNames[lastSegment];
		if (segmentLabels[lastSegment]) return segmentLabels[lastSegment];

		// Fallback: find last known label
		for (let i = segments.length - 1; i >= 0; i--) {
			if (segmentLabels[segments[i]]) return segmentLabels[segments[i]];
		}
		return 'Dashboard';
	});

</script>

<header
	class="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-sm transition-all duration-300"
	style="margin-left: {collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}"
>
	<!-- Page title -->
	<div class="flex items-center gap-4">
		<h1 class="text-lg font-bold tracking-tight text-foreground">{pageTitle()}</h1>
	</div>

	<div class="flex-1"></div>

	<!-- Global search bar -->
	<button
		class="flex h-8 w-64 items-center gap-2 rounded-md border border-border bg-accent/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
		onclick={() => onOpenCommandPalette?.()}
	>
		<Search class="h-3.5 w-3.5" />
		<span class="flex-1 text-left text-xs">Recherche admin...</span>
		<kbd class="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted">⌘K</kbd>
	</button>

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

	<a
		href="/demo/salesforce/"
		target="_blank"
		class="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
		title="Ouvrir l'interface de démo"
	>
		<ExternalLink class="h-3.5 w-3.5" />
		Espace démo
	</a>

	{#if extensionStatus === 'installed'}
		<div class="group relative inline-flex h-8 items-center gap-1.5 rounded-md border border-green-400/40 bg-green-50 px-3 text-xs font-medium text-green-700 cursor-default">
			<svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" fill="#4285F4"/><path d="M24 8c8.837 0 16 7.163 16 16H24V8z" fill="#EA4335"/><circle cx="24" cy="24" r="7" fill="#fff"/><path d="M8 24c0-5.946 3.244-11.13 8.06-13.89L24 24H8z" fill="#34A853"/><path d="M24 24l-7.94-13.89A15.94 15.94 0 0 1 24 8v16z" fill="#FBBC05"/></svg>
			<span class="flex items-center gap-1">
				<svg class="h-3.5 w-3.5 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>
				Extension
			</span>
			<!-- Tooltip on hover -->
			<div class="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
				Extension Chrome installée
			</div>
		</div>
	{:else if extensionStatus === 'outdated'}
		<Button variant="outline" size="sm" class="gap-1.5 border-warning/30 text-warning hover:bg-warning/5" title="Mise à jour disponible">
			<svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" fill="#4285F4"/><path d="M24 8c8.837 0 16 7.163 16 16H24V8z" fill="#EA4335"/><circle cx="24" cy="24" r="7" fill="#fff"/><path d="M8 24c0-5.946 3.244-11.13 8.06-13.89L24 24H8z" fill="#34A853"/><path d="M24 24l-7.94-13.89A15.94 15.94 0 0 1 24 8v16z" fill="#FBBC05"/></svg>
			Mettre à jour
		</Button>
	{:else}
		<Button variant="outline" size="sm" class="gap-1.5" title="Installer l'extension Chrome">
			<svg class="h-4 w-4 flex-shrink-0 opacity-60" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" fill="#4285F4"/><path d="M24 8c8.837 0 16 7.163 16 16H24V8z" fill="#EA4335"/><circle cx="24" cy="24" r="7" fill="#fff"/><path d="M8 24c0-5.946 3.244-11.13 8.06-13.89L24 24H8z" fill="#34A853"/><path d="M24 24l-7.94-13.89A15.94 15.94 0 0 1 24 8v16z" fill="#FBBC05"/></svg>
			Extension
		</Button>
	{/if}

</header>
