<script lang="ts">
	import type { Project } from '$lib/constants';
	import { BACKOFFICE_URL } from '$lib/constants';

	let {
		projects,
		activeProject,
		detectedProject,
		onSelect,
		onRefresh
	}: {
		projects: Project[];
		activeProject: Project | null;
		detectedProject: Project | null;
		onSelect: (project: Project) => void;
		onRefresh: () => void;
	} = $props();

	let isOpen = $state(false);
	let search = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	let filteredProjects = $derived(
		search.trim()
			? projects.filter((p) => {
					const q = search.toLowerCase();
					return p.name.toLowerCase().includes(q) || p.toolName?.toLowerCase().includes(q) || p.subdomain?.toLowerCase().includes(q);
				})
			: projects
	);

	function toggle() {
		isOpen = !isOpen;
		if (!isOpen) search = '';
	}

	function select(project: Project) {
		onSelect(project);
		isOpen = false;
		search = '';
	}

	function openBackOffice() {
		chrome.tabs.create({ url: `${BACKOFFICE_URL}/admin/projects` });
		isOpen = false;
		search = '';
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.project-dropdown')) {
			isOpen = false;
			search = '';
		}
	}

	function getInitials(name: string): string {
		return name.slice(0, 2).toUpperCase();
	}

	// Default icon colors per tool
	function getToolColor(toolName: string): string {
		const colors: Record<string, string> = {
			'Salesforce': '#00A1E0',
			'SAP SuccessFactors': '#0070F2',
			'Workday': '#F5A623',
			'ServiceNow': '#81B5A1',
			'HubSpot': '#FF7A59',
			'Zendesk': '#03363D',
			'Oracle': '#C74634',
			'Microsoft Dynamics': '#0078D4',
			'Jira': '#0052CC',
			'Confluence': '#1868DB',
		};
		return colors[toolName] ?? '#6D7481';
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			setTimeout(() => searchInput?.focus(), 50);
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
			{#if activeProject.logoUrl}
				<img src={activeProject.logoUrl} alt={activeProject.toolName} class="w-7 h-7 rounded-md object-cover shrink-0" />
			{:else}
				<div
					class="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
					style="background-color: {activeProject.iconColor || getToolColor(activeProject.toolName)}"
				>
					{getInitials(activeProject.toolName || activeProject.name)}
				</div>
			{/if}
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
		<div class="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
			{#if projects.length > 3}
				<div class="px-2.5 py-2 border-b border-gray-100">
					<input
						bind:this={searchInput}
						bind:value={search}
						type="text"
						placeholder="Rechercher un projet..."
						class="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
					/>
				</div>
			{/if}
			<div class="overflow-y-auto">
			{#each filteredProjects as project}
				<button
					onclick={() => select(project)}
					class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition text-left {activeProject?.id === project.id ? 'bg-blue-50/50' : ''}"
				>
					{#if project.logoUrl}
						<img src={project.logoUrl} alt={project.toolName} class="w-6 h-6 rounded-md object-cover shrink-0" />
					{:else}
						<div
							class="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
							style="background-color: {project.iconColor || getToolColor(project.toolName)}"
						>
							{getInitials(project.toolName || project.name)}
						</div>
					{/if}
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

			{#if filteredProjects.length === 0 && search.trim()}
				<div class="px-3 py-3 text-center">
					<p class="text-xs text-gray-400">Aucun projet trouvé</p>
				</div>
			{/if}
			</div>

			<!-- Separator + actions -->
			<div class="border-t border-gray-100 shrink-0 flex">
				<button
					onclick={openBackOffice}
					class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-primary hover:bg-blue-50/50 transition"
					title="Créer un projet dans le back-office"
				>
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
					</svg>
					<span class="text-xs font-medium">Nouveau</span>
				</button>
				<div class="w-px bg-gray-100"></div>
				<button
					onclick={() => { isOpen = false; search = ''; onRefresh(); }}
					class="flex items-center justify-center gap-1.5 px-3 py-2.5 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
					title="Actualiser la liste des projets"
				>
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
					</svg>
					<span class="text-xs font-medium">Actualiser</span>
				</button>
			</div>
		</div>
	{/if}
</div>
