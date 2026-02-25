<script lang="ts">
	import { createEventDispatcher } from 'svelte';
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
	import type { AutoCaptureConfig } from '$lib/auto-capture';

	let { user }: { user: User | null } = $props();
	const dispatch = createEventDispatcher<{ logout: void }>();

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
	let autoConfig = $state<AutoCaptureConfig>({
		targetPageCount: 20,
		maxDepth: 3,
		delayBetweenPages: 2000,
		interestZones: [],
		blacklist: ['Supprimer', 'Delete', 'Remove', 'Déconnexion', 'Logout', 'Sign out']
	});

	// Derived
	let donePages = $derived(captureState.pages.filter((p) => p.status === PAGE_STATUS.DONE));
	let uploadingPages = $derived(captureState.pages.filter((p) => p.status === PAGE_STATUS.UPLOADING || p.status === PAGE_STATUS.CAPTURING));
	let errorPages = $derived(captureState.pages.filter((p) => p.status === PAGE_STATUS.ERROR));
	let totalPages = $derived(captureState.pages.length);
	let targetCount = $derived(captureState.targetPageCount || totalPages);

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
					<div class="w-1.5 h-1.5 rounded-full bg-success"></div>
					<span class="text-[10px] text-success font-medium">Connecté</span>
				</div>
			</div>
		</div>
		<button
			onclick={() => dispatch('logout')}
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
		<div class="flex items-center gap-2">
			<select
				class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition appearance-none"
				value={activeProject?.id || ''}
				onchange={(e: Event) => {
					const id = (e.target as HTMLSelectElement).value;
					const project = projects.find((p) => p.id === id);
					if (project) selectProject(project);
				}}
			>
				<option value="" disabled>Sélectionner un projet</option>
				{#each projects as project}
					<option value={project.id}>{project.name}</option>
				{/each}
			</select>
		</div>

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

	<!-- Mode toggle -->
	<div class="px-4 py-2.5 border-b border-gray-100">
		<div class="flex gap-1 bg-gray-100 rounded-lg p-0.5">
			<button
				onclick={() => setMode('free')}
				class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition {captureMode === 'free' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
				</svg>
				Libre
			</button>
			<button
				onclick={() => setMode('guided')}
				class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition {captureMode === 'guided' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
				</svg>
				Guides
			</button>
			<button
				onclick={() => setMode('auto')}
				class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition {captureMode === 'auto' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
				Auto
			</button>
		</div>
	</div>

	<!-- Auto capture panel -->
	{#if captureMode === 'auto' && (showAutoPanel || !captureState.isRunning)}
		<div class="px-4 py-3 border-b border-gray-100 bg-blue-50/30">
			<AutoCapturePanel bind:config={autoConfig} onStart={startAutoCrawl} />
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
	<div class="flex-1 overflow-y-auto px-4 py-2">
		{#if captureState.pages.length === 0}
			<div class="flex flex-col items-center justify-center py-10 text-center">
				<svg class="w-10 h-10 text-gray-200 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
				</svg>
				<p class="text-sm text-gray-400 font-medium">Aucune page capturée</p>
				<p class="text-xs text-gray-300 mt-1">
					Naviguez vers une page puis cliquez<br />"Capturer cette page"
				</p>
			</div>
		{:else}
			<div class="space-y-1">
				{#each captureState.pages as page (page.localId)}
					<PageItem
						{page}
						{formatSize}
						on:remove={() => removePage(page.localId)}
						on:recapture={() => recapturePage(page.localId)}
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
