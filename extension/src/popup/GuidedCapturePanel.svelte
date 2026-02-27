<script lang="ts">
	import type { LLGuide } from '$lib/constants';

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

	let selectedCount = $derived(guides.filter((g) => g.selected).length);
	let estimatedPages = $derived(
		guides.filter((g) => g.selected).reduce((sum, g) => sum + Math.max(g.stepCount, 1), 0)
	);

	async function detectAndScan() {
		state = 'scanning';
		errorMessage = '';

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

			if (!detection?.detected) {
				playerDetected = false;
				state = 'error';
				errorMessage = 'Player Lemon Learning non détecté sur cette page. Naviguez vers une page contenant le Player LL.';
				return;
			}

			playerDetected = true;

			// Step 2: Scan guides
			const scanResult = await chrome.runtime.sendMessage({
				type: 'SCAN_LL_GUIDES',
				tabId: tab.id
			});

			if (scanResult?.guides?.length > 0) {
				guides = scanResult.guides.map((g: { id: string; name: string; stepCount: number }) => ({
					...g,
					selected: true
				}));
				state = 'selection';
			} else {
				state = 'error';
				errorMessage = 'Player détecté mais aucun guide trouvé. Les sélecteurs de scan seront affinés lors du test en live.';
			}
		} catch (err) {
			state = 'error';
			errorMessage = err instanceof Error ? err.message : 'Erreur de détection';
		}
	}

	function toggleGuide(index: number) {
		guides[index].selected = !guides[index].selected;
		guides = [...guides];
	}

	function selectAll() {
		guides = guides.map((g) => ({ ...g, selected: true }));
	}

	function deselectAll() {
		guides = guides.map((g) => ({ ...g, selected: false }));
	}

	function startCapture() {
		const selectedGuides = guides.filter((g) => g.selected);
		if (selectedGuides.length === 0) return;
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
			<p class="text-[11px] text-gray-500">Détection du Player LL...</p>
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
			<button
				onclick={detectAndScan}
				class="w-full py-2 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-blue-50 transition"
			>
				Réessayer
			</button>
		</div>

	{:else if state === 'selection'}
		<!-- Guide selection -->
		<div class="space-y-2.5">
			<!-- Header badge -->
			<div class="flex items-center gap-2 px-2.5 py-1.5 bg-green-50 border border-green-100 rounded-lg">
				<div class="w-1.5 h-1.5 rounded-full bg-success"></div>
				<span class="text-[11px] text-green-700 font-medium">Player LL détecté — {guides.length} guide{guides.length > 1 ? 's' : ''}</span>
			</div>

			<!-- Select/Deselect all -->
			<div class="flex items-center justify-between">
				<span class="text-[10px] text-gray-500">{selectedCount}/{guides.length} sélectionné{selectedCount > 1 ? 's' : ''}</span>
				<div class="flex gap-2">
					<button onclick={selectAll} class="text-[10px] text-primary hover:underline">Tout</button>
					<button onclick={deselectAll} class="text-[10px] text-gray-400 hover:underline">Aucun</button>
				</div>
			</div>

			<!-- Guide list -->
			<div class="max-h-40 overflow-y-auto space-y-1">
				{#each guides as guide, i}
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
							{#if guide.stepCount > 0}
								<p class="text-[9px] text-gray-400">{guide.stepCount} étape{guide.stepCount > 1 ? 's' : ''}</p>
							{/if}
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

			<!-- Estimation -->
			{#if selectedCount > 0}
				<div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 rounded-lg">
					<svg class="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
					<span class="text-[10px] text-primary">~{estimatedPages} page{estimatedPages > 1 ? 's' : ''} estimée{estimatedPages > 1 ? 's' : ''}</span>
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
