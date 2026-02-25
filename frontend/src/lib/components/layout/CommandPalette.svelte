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
	}

	let open = $state(false);
	let query = $state('');
	let activeTab = $state('all');
	let results: SearchResult[] = $state([]);
	let loading = $state(false);
	let selectedIndex = $state(0);
	let inputRef: HTMLInputElement | undefined = $state();
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	const tabs = [
		{ id: 'all', label: 'Tous' },
		{ id: 'page', label: 'Pages' },
		{ id: 'project', label: 'Projets' },
		{ id: 'user', label: 'Utilisateurs' },
		{ id: 'action', label: 'Actions' },
	];

	const quickActions: SearchResult[] = [
		{ id: 'action-new-project', type: 'action', title: 'Créer un projet', subtitle: '⌘P', href: '/admin/projects?action=create', icon: Plus },
		{ id: 'action-new-capture', type: 'action', title: 'Nouvelle capture', subtitle: '⌘N', href: '/admin/tree', icon: Camera },
		{ id: 'action-dashboard', type: 'action', title: 'Aller au Dashboard', subtitle: '', href: '/admin', icon: Zap },
		{ id: 'action-analytics', type: 'action', title: 'Voir les Analytics', subtitle: '', href: '/admin/analytics', icon: Zap },
		{ id: 'action-users', type: 'action', title: 'Gérer les utilisateurs', subtitle: '', href: '/admin/users', icon: Users },
		{ id: 'action-obfuscation', type: 'action', title: 'Règles d\'obfuscation', subtitle: '', href: '/admin/obfuscation', icon: Zap },
		{ id: 'action-invitations', type: 'action', title: 'Invitations clients', subtitle: '', href: '/admin/invitations', icon: Zap },
	];

	let filteredResults = $derived(() => {
		if (activeTab === 'all') return results;
		return results.filter((r) => r.type === activeTab);
	});

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
		const groups: Record<string, SearchResult[]> = {};
		for (const r of items) {
			if (!groups[r.type]) groups[r.type] = [];
			groups[r.type].push(r);
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
			results = [...quickActions];
			activeTab = 'all';
			selectedIndex = 0;
			setTimeout(() => inputRef?.focus(), 10);
		}
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
			<!-- Search input -->
			<div class="flex items-center gap-3 border-b border-border px-4 py-3">
				<Search class="h-4 w-4 shrink-0 text-muted" />
				<input
					bind:this={inputRef}
					bind:value={query}
					oninput={handleInput}
					onkeydown={handleKeydown}
					type="text"
					placeholder="Rechercher des pages, projets, utilisateurs..."
					class="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
				/>
				<kbd class="rounded border border-border bg-input px-1.5 py-0.5 font-mono text-[10px] text-muted">
					ESC
				</kbd>
			</div>

			<!-- Category tabs -->
			<div class="flex gap-1 border-b border-border px-4 py-2">
				{#each tabs as tab}
					<button
						class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {activeTab === tab.id ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
						onclick={() => { activeTab = tab.id; selectedIndex = 0; }}
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
						{#if activeTab === 'all'}
							<p class="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted first:mt-0">
								{getLabelForType(type)}s
							</p>
						{/if}
						{#each items as result, ri}
							{@const globalIdx = getGlobalIndex(grouped, type, ri)}
							{@const Icon = result.icon ?? getIconForType(result.type)}
							<button
								class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors {selectedIndex === globalIdx ? 'bg-accent text-foreground' : 'text-secondary hover:bg-accent/50'}"
								onmouseenter={() => { selectedIndex = globalIdx; }}
								onclick={() => handleSelect(result)}
							>
								<Icon class="h-4 w-4 shrink-0 text-muted" />
								<div class="min-w-0 flex-1 text-left">
									<p class="truncate font-medium">{result.title}</p>
									{#if result.subtitle}
										<p class="truncate text-xs text-muted-foreground">{result.subtitle}</p>
									{/if}
								</div>
								<ArrowRight class="h-3 w-3 shrink-0 text-muted opacity-0 {selectedIndex === globalIdx ? 'opacity-100' : ''}" />
							</button>
						{/each}
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-muted">
				<span class="inline-flex items-center gap-1"><kbd class="rounded border border-border px-1 py-0.5 font-mono">↑↓</kbd> Naviguer</span>
				<span class="inline-flex items-center gap-1"><kbd class="rounded border border-border px-1 py-0.5 font-mono">↵</kbd> Ouvrir</span>
				<span class="inline-flex items-center gap-1"><kbd class="rounded border border-border px-1 py-0.5 font-mono">Esc</kbd> Fermer</span>
			</div>
		</div>
	</div>
{/if}
