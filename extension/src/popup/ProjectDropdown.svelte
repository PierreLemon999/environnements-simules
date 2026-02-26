<script lang="ts">
	import type { Project } from '$lib/constants';

	let {
		projects,
		activeProject,
		detectedProject,
		onSelect,
		onCreateNew
	}: {
		projects: Project[];
		activeProject: Project | null;
		detectedProject: Project | null;
		onSelect: (project: Project) => void;
		onCreateNew: () => void;
	} = $props();

	let isOpen = $state(false);

	function toggle() {
		isOpen = !isOpen;
	}

	function select(project: Project) {
		onSelect(project);
		isOpen = false;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.project-dropdown')) {
			isOpen = false;
		}
	}

	function getInitials(name: string): string {
		return name.slice(0, 2).toUpperCase();
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<div class="relative project-dropdown">
	<!-- Trigger -->
	<button
		onclick={toggle}
		class="w-full flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition text-left"
	>
		{#if activeProject}
			<div class="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
				{getInitials(activeProject.toolName || activeProject.name)}
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-gray-800 truncate">{activeProject.name}</p>
				{#if detectedProject && detectedProject.id === activeProject.id}
					<p class="text-[9px] text-primary font-medium">Détecté via URL</p>
				{/if}
			</div>
		{:else}
			<div class="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 shrink-0">
				--
			</div>
			<span class="text-sm text-gray-400 flex-1">Sélectionner un projet</span>
		{/if}
		<svg class="w-4 h-4 text-gray-400 shrink-0 transition {isOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</button>

	<!-- Dropdown panel -->
	{#if isOpen}
		<div class="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
			{#each projects as project}
				<button
					onclick={() => select(project)}
					class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition text-left {activeProject?.id === project.id ? 'bg-blue-50/50' : ''}"
				>
					<div class="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
						{getInitials(project.toolName || project.name)}
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-xs font-medium text-gray-700 truncate">{project.name}</p>
						<p class="text-[10px] text-gray-400 truncate">{project.subdomain}</p>
					</div>
					{#if detectedProject && detectedProject.id === project.id}
						<span class="text-[9px] text-primary font-medium shrink-0">URL</span>
					{/if}
					{#if activeProject?.id === project.id}
						<svg class="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
					{/if}
				</button>
			{/each}

			<!-- Separator + create new -->
			<div class="border-t border-gray-100">
				<button
					onclick={() => { isOpen = false; onCreateNew(); }}
					class="w-full flex items-center gap-2 px-3 py-2.5 text-primary hover:bg-blue-50/50 transition"
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
					</svg>
					<span class="text-xs font-medium">Nouveau projet</span>
				</button>
			</div>
		</div>
	{/if}
</div>
