<script lang="ts">
	import { goto } from '$app/navigation';
	import { get } from '$lib/api';
	import {
		Search,
		FileText,
		FolderKanban,
		Users,
		Zap,
		Plus,
		Camera,
		ArrowRight,
	} from 'lucide-svelte';

	interface SearchResult {
		id: string;
		type: 'page' | 'project' | 'user' | 'action';
		title: string;
		subtitle: string;
		href: string;
		icon?: typeof FileText;
		meta?: string;
	}

	type CategoryFilter = 'all' | 'page' | 'project' | 'user' | 'action';

	let open = $state(false);
	let query = $state('');
	let results: SearchResult[] = $state([]);
	let loading = $state(false);
	let selectedIndex = $state(0);
	let activeFilter: CategoryFilter = $state('all');
	let inputRef: HTMLInputElement | undefined = $state();
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	const categoryTabs: { key: CategoryFilter; label: string }[] = [
		{ key: 'all', label: 'Tout' },
		{ key: 'project', label: 'Projets' },
		{ key: 'page', label: 'Démos' },
		{ key: 'user', label: 'Utilisateurs' },
		{ key: 'action', label: 'Actions' },
	];

	const quickActions: SearchResult[] = [
		{ id: 'action-new-project', type: 'action', title: 'Créer un projet', subtitle: 'Initialiser un nouveau projet d\'environnement simulé', href: '/admin/projects?action=create', icon: Plus },
		{ id: 'action-new-capture', type: 'action', title: 'Nouvelle capture', subtitle: 'Lancer une capture de page depuis l\'extension', href: '/admin/tree', icon: Camera },
		{ id: 'action-dashboard', type: 'action', title: 'Aller au Dashboard', subtitle: 'Voir le tableau de bord principal', href: '/admin', icon: Zap },
		{ id: 'action-analytics', type: 'action', title: 'Voir les Analytics', subtitle: 'Consulter les statistiques de visites et sessions', href: '/admin/analytics', icon: Zap },
		{ id: 'action-users', type: 'action', title: 'Gérer les utilisateurs', subtitle: 'Ajouter, modifier ou supprimer des utilisateurs', href: '/admin/users', icon: Users },
		{ id: 'action-obfuscation', type: 'action', title: 'Règles d\'obfuscation', subtitle: 'Configurer les règles de masquage des données', href: '/admin/obfuscation', icon: Zap },
		{ id: 'action-invitations', type: 'action', title: 'Invitations clients', subtitle: 'Gérer les accès démo pour les prospects', href: '/admin/invitations', icon: Zap },
	];

	let filteredResults = $derived(() => {
		if (activeFilter === 'all') return results;
		return results.filter((r) => r.type === activeFilter);
	});

	function formatRelativeTime(dateStr: string): string {
		const now = new Date();
		const date = new Date(dateStr);
		const diffMs = now.getTime() - date.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMin / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMin < 1) return "À l'instant";
		if (diffMin < 60) return `Il y a ${diffMin}min`;
		if (diffHours < 24) return `Il y a ${diffHours}h`;
		if (diffDays === 1) return 'Hier';
		if (diffDays < 7) return `Il y a ${diffDays}j`;
		if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
		return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
	}

	function getToolBadgeColor(toolName: string): string {
		const colors: Record<string, string> = {
			'Salesforce': '#00A1E0',
			'SAP SuccessFactors': '#0070F2',
			'Workday': '#F5A623',
			'ServiceNow': '#81B5A1',
			'HubSpot': '#FF7A59',
			'Zendesk': '#03363D',
			'Oracle': '#C74634',
		};
		return colors[toolName] ?? '#6B7280';
	}

	function getIconForType(type: string) {
		switch (type) {
			case 'page': return FileText;
			case 'project': return FolderKanban;
			case 'user': return Users;
			case 'action': return Zap;
			default: return FileText;
		}
	}

	function getLabelForType(type: string) {
		switch (type) {
			case 'page': return 'Page';
			case 'project': return 'Projet';
			case 'user': return 'Utilisateur';
			case 'action': return 'Action';
			default: return '';
		}
	}

	function groupResults(items: SearchResult[]): Record<string, SearchResult[]> {
		// Ordered: pages first, then projects, users, actions
		const order = ['page', 'project', 'user', 'action'];
		const groups: Record<string, SearchResult[]> = {};
		for (const type of order) {
			const matching = items.filter((r) => r.type === type);
			if (matching.length > 0) groups[type] = matching;
		}
		// Include any types not in the predefined order
		for (const r of items) {
			if (!order.includes(r.type)) {
				if (!groups[r.type]) groups[r.type] = [];
				groups[r.type].push(r);
			}
		}
		return groups;
	}

	function getGlobalIndex(grouped: Record<string, SearchResult[]>, currentType: string, localIndex: number): number {
		let idx = 0;
		for (const [type, items] of Object.entries(grouped)) {
			if (type === currentType) return idx + localIndex;
			idx += items.length;
		}
		return idx + localIndex;
	}

	export function toggle() {
		open = !open;
		if (open) {
			query = '';
			activeFilter = 'all';
			results = [...quickActions];
			selectedIndex = 0;
			setTimeout(() => inputRef?.focus(), 10);
		}
	}

	function setFilter(filter: CategoryFilter) {
		activeFilter = filter;
		selectedIndex = 0;
	}

	async function search(q: string) {
		if (!q.trim()) {
			results = [...quickActions];
			selectedIndex = 0;
			return;
		}

		loading = true;
		const allResults: SearchResult[] = [];

		try {
			const projectsRes = await get<{ data: Array<{ id: string; name: string; toolName: string; subdomain: string }> }>('/projects');
			const ql = q.toLowerCase();

			// Search projects
			for (const p of projectsRes.data) {
				if (p.name.toLowerCase().includes(ql) || p.toolName.toLowerCase().includes(ql) || p.subdomain.toLowerCase().includes(ql)) {
					allResults.push({
						id: `project-${p.id}`,
						type: 'project',
						title: p.name,
						subtitle: p.toolName,
						href: `/admin/projects/${p.id}`,
					});
				}
			}

			// Search pages across all project versions
			for (const p of projectsRes.data) {
				try {
					const projectDetail = await get<{ data: { versions: Array<{ id: string; status: string }> } }>(`/projects/${p.id}`);
					const activeVersion = projectDetail.data.versions?.find(v => v.status === 'active') ?? projectDetail.data.versions?.[0];
					if (activeVersion) {
						const pagesRes = await get<{ data: Array<{ id: string; title: string; urlPath: string; createdAt: string }> }>(`/versions/${activeVersion.id}/pages`);
						for (const page of pagesRes.data) {
							if (page.title.toLowerCase().includes(ql) || page.urlPath.toLowerCase().includes(ql)) {
								allResults.push({
									id: `page-${page.id}`,
									type: 'page',
									title: page.title || page.urlPath,
									subtitle: p.toolName,
									href: `/admin/tree?version=${activeVersion.id}`,
									meta: `${p.name} — /${page.urlPath} — Capturée ${formatRelativeTime(page.createdAt)}`,
								});
							}
						}
					}
				} catch {
					// Skip projects with no pages
				}
			}

			// Search users
			const usersRes = await get<{ data: Array<{ id: string; name: string; email: string; role: string }> }>('/users');
			for (const u of usersRes.data) {
				if (u.name.toLowerCase().includes(ql) || u.email.toLowerCase().includes(ql)) {
					allResults.push({
						id: `user-${u.id}`,
						type: 'user',
						title: u.name,
						subtitle: `${u.email} — ${u.role}`,
						href: '/admin/users',
					});
				}
			}

			// Search actions
			for (const action of quickActions) {
				if (action.title.toLowerCase().includes(ql)) {
					allResults.push(action);
				}
			}
		} catch (err) {
			console.error('Command palette search error:', err);
		} finally {
			loading = false;
			results = allResults;
			selectedIndex = 0;
		}
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => search(query), 200);
	}

	function handleSelect(result: SearchResult) {
		open = false;
		goto(result.href);
	}

	function handleKeydown(e: KeyboardEvent) {
		const list = filteredResults();
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, list.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
		} else if (e.key === 'Enter' && list[selectedIndex]) {
			e.preventDefault();
			handleSelect(list[selectedIndex]);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			open = false;
		}
	}

	function handleGlobalKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			toggle();
		}
	}

	function handleModalMousedown(e: MouseEvent) {
		e.stopPropagation();
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
		onmousedown={() => { open = false; }}
		onkeydown={handleKeydown}
	>
		<!-- Modal -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="mx-auto mt-[15vh] w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-lg"
			onmousedown={handleModalMousedown}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-border px-4 py-2">
				<span class="text-[10px] font-semibold uppercase tracking-wider text-muted">Recherche admin</span>
				<kbd class="rounded border border-border bg-input px-1.5 py-0.5 font-mono text-[10px] text-muted">
					ESC
				</kbd>
			</div>

			<!-- Search input -->
			<div class="flex items-center gap-3 border-b border-border px-4 py-3">
				<Search class="h-4 w-4 shrink-0 text-muted" />
				<input
					bind:this={inputRef}
					bind:value={query}
					oninput={handleInput}
					onkeydown={handleKeydown}
					type="text"
					placeholder="Rechercher une page, un projet, une action..."
					class="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
				/>
			</div>

			<!-- Category filter tabs -->
			<div class="flex items-center gap-1 border-b border-border px-3 py-1.5">
				{#each categoryTabs as tab}
					<button
						class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors {activeFilter === tab.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
						onclick={() => setFilter(tab.key)}
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<!-- Results -->
			<div class="max-h-72 overflow-y-auto p-2">
				{#if loading}
					<div class="flex items-center justify-center py-8">
						<div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
					</div>
				{:else if filteredResults().length === 0}
					<p class="py-8 text-center text-sm text-muted-foreground">Aucun résultat trouvé.</p>
				{:else}
					{@const grouped = groupResults(filteredResults())}
					{#each Object.entries(grouped) as [type, items]}
						<p class="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted first:mt-0">
							{getLabelForType(type)}s
							<span class="ml-1 font-normal normal-case text-muted">{items.length} résultat{items.length !== 1 ? 's' : ''}</span>
						</p>
						{#each items as result, ri}
							{@const globalIdx = getGlobalIndex(grouped, type, ri)}
							{@const Icon = result.icon ?? getIconForType(result.type)}
							<button
								class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors {selectedIndex === globalIdx ? 'bg-accent text-foreground' : 'text-secondary hover:bg-accent/50'}"
								onmouseenter={() => { selectedIndex = globalIdx; }}
								onclick={() => handleSelect(result)}
							>
								{#if result.type === 'user'}
									<!-- Colored avatar circle with initials for users -->
									<div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
										{result.title.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
									</div>
								{:else}
									<Icon class="h-4 w-4 shrink-0 text-muted" />
								{/if}
								<div class="min-w-0 flex-1 text-left">
									<div class="flex items-center gap-2">
										<p class="truncate font-medium">{result.title}</p>
										{#if (result.type === 'page' || result.type === 'project') && result.subtitle}
											<span class="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white" style="background-color: {getToolBadgeColor(result.subtitle)}">{result.subtitle}</span>
										{/if}
									</div>
									{#if result.subtitle && result.type !== 'page' && result.type !== 'project'}
										<p class="truncate text-xs text-muted-foreground">{result.subtitle}</p>
									{/if}
									{#if result.meta}
										<p class="truncate text-[10px] text-muted">{result.meta}</p>
									{/if}
								</div>
								<ArrowRight class="h-3 w-3 shrink-0 text-muted opacity-0 {selectedIndex === globalIdx ? 'opacity-100' : ''}" />
							</button>
						{/each}
					{/each}
				{/if}
			</div>

			<!-- Footer with keyboard hints -->
			<div class="flex items-center gap-4 border-t border-border px-4 py-2">
				<span class="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
					<kbd class="rounded border border-border bg-input px-1 py-0.5 font-mono text-[9px]">&uarr;&darr;</kbd>
					naviguer
				</span>
				<span class="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
					<kbd class="rounded border border-border bg-input px-1 py-0.5 font-mono text-[9px]">Enter</kbd>
					ouvrir
				</span>
				<span class="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
					<kbd class="rounded border border-border bg-input px-1 py-0.5 font-mono text-[9px]">ESC</kbd>
					fermer
				</span>
				<span class="ml-auto text-[10px] font-medium text-muted">Recherche admin</span>
			</div>
		</div>
	</div>
{/if}
