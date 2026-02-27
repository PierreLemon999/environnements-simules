<script lang="ts">
	import {
		STORAGE_KEYS,
		CAPTURE_MODES,
		PAGE_STATUS,
		type User,
		type Project,
		type Version,
		type CapturedPage,
		type CaptureMode,
		type CaptureState
	} from '$lib/constants';
	import PageItem from './PageItem.svelte';
	import AutoCapturePanel from './AutoCapturePanel.svelte';
	import ProjectDropdown from './ProjectDropdown.svelte';
	import CreateProjectModal from './CreateProjectModal.svelte';
	import GuidedCapturePanel from './GuidedCapturePanel.svelte';
	import type { AutoCaptureConfig } from '$lib/auto-capture';
	import type { LLGuide } from '$lib/constants';

	let { user, onLogout }: { user: User | null; onLogout: () => void } = $props();

	// State
	let projects = $state<Project[]>([]);
	let versions = $state<Version[]>([]);
	let activeProject = $state<Project | null>(null);
	let activeVersion = $state<Version | null>(null);
	let captureMode = $state<CaptureMode>('free');
	let captureState = $state<CaptureState>({
		mode: 'free',
		isRunning: false,
		isPaused: false,
		pages: [],
		targetPageCount: 0
	});
	let isCapturing = $state(false);
	let loading = $state(true);
	let error = $state('');
	let showAutoPanel = $state(false);
	let showCreateProject = $state(false);
	let detectedProject = $state<Project | null>(null);
	let pageFilter = $state<'all' | 'done' | 'error'>('all');
	let autoConfig = $state<AutoCaptureConfig>({
		targetPageCount: 20,
		maxDepth: 3,
		delayBetweenPages: 800,
		interestZones: [],
		blacklist: ['Supprimer', 'Delete', 'Remove', 'Déconnexion', 'Logout', 'Sign out']
	});

	// Derived
	let donePages = $derived(captureState.pages.filter((p) => p.status === PAGE_STATUS.DONE));
	let uploadingPages = $derived(captureState.pages.filter((p) => p.status === PAGE_STATUS.UPLOADING || p.status === PAGE_STATUS.CAPTURING));
	let errorPages = $derived(captureState.pages.filter((p) => p.status === PAGE_STATUS.ERROR));
	let totalPages = $derived(captureState.pages.length);
	let targetCount = $derived(captureState.targetPageCount || totalPages);
	let filteredPages = $derived(
		pageFilter === 'all'
			? captureState.pages
			: pageFilter === 'done'
				? captureState.pages.filter((p) => p.status === PAGE_STATUS.DONE)
				: captureState.pages.filter((p) => p.status === PAGE_STATUS.ERROR)
	);

	// Load initial data
	$effect(() => {
		loadInitialData();
		listenForUpdates();
	});

	async function loadInitialData() {
		try {
			// Load projects
			const projectsRes = await chrome.runtime.sendMessage({ type: 'GET_PROJECTS' });
			if (projectsRes?.data) {
				projects = projectsRes.data;
			}

			// Load saved state
			const stored = await chrome.storage.local.get([
				STORAGE_KEYS.ACTIVE_PROJECT,
				STORAGE_KEYS.ACTIVE_VERSION,
				STORAGE_KEYS.CAPTURE_MODE
			]);

			if (stored[STORAGE_KEYS.ACTIVE_PROJECT]) {
				activeProject = stored[STORAGE_KEYS.ACTIVE_PROJECT];
				await loadVersions(activeProject!.id);
			}
			if (stored[STORAGE_KEYS.ACTIVE_VERSION]) {
				activeVersion = stored[STORAGE_KEYS.ACTIVE_VERSION];
			}
			if (stored[STORAGE_KEYS.CAPTURE_MODE]) {
				captureMode = stored[STORAGE_KEYS.CAPTURE_MODE];
			}

			// Detect project from current tab URL
			try {
				const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
				if (tab?.url && projects.length > 0) {
					const hostname = new URL(tab.url).hostname.toLowerCase();
					const detected = projects.find((p) => {
						const tool = p.toolName?.toLowerCase();
						const sub = p.subdomain?.toLowerCase();
						return (tool && hostname.includes(tool)) || (sub && hostname.includes(sub));
					});
					if (detected) {
						detectedProject = detected;
						if (!activeProject) {
							await selectProject(detected);
						}
					}
				}
			} catch {
				// Non-critical
			}

			// Load capture state
			const stateRes = await chrome.runtime.sendMessage({ type: 'GET_CAPTURE_STATE' });
			if (stateRes) {
				captureState = stateRes;
				captureMode = stateRes.mode || 'free';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur de chargement';
		} finally {
			loading = false;
		}
	}

	function listenForUpdates() {
		chrome.runtime.onMessage.addListener((message) => {
			if (message.type === 'CAPTURE_STATE_UPDATED') {
				captureState = message.state;
			}
		});
	}

	async function loadVersions(projectId: string) {
		try {
			const res = await chrome.runtime.sendMessage({
				type: 'GET_VERSIONS',
				projectId
			});
			if (res?.data) {
				versions = res.data;
			}
		} catch {
			versions = [];
		}
	}

	async function selectProject(project: Project) {
		activeProject = project;
		activeVersion = null;
		await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_PROJECT]: project });
		await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_VERSION);
		await loadVersions(project.id);
	}

	async function selectVersion(version: Version) {
		activeVersion = version;
		await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_VERSION]: version });
	}

	async function setMode(mode: CaptureMode) {
		captureMode = mode;
		await chrome.storage.local.set({ [STORAGE_KEYS.CAPTURE_MODE]: mode });
		await chrome.runtime.sendMessage({ type: 'SET_CAPTURE_MODE', mode });
	}

	async function captureCurrentPage() {
		if (!activeVersion) {
			error = 'Sélectionnez un projet et une version';
			return;
		}

		error = '';
		isCapturing = true;

		try {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab?.id) {
				error = 'Aucun onglet actif trouvé';
				return;
			}

			await chrome.runtime.sendMessage({
				type: 'CAPTURE_PAGE',
				tabId: tab.id
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur de capture';
		} finally {
			isCapturing = false;
		}
	}

	async function togglePause() {
		if (captureState.isPaused) {
			await chrome.runtime.sendMessage({ type: 'RESUME_CAPTURE' });
		} else {
			await chrome.runtime.sendMessage({ type: 'PAUSE_CAPTURE' });
		}
	}

	async function removePage(localId: string) {
		await chrome.runtime.sendMessage({ type: 'REMOVE_PAGE', localId });
	}

	async function recapturePage(localId: string) {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (!tab?.id) return;
		await chrome.runtime.sendMessage({ type: 'RECAPTURE_PAGE', localId, tabId: tab.id });
	}

	async function startAutoCrawl(config: AutoCaptureConfig) {
		if (!activeVersion) {
			error = 'Sélectionnez un projet et une version';
			return;
		}
		error = '';
		try {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab?.id) {
				error = 'Aucun onglet actif trouvé';
				return;
			}
			await chrome.runtime.sendMessage({
				type: 'START_AUTO_CRAWL',
				tabId: tab.id,
				config
			});
			showAutoPanel = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur de lancement du crawl';
		}
	}

	async function stopAutoCrawl() {
		await chrome.runtime.sendMessage({ type: 'STOP_AUTO_CRAWL' });
	}

	async function startGuidedCapture(guides: LLGuide[], mode: 'manual' | 'auto') {
		if (!activeVersion) {
			error = 'Sélectionnez un projet et une version';
			return;
		}
		error = '';
		// For now, start capture for each selected guide
		// The actual implementation will need the guided-capture.ts rework
		// This is the hookup point — the capture logic will run from service worker
		try {
			await chrome.runtime.sendMessage({
				type: 'START_GUIDED_CAPTURE',
				guides,
				executionMode: mode
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur de lancement';
		}
	}

	async function createProject(data: { name: string; toolName: string }) {
		try {
			const res = await chrome.runtime.sendMessage({
				type: 'CREATE_PROJECT',
				name: data.name,
				toolName: data.toolName
			});
			if (res?.data) {
				// Reload projects and select the new one
				const projectsRes = await chrome.runtime.sendMessage({ type: 'GET_PROJECTS' });
				if (projectsRes?.data) {
					projects = projectsRes.data;
				}
				const newProject = projects.find((p) => p.id === res.data.id);
				if (newProject) {
					await selectProject(newProject);
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erreur de création';
		} finally {
			showCreateProject = false;
		}
	}

	function handleFooterClick(panel: 'config' | 'zones' | 'blacklist') {
		if (captureMode !== 'auto') {
			setMode('auto');
		}
		showAutoPanel = true;
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 o';
		if (bytes < 1024) return `${bytes} o`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
		<div class="flex items-center gap-2.5">
			<div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">
				ES
			</div>
			<div>
				<h1 class="text-sm font-semibold text-gray-900 leading-tight">Env. Simulés</h1>
				<div class="flex items-center gap-1">
					{#if captureState.isRunning}
						<div class="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></div>
						<span class="text-[10px] text-warning font-medium">Capture en cours</span>
					{:else if isCapturing}
						<div class="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></div>
						<span class="text-[10px] text-warning font-medium">Capture...</span>
					{:else}
						<div class="w-1.5 h-1.5 rounded-full bg-success"></div>
						<span class="text-[10px] text-success font-medium">Connecté</span>
					{/if}
				</div>
			</div>
		</div>
		<button
			onclick={onLogout}
			class="text-gray-400 hover:text-gray-600 transition p-1"
			title="Se déconnecter"
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
			</svg>
		</button>
	</div>

	<!-- Project selector -->
	<div class="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
		<ProjectDropdown
			{projects}
			{activeProject}
			{detectedProject}
			onSelect={selectProject}
			onCreateNew={() => (showCreateProject = true)}
		/>

		{#if activeProject && versions.length > 0}
			<select
				class="w-full mt-2 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition appearance-none"
				value={activeVersion?.id || ''}
				onchange={(e: Event) => {
					const id = (e.target as HTMLSelectElement).value;
					const version = versions.find((v) => v.id === id);
					if (version) selectVersion(version);
				}}
			>
				<option value="" disabled>Sélectionner une version</option>
				{#each versions as version}
					<option value={version.id}>{version.name} ({version.status})</option>
				{/each}
			</select>
		{/if}
	</div>

	<!-- Create project modal -->
	{#if showCreateProject}
		<CreateProjectModal
			onClose={() => (showCreateProject = false)}
			onCreate={createProject}
		/>
	{/if}

	<!-- Mode selector cards -->
	<div class="px-4 py-3 border-b border-gray-100">
		<div class="grid grid-cols-3 gap-2">
			<button
				onclick={() => setMode('free')}
				class="relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition text-center {captureMode === 'free' ? 'border-primary bg-blue-50/50 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
			>
				{#if captureMode === 'free'}
					<div class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
				{/if}
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
				</svg>
				<span class="text-[11px] font-medium leading-tight">Libre</span>
				<span class="text-[9px] text-gray-400 leading-tight">Page par page</span>
			</button>
			<button
				onclick={() => setMode('guided')}
				class="relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition text-center {captureMode === 'guided' ? 'border-primary bg-blue-50/50 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
			>
				{#if captureMode === 'guided'}
					<div class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
				{/if}
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
				</svg>
				<span class="text-[11px] font-medium leading-tight">Guides</span>
				<span class="text-[9px] text-gray-400 leading-tight">Via LL Player</span>
			</button>
			<button
				onclick={() => setMode('auto')}
				class="relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition text-center {captureMode === 'auto' ? 'border-primary bg-blue-50/50 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
			>
				{#if captureMode === 'auto'}
					<div class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
				{/if}
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
				<span class="text-[11px] font-medium leading-tight">Auto</span>
				<span class="text-[9px] text-gray-400 leading-tight">Crawl BFS</span>
			</button>
		</div>
	</div>

	<!-- Auto capture panel -->
	{#if captureMode === 'auto' && (showAutoPanel || !captureState.isRunning)}
		<div class="px-4 py-3 border-b border-gray-100 bg-blue-50/30">
			<AutoCapturePanel bind:config={autoConfig} onStart={startAutoCrawl} />
		</div>
	{/if}

	<!-- Guided capture panel -->
	{#if captureMode === 'guided' && !captureState.isRunning}
		<div class="px-4 py-3 border-b border-gray-100 bg-blue-50/30">
			<GuidedCapturePanel onStartCapture={startGuidedCapture} />
		</div>
	{/if}

	<!-- Progress section -->
	{#if totalPages > 0}
		<div class="px-4 py-3 border-b border-gray-100">
			<div class="flex items-center justify-between mb-2">
				<span class="text-xs font-medium text-gray-700">
					{donePages.length} / {targetCount > 0 ? targetCount : totalPages} pages
				</span>
				<span class="text-[10px] text-gray-400">
					{Math.round((donePages.length / Math.max(targetCount, 1)) * 100)}%
				</span>
			</div>
			<div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
				<div
					class="h-full bg-primary rounded-full transition-all duration-500"
					style="width: {Math.min(100, (donePages.length / Math.max(targetCount, 1)) * 100)}%"
				></div>
			</div>

			<!-- Status indicators -->
			<div class="flex items-center gap-4 mt-2.5">
				<div class="flex items-center gap-1.5">
					<div class="w-1.5 h-1.5 rounded-full bg-success"></div>
					<span class="text-[10px] text-gray-500">{donePages.length} envoyée{donePages.length > 1 ? 's' : ''}</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="w-1.5 h-1.5 rounded-full bg-warning"></div>
					<span class="text-[10px] text-gray-500">{uploadingPages.length} en cours</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="w-1.5 h-1.5 rounded-full bg-error"></div>
					<span class="text-[10px] text-gray-500">{errorPages.length} erreur{errorPages.length > 1 ? 's' : ''}</span>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error message -->
	{#if error}
		<div class="mx-4 mt-3 flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded-lg">
			<svg class="w-3.5 h-3.5 text-error shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
			<p class="text-[11px] text-red-600 flex-1">{error}</p>
			<button onclick={() => (error = '')} class="text-red-400 hover:text-red-600" title="Fermer">
				<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
	{/if}

	<!-- Page list -->
	<div class="flex-1 overflow-y-auto">
		{#if captureState.pages.length === 0}
			<div class="flex flex-col items-center justify-center py-10 text-center px-4">
				<svg class="w-10 h-10 text-gray-200 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
				</svg>
				<p class="text-sm text-gray-400 font-medium">Aucune page capturée</p>
				<p class="text-xs text-gray-300 mt-1">
					Naviguez vers une page puis cliquez<br />"Capturer cette page"
				</p>
			</div>
		{:else}
			<!-- Filter header -->
			<div class="flex items-center justify-between px-4 py-2 border-b border-gray-50">
				<div class="flex items-center gap-1">
					<button
						onclick={() => (pageFilter = 'all')}
						class="px-2 py-0.5 rounded text-[10px] font-medium transition {pageFilter === 'all' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600'}"
					>
						Tout ({captureState.pages.length})
					</button>
					<button
						onclick={() => (pageFilter = 'done')}
						class="px-2 py-0.5 rounded text-[10px] font-medium transition {pageFilter === 'done' ? 'bg-green-100 text-success' : 'text-gray-400 hover:text-gray-600'}"
					>
						OK ({donePages.length})
					</button>
					<button
						onclick={() => (pageFilter = 'error')}
						class="px-2 py-0.5 rounded text-[10px] font-medium transition {pageFilter === 'error' ? 'bg-red-100 text-error' : 'text-gray-400 hover:text-gray-600'}"
					>
						Err ({errorPages.length})
					</button>
				</div>
				<span class="text-[10px] text-gray-400">{filteredPages.length} page{filteredPages.length > 1 ? 's' : ''}</span>
			</div>

			<div class="space-y-1 px-4 py-2">
				{#each filteredPages as page (page.localId)}
					<PageItem
						{page}
						{formatSize}
						subdomain={activeProject?.subdomain}
						onRemove={() => removePage(page.localId)}
						onRecapture={() => recapturePage(page.localId)}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Bottom actions -->
	<div class="px-4 py-3 border-t border-gray-100 bg-white space-y-2">
		{#if captureState.isRunning && captureState.mode === 'auto'}
			<div class="flex gap-2">
				<button
					onclick={togglePause}
					class="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition {captureState.isPaused ? 'bg-primary text-white hover:bg-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					{#if captureState.isPaused}
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
						Reprendre
					{:else}
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
						Pause
					{/if}
				</button>
				<button
					onclick={stopAutoCrawl}
					class="flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition"
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
					Arrêter
				</button>
			</div>
		{:else if captureState.isRunning}
			<button
				onclick={togglePause}
				class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition {captureState.isPaused ? 'bg-primary text-white hover:bg-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
			>
				{#if captureState.isPaused}
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
					Reprendre
				{:else}
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
					Pause
				{/if}
			</button>
		{/if}

		{#if captureMode !== 'auto' || !captureState.isRunning}
			<button
				onclick={captureCurrentPage}
				disabled={isCapturing || !activeVersion || captureMode === 'auto'}
				class="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if isCapturing}
					<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
					<span>Capture en cours...</span>
				{:else}
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
					</svg>
					<span>Capturer cette page</span>
				{/if}
			</button>
		{/if}
	</div>

	<!-- Footer links -->
	<div class="flex items-center justify-center gap-3 px-4 py-2 border-t border-gray-50 bg-gray-50/50">
		<button onclick={() => handleFooterClick('config')} class="text-[10px] text-gray-400 hover:text-primary transition">Paramètres</button>
		<span class="text-gray-200">—</span>
		<button onclick={() => handleFooterClick('zones')} class="text-[10px] text-gray-400 hover:text-primary transition">Zones d'intérêt</button>
		<span class="text-gray-200">—</span>
		<button onclick={() => handleFooterClick('blacklist')} class="text-[10px] text-gray-400 hover:text-primary transition">Liste noire</button>
	</div>
</div>
