<script lang="ts">
	import type { AutoCaptureConfig, InterestZone } from '$lib/auto-capture';

	let { config = $bindable(), onStart }: { config: AutoCaptureConfig; onStart: (config: AutoCaptureConfig) => void } = $props();

	let activeTab = $state<'config' | 'zones' | 'blacklist'>('config');
	let showDelay = $state(false);

	// Interest zone form
	let newZonePattern = $state('');
	let newZoneDepth = $state(5);

	// Blacklist form
	let newBlacklistItem = $state('');

	async function copyCurrentPathname() {
		try {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (tab?.url) {
				const url = new URL(tab.url);
				newZonePattern = url.pathname;
			}
		} catch {
			// Ignore
		}
	}

	function addInterestZone() {
		if (!newZonePattern.trim()) return;
		config.interestZones = [
			...config.interestZones,
			{ urlPattern: newZonePattern.trim(), depth: newZoneDepth }
		];
		newZonePattern = '';
		newZoneDepth = 5;
	}

	function removeInterestZone(index: number) {
		config.interestZones = config.interestZones.filter((_, i) => i !== index);
	}

	function addBlacklistItem() {
		if (!newBlacklistItem.trim()) return;
		config.blacklist = [...config.blacklist, newBlacklistItem.trim()];
		newBlacklistItem = '';
	}

	function removeBlacklistItem(index: number) {
		config.blacklist = config.blacklist.filter((_, i) => i !== index);
	}

	function handleStart() {
		onStart(config);
	}
</script>

<div class="flex flex-col gap-3">
	<!-- Tab bar -->
	<div class="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
		<button
			onclick={() => (activeTab = 'config')}
			class="flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition {activeTab === 'config' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			Configuration
		</button>
		<button
			onclick={() => (activeTab = 'zones')}
			class="flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition {activeTab === 'zones' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			Zones ({config.interestZones.length})
		</button>
		<button
			onclick={() => (activeTab = 'blacklist')}
			class="flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition {activeTab === 'blacklist' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			Liste noire ({config.blacklist.length})
		</button>
	</div>

	{#if activeTab === 'config'}
		<!-- Configuration panel -->
		<div class="space-y-3">
			<div class="grid grid-cols-2 gap-2">
				<div>
					<label class="block text-[11px] font-medium text-gray-600 mb-1">Pages à ajouter</label>
					<input
						type="number"
						min="1"
						max="500"
						bind:value={config.targetPageCount}
						class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
					/>
				</div>
				<div>
					<label class="block text-[11px] font-medium text-gray-600 mb-1">Profondeur max</label>
					<input
						type="number"
						min="1"
						max="10"
						bind:value={config.maxDepth}
						class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
					/>
				</div>
			</div>

			<button
				type="button"
				onclick={() => (showDelay = !showDelay)}
				class="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition"
			>
				<svg class="w-3 h-3 transition-transform {showDelay ? 'rotate-90' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
				Délais
				<span class="text-[10px] text-gray-300">{config.delayBetweenPages}ms · {config.pageTimeout / 1000}s</span>
			</button>
			{#if showDelay}
				<div class="grid grid-cols-2 gap-2">
					<div>
						<label class="block text-[10px] font-medium text-gray-500 mb-0.5">Délai entre pages</label>
						<input
							type="number"
							min="200"
							max="10000"
							step="100"
							bind:value={config.delayBetweenPages}
							class="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
						/>
						<p class="text-[9px] text-gray-400 mt-0.5">Attente entre captures (ms)</p>
					</div>
					<div>
						<label class="block text-[10px] font-medium text-gray-500 mb-0.5">Timeout par page</label>
						<input
							type="number"
							min="5000"
							max="120000"
							step="5000"
							bind:value={config.pageTimeout}
							class="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
						/>
						<p class="text-[9px] text-gray-400 mt-0.5">Passe à la suite si bloqué (ms)</p>
					</div>
				</div>
			{/if}
		</div>
	{:else if activeTab === 'zones'}
		<!-- Interest zones -->
		<div class="space-y-2">
			{#if config.interestZones.length === 0}
				<p class="text-[11px] text-gray-400 text-center py-3">
					Aucune zone d'intérêt.<br/>Les zones augmentent la profondeur de crawl.
				</p>
			{:else}
				{#each config.interestZones as zone, i}
					<div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
						<div class="flex-1 min-w-0">
							<p class="text-[11px] font-mono text-gray-700 truncate">{zone.urlPattern}</p>
							<p class="text-[10px] text-gray-400">profondeur {zone.depth}</p>
						</div>
						<button
							onclick={() => removeInterestZone(i)}
							class="text-gray-300 hover:text-red-500 transition shrink-0"
							title="Supprimer"
						>
							<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>
				{/each}
			{/if}

			<!-- Add zone form -->
			<div class="pt-1 space-y-1.5">
				<div class="flex gap-1.5">
					<input
						type="text"
						bind:value={newZonePattern}
						placeholder="Pattern URL (ex: /settings/.*)"
						class="flex-1 text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
					/>
					<button
						onclick={copyCurrentPathname}
						class="shrink-0 p-1.5 text-gray-400 hover:text-primary border border-gray-200 rounded-lg hover:border-primary/30 transition"
						title="Copier le chemin de l'onglet courant"
					>
						<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
					</button>
				</div>
				<div class="flex gap-2 items-center">
					<label class="text-[10px] text-gray-500 shrink-0">Prof.</label>
					<input
						type="number"
						bind:value={newZoneDepth}
						min="1"
						max="10"
						step="1"
						class="w-16 text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
					/>
					<button
						onclick={addInterestZone}
						disabled={!newZonePattern.trim()}
						class="flex-1 text-[11px] font-medium py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition disabled:opacity-40"
					>
						Ajouter
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Blacklist -->
		<div class="space-y-2">
			{#if config.blacklist.length === 0}
				<p class="text-[11px] text-gray-400 text-center py-3">
					Aucun élément dans la liste noire.
				</p>
			{:else}
				<div class="max-h-32 overflow-y-auto space-y-1">
					{#each config.blacklist as item, i}
						<div class="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 rounded-lg">
							<span class="flex-1 text-[11px] text-gray-700 truncate">{item}</span>
							<button
								onclick={() => removeBlacklistItem(i)}
								class="text-gray-300 hover:text-red-500 transition shrink-0"
								title="Supprimer"
							>
								<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Add blacklist form -->
			<div class="flex gap-2 pt-1">
				<input
					type="text"
					bind:value={newBlacklistItem}
					placeholder="Texte du bouton à éviter"
					class="flex-1 text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
				/>
				<button
					onclick={addBlacklistItem}
					disabled={!newBlacklistItem.trim()}
					class="text-[11px] font-medium px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition disabled:opacity-40"
				>
					Ajouter
				</button>
			</div>
		</div>
	{/if}

	<!-- Launch button -->
	<button
		onclick={handleStart}
		class="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition"
	>
		<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polygon points="5 3 19 12 5 21 5 3" />
		</svg>
		Lancer le crawl
	</button>
</div>
