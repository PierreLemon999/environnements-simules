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
		{ key: 'all', label: 'Tous' },
		{ key: 'page', label: 'Pages' },
		{ key: 'project', label: 'Projets' },
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

	const avatarColors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];

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

	function getBadgeStyle(toolName: string): { bg: string; color: string } {
		const styles: Record<string, { bg: string; color: string }> = {
			'Salesforce': { bg: '#eff6ff', color: '#2563eb' },
			'SAP SuccessFactors': { bg: '#fef3c7', color: '#b45309' },
			'Workday': { bg: '#f5f3ff', color: '#7c3aed' },
			'ServiceNow': { bg: '#e0e7ff', color: '#4338ca' },
			'HubSpot': { bg: '#fff1f2', color: '#e11d48' },
			'Zendesk': { bg: '#f0fdfa', color: '#0f766e' },
			'Oracle': { bg: '#fef2f2', color: '#dc2626' },
		};
		return styles[toolName] ?? { bg: '#f3f4f6', color: '#6b7280' };
	}

	function getBadgeLabel(toolName: string): string {
		const labels: Record<string, string> = {
			'SAP SuccessFactors': 'SAP',
		};
		return labels[toolName] ?? toolName;
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
			case 'page': return 'Pages';
			case 'project': return 'Projets';
			case 'user': return 'Utilisateurs';
			case 'action': return 'Actions';
			default: return '';
		}
	}

	function getActionHintForType(type: string) {
		switch (type) {
			case 'user': return 'Voir le profil';
			default: return 'Ouvrir';
		}
	}

	function getAvatarColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return avatarColors[Math.abs(hash) % avatarColors.length];
	}

	function getInitials(name: string): string {
		return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
	}

	function highlightMatch(text: string, q: string): string {
		if (!q.trim()) return text;
		const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(${escaped})`, 'gi');
		return text.replace(regex, '<mark>$1</mark>');
	}

	function groupResults(items: SearchResult[]): Record<string, SearchResult[]> {
		const order = ['page', 'project', 'user', 'action'];
		const groups: Record<string, SearchResult[]> = {};
		for (const type of order) {
			const matching = items.filter((r) => r.type === type);
			if (matching.length > 0) groups[type] = matching;
		}
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
		class="palette-overlay"
		onmousedown={() => { open = false; }}
		onkeydown={handleKeydown}
	>
		<!-- Modal -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="palette-modal"
			role="dialog"
			aria-label="Recherche admin"
			onmousedown={handleModalMousedown}
		>
			<!-- Search input -->
			<div class="palette-search-area">
				<Search class="palette-search-icon" />
				<input
					bind:this={inputRef}
					bind:value={query}
					oninput={handleInput}
					onkeydown={handleKeydown}
					type="text"
					placeholder="Recherche admin..."
					class="palette-search-input"
				/>
			</div>

			<!-- Category filter tabs -->
			<div class="palette-tabs">
				{#each categoryTabs as tab}
					<button
						class="palette-tab {activeFilter === tab.key ? 'active' : ''}"
						onclick={() => setFilter(tab.key)}
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<!-- Results -->
			<div class="palette-results">
				{#if loading}
					<div class="palette-loading">
						<div class="palette-spinner"></div>
					</div>
				{:else if filteredResults().length === 0}
					<div class="palette-no-results">
						<Search style="width:40px;height:40px;opacity:0.4;color:#a8a29e" />
						<p class="palette-no-results-title">Aucun résultat</p>
						<p class="palette-no-results-desc">Essayez avec d'autres termes de recherche</p>
					</div>
				{:else}
					{@const grouped = groupResults(filteredResults())}
					{#each Object.entries(grouped) as [type, items]}
						<div class="palette-group">
							<div class="palette-group-label">
								{getLabelForType(type)}
								<span class="palette-group-count">{items.length} résultat{items.length !== 1 ? 's' : ''}</span>
							</div>
							{#each items as result, ri}
								{@const globalIdx = getGlobalIndex(grouped, type, ri)}
								{@const Icon = result.icon ?? getIconForType(result.type)}
								{@const isSelected = selectedIndex === globalIdx}
								<button
									class="palette-result-item {isSelected ? 'selected' : ''}"
									onmouseenter={() => { selectedIndex = globalIdx; }}
									onclick={() => handleSelect(result)}
								>
									{#if result.type === 'user'}
										<div class="palette-avatar-wrap">
											<div class="palette-avatar {getAvatarColor(result.title)}">
												{getInitials(result.title)}
											</div>
										</div>
									{:else if result.type === 'action' && result.icon === Plus}
										<div class="palette-icon-wrap palette-icon-wrap-action">
											<Plus class="palette-icon" style="color: #16a34a" />
										</div>
									{:else}
										<div class="palette-icon-wrap">
											<Icon class="palette-icon" />
										</div>
									{/if}
									<div class="palette-result-body">
										<div class="palette-result-name-row">
											{#if query.trim()}
												<span class="palette-result-name">{@html highlightMatch(result.title, query)}</span>
											{:else}
												<span class="palette-result-name">{result.title}</span>
											{/if}
											{#if (result.type === 'page' || result.type === 'project') && result.subtitle}
												{@const badge = getBadgeStyle(result.subtitle)}
												<span class="palette-result-badge" style="background:{badge.bg};color:{badge.color}">
													{getBadgeLabel(result.subtitle)}
												</span>
											{/if}
										</div>
										{#if result.meta}
											<span class="palette-result-meta">{result.meta}</span>
										{:else if result.subtitle && result.type !== 'page' && result.type !== 'project'}
											<span class="palette-result-meta">{result.subtitle}</span>
										{/if}
									</div>
									<div class="palette-result-right">
										<span class="palette-result-action-hint">{getActionHintForType(result.type)}</span>
									</div>
								</button>
							{/each}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Overlay */
	.palette-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: min(18vh, 140px);
		animation: overlayFadeIn 0.2s ease-out both;
	}

	@keyframes overlayFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	/* Modal */
	.palette-modal {
		width: 100%;
		max-width: 600px;
		background: #fff;
		border-radius: 16px;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.05),
			0 4px 6px -1px rgba(0, 0, 0, 0.08),
			0 25px 50px -6px rgba(0, 0, 0, 0.22);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: min(72vh, 560px);
		animation: paletteIn 0.25s cubic-bezier(0.16, 1, 0.3, 1.05) both;
	}

	@keyframes paletteIn {
		from {
			opacity: 0;
			transform: scale(0.96) translateY(-8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	/* Search area */
	.palette-search-area {
		display: flex;
		align-items: center;
		padding: 0 16px;
		border-bottom: 1px solid #e7e5e4;
		flex-shrink: 0;
	}

	.palette-search-area :global(.palette-search-icon) {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		color: #a8a29e;
		transition: color 0.2s ease;
	}

	.palette-search-area:focus-within :global(.palette-search-icon) {
		color: #2563eb;
	}

	.palette-search-input {
		flex: 1;
		border: none;
		outline: none;
		font-family: inherit;
		font-size: 16px;
		font-weight: 400;
		color: #0c0a09;
		padding: 16px 12px;
		background: transparent;
		line-height: 1.5;
	}

	.palette-search-input::placeholder {
		color: #a8a29e;
	}

	/* Category tabs */
	.palette-tabs {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px 12px;
		border-bottom: 1px solid #e7e5e4;
		flex-shrink: 0;
	}

	.palette-tab {
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 500;
		color: #6b7280;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.palette-tab:hover {
		background: rgba(0, 0, 0, 0.03);
		color: #0c0a09;
	}

	.palette-tab.active {
		background: #eff6ff;
		color: #2563eb;
	}

	/* Results */
	.palette-results {
		overflow-y: auto;
		overscroll-behavior: contain;
		flex: 1;
		padding: 4px 0;
	}

	.palette-results::-webkit-scrollbar {
		width: 6px;
	}

	.palette-results::-webkit-scrollbar-track {
		background: transparent;
	}

	.palette-results::-webkit-scrollbar-thumb {
		background: #d1d5db;
		border-radius: 3px;
	}

	/* Loading */
	.palette-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px;
	}

	.palette-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid #2563eb;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* No results */
	.palette-no-results {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: #a8a29e;
		text-align: center;
	}

	.palette-no-results-title {
		font-size: 14px;
		font-weight: 600;
		color: #57534e;
		margin-top: 12px;
		margin-bottom: 4px;
	}

	.palette-no-results-desc {
		font-size: 12px;
		color: #a8a29e;
	}

	/* Group */
	.palette-group {
		padding: 0 6px;
	}

	.palette-group + .palette-group {
		margin-top: 2px;
	}

	.palette-group-label {
		font-size: 11px;
		font-weight: 600;
		color: #a8a29e;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 8px 10px 4px;
		user-select: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.palette-group-count {
		font-size: 10px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.04);
		color: #a8a29e;
		letter-spacing: 0;
		text-transform: none;
	}

	/* Result item */
	.palette-result-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 9px 10px;
		border-radius: 10px;
		cursor: pointer;
		transition: background-color 0.1s ease;
		border: none;
		background: transparent;
		width: 100%;
		text-align: left;
		font-family: inherit;
	}

	.palette-result-item:hover {
		background: #f3f4f6;
	}

	.palette-result-item.selected {
		background: #2563eb;
	}

	.palette-result-item.selected .palette-result-name,
	.palette-result-item.selected .palette-result-meta {
		color: #fff;
	}

	.palette-result-item.selected :global(.palette-icon) {
		color: #fff !important;
	}

	.palette-result-item.selected .palette-icon-wrap {
		background: rgba(255, 255, 255, 0.2);
	}

	.palette-result-item.selected .palette-icon-wrap-action {
		background: rgba(255, 255, 255, 0.2);
	}

	.palette-result-item.selected .palette-result-badge {
		background: rgba(255, 255, 255, 0.2) !important;
		color: #fff !important;
	}

	.palette-result-item.selected .palette-avatar {
		border-color: rgba(255, 255, 255, 0.3);
	}

	.palette-result-item.selected .palette-result-action-hint {
		color: rgba(255, 255, 255, 0.6);
	}

	/* Icon wrap */
	.palette-icon-wrap {
		width: 34px;
		height: 34px;
		border-radius: 8px;
		background: #f3f4f6;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background-color 0.1s ease;
	}

	.palette-icon-wrap-action {
		background: #f0fdf4;
	}

	.palette-icon-wrap :global(.palette-icon) {
		width: 16px;
		height: 16px;
		color: #6b7280;
		transition: color 0.1s ease;
	}

	/* Avatar */
	.palette-avatar-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.palette-avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 600;
		color: #fff;
		flex-shrink: 0;
		border: 2px solid #fff;
		transition: border-color 0.1s ease;
	}

	/* Result body */
	.palette-result-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.palette-result-name-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.palette-result-name {
		font-size: 14px;
		font-weight: 500;
		color: #0c0a09;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.1s ease;
		line-height: 1.4;
	}

	.palette-result-name :global(mark) {
		background: none;
		color: inherit;
		font-weight: 600;
		text-decoration: underline;
		text-decoration-color: #2563eb;
		text-underline-offset: 2px;
		text-decoration-thickness: 2px;
	}

	.palette-result-item.selected .palette-result-name :global(mark) {
		text-decoration-color: rgba(255, 255, 255, 0.6);
	}

	.palette-result-badge {
		flex-shrink: 0;
		font-size: 10px;
		font-weight: 600;
		padding: 2px 7px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		line-height: 1.4;
		transition: background-color 0.1s ease, color 0.1s ease;
	}

	.palette-result-meta {
		font-size: 12px;
		color: #a8a29e;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.1s ease;
		line-height: 1.4;
	}

	/* Right side action hint */
	.palette-result-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.palette-result-action-hint {
		font-size: 11px;
		color: #a8a29e;
		opacity: 0;
		transition: opacity 0.15s ease;
		white-space: nowrap;
	}

	.palette-result-item:hover .palette-result-action-hint,
	.palette-result-item.selected .palette-result-action-hint {
		opacity: 1;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.palette-overlay {
			padding-top: 0;
			align-items: flex-start;
		}

		.palette-modal {
			max-width: 100%;
			max-height: 100vh;
			border-radius: 0;
			height: 100vh;
		}
	}
</style>
