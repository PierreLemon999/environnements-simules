<script lang="ts">
	import { STORAGE_KEYS, type LLGuide } from '$lib/constants';
	import { computeRunPlans } from '$lib/guided-orchestrator';

	let {
		onStartCapture
	}: {
		onStartCapture: (guides: LLGuide[], mode: 'manual' | 'auto') => void;
	} = $props();

	type PanelState = 'idle' | 'scanning' | 'selection' | 'error';

	let state = $state<PanelState>('idle');
	let playerDetected = $state(false);
	let guides = $state<LLGuide[]>([]);
	let executionMode = $state<'manual' | 'auto'>('auto');
	let errorMessage = $state('');
	let debugInfo = $state<Record<string, unknown> | null>(null);
	let capturingMhtml = $state(false);

	let selectedCount = $derived(guides.filter((g) => g.selected).length);

	// Compute estimated pages and branch info for selected guides
	let branchInfo = $derived(() => {
		const selected = guides.filter(g => g.selected);
		let totalPages = 0;
		let totalRuns = 0;
		let hasBranches = false;

		for (const guide of selected) {
			const runs = computeRunPlans(guide.steps);
			const guideRuns = runs.length;
			totalRuns += guideRuns;
			totalPages += Math.max(guide.stepCount, 1) * guideRuns;
			if (guideRuns > 1) hasBranches = true;
		}

		return { totalPages, totalRuns, hasBranches, guideCount: selected.length };
	});

	// Restore previously scanned guides on mount
	$effect(() => {
		chrome.storage.local.get(STORAGE_KEYS.SCANNED_GUIDES).then((stored) => {
			const saved = stored[STORAGE_KEYS.SCANNED_GUIDES] as LLGuide[] | undefined;
			if (saved && saved.length > 0 && state === 'idle') {
				guides = saved;
				playerDetected = true;
				state = 'selection';
			}
		});
	});

	async function detectAndScan() {
		state = 'scanning';
		errorMessage = '';
		debugInfo = null;

		try {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab?.id) {
				throw new Error('Aucun onglet actif');
			}

			// Step 1: Detect LL Player
			const detection = await chrome.runtime.sendMessage({
				type: 'DETECT_LL_PLAYER',
				tabId: tab.id
			});

			debugInfo = { detection };

			if (!detection?.detected) {
				playerDetected = false;
				state = 'error';
				errorMessage = `Player Lemon Learning non détecté sur cette page (3 tentatives).${detection?.error ? ` (${detection.error})` : ''} Naviguez vers une page avec le Player LL installé.`;
				debugInfo = { detection, diagnostics: detection?.diagnostics };
				return;
			}

			playerDetected = true;

			// Step 2: Scan guides
			const scanResult = await chrome.runtime.sendMessage({
				type: 'SCAN_LL_GUIDES',
				tabId: tab.id
			});

			debugInfo = { detection, scan: scanResult };

			if (scanResult?.guides?.length > 0) {
				guides = scanResult.guides.map((g: { id: string; name: string; stepCount: number; sectionName?: string }) => ({
					...g,
					selected: true
				}));
				state = 'selection';
				// Persist scanned guides for popup reopen
				chrome.storage.local.set({ [STORAGE_KEYS.SCANNED_GUIDES]: guides });
			} else {
				state = 'error';
				errorMessage = 'Player détecté mais aucun guide trouvé après ouverture automatique du panel. Vérifiez que vous êtes connecté au Player LL, puis réessayez.';
				if (scanResult?.debug) {
					debugInfo = { ...debugInfo, playerDebug: scanResult.debug };
				}
			}
		} catch (err) {
			state = 'error';
			errorMessage = err instanceof Error ? err.message : 'Erreur de détection';
		}
	}

	async function captureDebugMhtml() {
		capturingMhtml = true;
		try {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab?.id) throw new Error('No active tab');

			const mhtmlBlob = await chrome.pageCapture.saveAsMHTML({ tabId: tab.id });
			if (!mhtmlBlob) throw new Error('MHTML capture returned null');

			// Create download link
			const url = URL.createObjectURL(mhtmlBlob);
			const filename = `debug-${tab.title?.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40) || 'page'}-${Date.now()}.mhtml`;
			await chrome.downloads.download({ url, filename, saveAs: true });
			URL.revokeObjectURL(url);
		} catch (err) {
			errorMessage = `MHTML capture failed: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			capturingMhtml = false;
		}
	}

	function toggleGuide(index: number) {
		guides[index].selected = !guides[index].selected;
		guides = [...guides];
	}

	function toggleAll() {
		const allSelected = selectedCount === guides.length;
		guides = guides.map((g) => ({ ...g, selected: !allSelected }));
	}

	function startCapture() {
		const selectedGuides = guides.filter((g) => g.selected);
		if (selectedGuides.length === 0) return;
		// Clear saved guides — they're being consumed
		chrome.storage.local.remove(STORAGE_KEYS.SCANNED_GUIDES);
		onStartCapture(selectedGuides, executionMode);
	}
</script>

<div class="flex flex-col gap-3">
	{#if state === 'idle'}
		<!-- Before scan -->
		<div class="text-center py-3">
			<svg class="w-8 h-8 text-gray-300 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
			</svg>
			<p class="text-[11px] text-gray-500 mb-3">
				Détectez le Player Lemon Learning<br/>pour récupérer les guides disponibles.
			</p>
			<button
				onclick={detectAndScan}
				class="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
				Récupérer les guides
			</button>
		</div>

	{:else if state === 'scanning'}
		<!-- Scanning -->
		<div class="flex flex-col items-center py-6 gap-3">
			<div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
			<p class="text-[11px] text-gray-500">Détection du Player LL et scan des guides...</p>
		</div>

	{:else if state === 'error'}
		<!-- Error -->
		<div class="space-y-3">
			<div class="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
				<svg class="w-4 h-4 text-error shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				<p class="text-[11px] text-red-600">{errorMessage}</p>
			</div>

			{#if debugInfo}
				{@const scanDebug = (debugInfo.scan as Record<string, unknown>)?.debug as Record<string, unknown> | undefined
					?? (debugInfo.playerDebug as Record<string, unknown> | undefined)}
				{@const phase2Debug = scanDebug?.phase2 as Record<string, unknown> | undefined}
				{#if scanDebug || phase2Debug}
					<!-- Quick diagnostic summary -->
					<div class="p-2 bg-gray-50 rounded-lg text-[10px] space-y-1">
						<p class="font-semibold text-gray-600">Diagnostic rapide :</p>
						<div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-500">
							{#if scanDebug}
								<span>React Query cache</span>
								<span class={scanDebug.reactQueryCacheExists ? 'text-green-600' : 'text-red-500'}>
									{scanDebug.reactQueryCacheExists ? `Oui (${scanDebug.reactQueryCount} queries, ${Math.round((scanDebug.reactQueryCacheSize as number || 0) / 1024)}Ko)` : 'Non trouvé'}
								</span>
								<span>Shadow DOM</span>
								<span>{typeof scanDebug.shadowDomElementCount === 'number' ? `${scanDebug.shadowDomElementCount} éléments${scanDebug.shadowDomPanelOpen ? ' (panel ouvert)' : ' (panel fermé)'}` : String(scanDebug.shadowDomElementCount || '—')}</span>
								<span>LemonPlayer global</span>
								<span class={scanDebug.hasLemonPlayer ? 'text-green-600' : 'text-orange-500'}>
									{scanDebug.hasLemonPlayer ? 'Oui' : 'Non (isolated world)'}
								</span>
							{/if}
							{#if phase2Debug}
								<span>Panel ouverture</span>
								<span class={phase2Debug.openStrategy === 'failed' ? 'text-red-500' : 'text-green-600'}>
									{phase2Debug.openStrategy ?? '—'}
								</span>
								<span>Shadow DOM final</span>
								<span>{phase2Debug.finalElementCount ?? phase2Debug.initialElementCount ?? '—'} éléments</span>
								<span>Polling (10 ticks)</span>
								<span>
									{#if phase2Debug.pollLog}
										{@const log = phase2Debug.pollLog as Array<{tick: number; elCount: number; guides: number}>}
										{log.length > 0 ? `${log[log.length - 1].elCount} els, ${log[log.length - 1].guides} guides` : '—'}
									{:else}
										—
									{/if}
								</span>
								{#if phase2Debug.error}
									<span>Erreur Phase 2</span>
									<span class="text-red-500">{phase2Debug.error}</span>
								{/if}
							{/if}
							<span>Guides trouvés</span>
							<span class={Number(scanDebug?.guidesFound) > 0 ? 'text-green-600' : 'text-red-500'}>
								{scanDebug?.guidesFound ?? 0}
							</span>
						</div>
						{#if scanDebug?.localStorageRelevantKeys}
							{@const keys = scanDebug.localStorageRelevantKeys as string[]}
							{#if keys.length > 0}
								<p class="text-gray-400 mt-1">Clés LS pertinentes : {keys.join(', ')}</p>
							{:else}
								<p class="text-orange-500 mt-1">Aucune clé LL/React/Guide dans localStorage ({scanDebug.localStorageKeyCount} clés totales)</p>
							{/if}
						{/if}
					</div>
				{/if}
				<details class="text-[10px] text-gray-400">
					<summary class="cursor-pointer hover:text-gray-600">Debug info complet</summary>
					<pre class="mt-1 p-2 bg-gray-50 rounded text-[9px] overflow-x-auto max-h-48 overflow-y-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
				</details>
			{/if}

			<div class="flex gap-2">
				<button
					onclick={detectAndScan}
					class="flex-1 py-2 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-blue-50 transition"
				>
					Réessayer
				</button>
				<button
					onclick={captureDebugMhtml}
					disabled={capturingMhtml}
					class="flex items-center gap-1.5 py-2 px-3 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
					title="Télécharger le MHTML de la page pour analyse"
				>
					{#if capturingMhtml}
						<div class="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
					{:else}
						<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
						</svg>
					{/if}
					MHTML
				</button>
			</div>
		</div>

	{:else if state === 'selection'}
		<!-- Guide selection -->
		<div class="space-y-2.5">
			<!-- Header badge -->
			<div class="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-green-50 border border-green-100 rounded-lg">
				<div class="flex items-center gap-2">
					<div class="w-1.5 h-1.5 rounded-full bg-success"></div>
					<span class="text-[11px] text-green-700 font-medium">Player LL détecté — {guides.length} guide{guides.length > 1 ? 's' : ''} détecté{guides.length > 1 ? 's' : ''}</span>
				</div>
				<button
					onclick={detectAndScan}
					class="text-[10px] text-green-600 hover:text-green-800 transition"
					title="Rescanner les guides"
				>
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
					</svg>
				</button>
			</div>

			<!-- Select/Deselect all -->
			<div class="flex items-center justify-between px-2.5">
				<button onclick={toggleAll} class="flex items-center group">
					<div class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition {selectedCount === guides.length ? 'bg-primary border-primary' : selectedCount > 0 ? 'border-primary bg-primary/20' : 'border-gray-300 group-hover:border-gray-400'}">
						{#if selectedCount === guides.length}
							<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg>
						{:else if selectedCount > 0}
							<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="6" y1="12" x2="18" y2="12" /></svg>
						{/if}
					</div>
				</button>
				<span class="text-[10px] text-gray-400">{selectedCount}/{guides.length}</span>
			</div>

			<!-- Guide list -->
			<div class="max-h-40 overflow-y-auto space-y-1">
				{#each guides as guide, i}
					{@const runs = computeRunPlans(guide.steps)}
					<button
						onclick={() => toggleGuide(i)}
						class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition {guide.selected ? 'bg-blue-50/50 border border-primary/20' : 'bg-gray-50 border border-transparent hover:border-gray-200'}"
					>
						<div class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 {guide.selected ? 'bg-primary border-primary' : 'border-gray-300'}">
							{#if guide.selected}
								<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg>
							{/if}
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-[11px] font-medium text-gray-700 truncate">{guide.name}</p>
							<div class="flex items-center gap-1.5">
								{#if guide.stepCount > 0}
									<span class="text-[9px] text-gray-400">{guide.stepCount} étape{guide.stepCount > 1 ? 's' : ''}</span>
								{/if}
								{#if runs.length > 1}
									<span class="text-[9px] text-primary font-medium">{runs.length} branches</span>
								{/if}
								{#if guide.steps?.some(s => s.stepType === 'question')}
									<span class="text-[9px] text-amber-500">Q</span>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- Execution mode toggle -->
			<div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
				<span class="text-[10px] text-gray-500 shrink-0">Mode :</span>
				<div class="flex gap-0.5 bg-gray-200 rounded p-0.5 flex-1">
					<button
						onclick={() => (executionMode = 'auto')}
						class="flex-1 py-1 rounded text-[10px] font-medium transition {executionMode === 'auto' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}"
					>
						Automatique
					</button>
					<button
						onclick={() => (executionMode = 'manual')}
						class="flex-1 py-1 rounded text-[10px] font-medium transition {executionMode === 'manual' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}"
					>
						Manuel
					</button>
				</div>
			</div>

			<!-- Debug info (collapsed) -->
			{#if debugInfo}
				<details class="text-[10px] text-gray-400">
					<summary class="cursor-pointer hover:text-gray-600">Debug info</summary>
					<pre class="mt-1 p-2 bg-gray-50 rounded text-[9px] overflow-x-auto max-h-48 overflow-y-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
				</details>
			{/if}

			<!-- Estimation -->
			{#if selectedCount > 0}
				{@const info = branchInfo()}
				<div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 rounded-lg">
					<svg class="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
					<span class="text-[10px] text-primary">
						~{info.totalPages} page{info.totalPages > 1 ? 's' : ''}
						{#if info.hasBranches}
							({info.totalRuns} run{info.totalRuns > 1 ? 's' : ''} — branches détectées)
						{/if}
					</span>
				</div>
			{/if}

			<!-- Start button -->
			<button
				onclick={startCapture}
				disabled={selectedCount === 0}
				class="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition disabled:opacity-50"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="5 3 19 12 5 21 5 3" />
				</svg>
				Lancer la capture ({selectedCount} guide{selectedCount > 1 ? 's' : ''})
			</button>
		</div>
	{/if}
</div>
