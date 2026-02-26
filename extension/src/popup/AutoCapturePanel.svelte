<script lang="ts">
	import type { AutoCaptureConfig, InterestZone } from '$lib/auto-capture';

	let { config = $bindable(), onStart }: { config: AutoCaptureConfig; onStart: (config: AutoCaptureConfig) => void } = $props();

	let activeTab = $state<'config' | 'zones' | 'blacklist'>('config');

	// Interest zone form
	let newZonePattern = $state('');
	let newZoneMultiplier = $state(1.5);

	// Blacklist form
	let newBlacklistItem = $state('');

	function addInterestZone() {
		if (!newZonePattern.trim()) return;
		config.interestZones = [
			...config.interestZones,
			{ urlPattern: newZonePattern.trim(), depthMultiplier: newZoneMultiplier }
		];
		newZonePattern = '';
		newZoneMultiplier = 1.5;
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
			<div>
				<label class="block text-[11px] font-medium text-gray-600 mb-1">Pages cible</label>
				<input
					type="number"
					min="1"
					max="500"
					bind:value={config.targetPageCount}
					class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
				/>
				<p class="text-[10px] text-gray-400 mt-0.5">Nombre maximum de pages à capturer</p>
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
				<p class="text-[10px] text-gray-400 mt-0.5">Profondeur de navigation depuis la page initiale</p>
			</div>

			<div>
				<label class="block text-[11px] font-medium text-gray-600 mb-1">Délai entre pages (ms)</label>
				<input
					type="number"
					min="500"
					max="10000"
					step="500"
					bind:value={config.delayBetweenPages}
					class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
				/>
				<p class="text-[10px] text-gray-400 mt-0.5">Temps d'attente entre chaque capture</p>
			</div>
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
							<p class="text-[10px] text-gray-400">×{zone.depthMultiplier} profondeur</p>
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
				<input
					type="text"
					bind:value={newZonePattern}
					placeholder="Pattern URL (ex: /settings/.*)"
					class="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
				/>
				<div class="flex gap-2">
					<input
						type="number"
						bind:value={newZoneMultiplier}
						min="0.5"
						max="5"
						step="0.5"
						class="w-20 text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
