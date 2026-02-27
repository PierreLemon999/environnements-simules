<script lang="ts">
	import type { Version } from '$lib/constants';

	let {
		versions,
		activeVersion,
		onSelect,
		onCreateNew
	}: {
		versions: Version[];
		activeVersion: Version | null;
		onSelect: (version: Version) => void;
		onCreateNew: () => void;
	} = $props();

	let isOpen = $state(false);
	let search = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	let filteredVersions = $derived(
		search.trim()
			? versions.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
			: versions
	);

	function toggle() {
		isOpen = !isOpen;
		if (!isOpen) search = '';
	}

	function select(version: Version) {
		onSelect(version);
		isOpen = false;
		search = '';
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.version-dropdown')) {
			isOpen = false;
			search = '';
		}
	}

	function statusColor(status: string): string {
		if (status === 'active') return 'bg-success';
		if (status === 'draft') return 'bg-warning';
		return 'bg-gray-300';
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			setTimeout(() => searchInput?.focus(), 50);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<div class="relative version-dropdown">
	<!-- Trigger -->
	<button
		onclick={toggle}
		class="w-full flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition text-left"
	>
		{#if activeVersion}
			<div class="w-1.5 h-1.5 rounded-full shrink-0 {statusColor(activeVersion.status)}"></div>
			<span class="text-sm font-medium text-gray-800 truncate flex-1">{activeVersion.name}</span>
			<span class="text-[10px] text-gray-400 shrink-0">{activeVersion.status}</span>
		{:else if versions.length === 0}
			<span class="text-sm text-primary flex-1">Cr&eacute;er une version</span>
		{:else}
			<span class="text-sm text-gray-400 flex-1">S&eacute;lectionner une version</span>
		{/if}
		<svg class="w-3.5 h-3.5 text-gray-400 shrink-0 transition {isOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</button>

	<!-- Dropdown panel -->
	{#if isOpen}
		<div class="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-hidden flex flex-col">
			{#if versions.length > 3}
				<div class="px-2.5 py-2 border-b border-gray-100">
					<input
						bind:this={searchInput}
						bind:value={search}
						type="text"
						placeholder="Rechercher une version..."
						class="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
					/>
				</div>
			{/if}
			<div class="overflow-y-auto">
				{#each filteredVersions as version}
					<button
						onclick={() => select(version)}
						class="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition text-left {activeVersion?.id === version.id ? 'bg-blue-50/50' : ''}"
					>
						<div class="w-1.5 h-1.5 rounded-full shrink-0 {statusColor(version.status)}"></div>
						<div class="flex-1 min-w-0">
							<p class="text-xs font-medium text-gray-700 truncate">{version.name}</p>
						</div>
						<span class="text-[10px] text-gray-400 shrink-0">{version.status}</span>
						{#if activeVersion?.id === version.id}
							<svg class="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
						{/if}
					</button>
				{/each}

				{#if filteredVersions.length === 0 && search.trim()}
					<div class="px-3 py-3 text-center">
						<p class="text-xs text-gray-400">Aucune version trouv&eacute;e</p>
					</div>
				{/if}
			</div>

			<!-- Create new -->
			<div class="border-t border-gray-100 shrink-0">
				<button
					onclick={() => { isOpen = false; search = ''; onCreateNew(); }}
					class="w-full flex items-center gap-2 px-3 py-2.5 text-primary hover:bg-blue-50/50 transition"
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
					</svg>
					<span class="text-xs font-medium">Nouvelle version</span>
				</button>
			</div>
		</div>
	{/if}
</div>
