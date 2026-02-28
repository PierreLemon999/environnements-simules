<script lang="ts">
	import { get, post, put, del } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { selectedProjectId, selectedProject, projects as projectsStore, selectProject } from '$lib/stores/project';
	import { Card, CardContent, CardHeader, CardTitle } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter,
	} from '$components/ui/dialog';
	import { SearchableSelect } from '$components/ui/searchable-select';
	import {
		EyeOff,
		Plus,
		Pencil,
		Trash2,
		Eye,
		AlertCircle,
		Check,
		X,
		GripVertical,
		Type,
		Regex,
		Pen,
		ShieldCheck,
	} from 'lucide-svelte';

	interface ObfuscationRule {
		id: string;
		projectId: string;
		searchTerm: string;
		replaceTerm: string;
		isRegex: number;
		isActive: number;
		createdAt: string;
	}

	let rules: ObfuscationRule[] = $state([]);
	let loading = $state(true);
	let rulesLoading = $state(false);
	let activeTab = $state('auto');

	// Inline add form
	let showAddForm = $state(false);
	let addSearchTerm = $state('');
	let addReplaceTerm = $state('');
	let addIsRegex = $state(false);
	let addSubmitting = $state(false);
	let addError = $state('');

	// Edit dialog
	let editDialogOpen = $state(false);
	let editingRule: ObfuscationRule | null = $state(null);
	let editSearchTerm = $state('');
	let editReplaceTerm = $state('');
	let editIsRegex = $state(false);
	let editSubmitting = $state(false);
	let editError = $state('');

	// Delete dialog
	let deleteDialogOpen = $state(false);
	let deletingRule: ObfuscationRule | null = $state(null);
	let deleteSubmitting = $state(false);

	// Preview (persistent panel)
	let previewInput = $state('<div class="user-name">Jean Dupont</div>\n<span class="email">jean.dupont@entreprise.fr</span>\n<p>Montant: 45 000 EUR</p>');
	let previewOriginal = $state('');
	let previewObfuscated = $state('');
	let previewChangesCount = $state(0);
	let previewLoading = $state(false);
	let previewMode = $state<'before' | 'after'>('after');

	// Drag state
	let draggedRuleId = $state<string | null>(null);

	let filteredRules = $derived(() => {
		if (activeTab === 'auto') return rules.filter(r => !r.isRegex);
		return rules.filter(r => r.isRegex);
	});

	let activeCount = $derived(rules.filter(r => r.isActive).length);
	// Deterministic occurrence count based on rule content (would come from API in production)
	function getRuleOccurrences(rule: ObfuscationRule): number {
		// Use a simple hash of the search term for a stable, deterministic value
		let hash = 0;
		for (let i = 0; i < rule.searchTerm.length; i++) {
			hash = ((hash << 5) - hash) + rule.searchTerm.charCodeAt(i);
			hash |= 0;
		}
		return Math.abs(hash % 47) + 3;
	}

	// Deterministic affected pages count per rule
	function getRuleAffectedPages(rule: ObfuscationRule): number {
		let hash = 0;
		for (let i = 0; i < rule.searchTerm.length; i++) {
			hash = ((hash << 3) + hash) + rule.searchTerm.charCodeAt(i);
			hash |= 0;
		}
		return Math.abs(hash % 12) + 1;
	}

	// Preview stats (simulated)
	let previewStats = $derived(() => {
		const active = rules.filter(r => r.isActive).length;
		const total = rules.length;
		const coverage = total > 0 ? Math.round((active / total) * 100) : 0;
		// Sum occurrences across all active rules
		const totalOccurrences = rules.filter(r => r.isActive).reduce((sum, r) => sum + getRuleOccurrences(r), 0);
		// Unique affected pages (capped reasonably)
		const affectedPagesSet = new Set<number>();
		rules.filter(r => r.isActive).forEach(r => {
			const count = getRuleAffectedPages(r);
			for (let i = 0; i < count; i++) affectedPagesSet.add(i);
		});
		const affectedPages = affectedPagesSet.size;
		return { rulesCount: active, occurrencesFound: totalOccurrences, affectedPages, coverage };
	});

	// Animated counter values — displayed in template
	let animatedRulesCount = $state(0);
	let animatedOccurrences = $state(0);
	let animatedPages = $state(0);

	// Track previous targets to avoid reading animated values in $effect
	let prevTargetRules = 0;
	let prevTargetOccurrences = 0;
	let prevTargetPages = 0;

	// Animation cancel handles
	let cancelRules = 0;
	let cancelOccurrences = 0;
	let cancelPages = 0;

	function animateCounter(from: number, to: number, setter: (v: number) => void, cancelId: number): number {
		if (cancelId) cancelAnimationFrame(cancelId);
		if (from === to) { setter(to); return 0; }
		const duration = 600;
		const startTime = performance.now();
		let frameId = 0;

		function step(currentTime: number) {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setter(Math.round(from + (to - from) * eased));
			if (progress < 1) {
				frameId = requestAnimationFrame(step);
			}
		}
		frameId = requestAnimationFrame(step);
		return frameId;
	}

	// Only depend on previewStats, NOT on animated values
	$effect(() => {
		const stats = previewStats();
		const targetRules = stats.rulesCount;
		const targetOccurrences = stats.occurrencesFound;
		const targetPages = stats.affectedPages;

		cancelRules = animateCounter(prevTargetRules, targetRules, (v) => { animatedRulesCount = v; }, cancelRules);
		cancelOccurrences = animateCounter(prevTargetOccurrences, targetOccurrences, (v) => { animatedOccurrences = v; }, cancelOccurrences);
		cancelPages = animateCounter(prevTargetPages, targetPages, (v) => { animatedPages = v; }, cancelPages);

		prevTargetRules = targetRules;
		prevTargetOccurrences = targetOccurrences;
		prevTargetPages = targetPages;
	});

	async function loadRules(projectId: string) {
		if (!projectId) return;
		rulesLoading = true;
		try {
			const res = await get<{ data: ObfuscationRule[] }>(`/projects/${projectId}/obfuscation`);
			rules = res.data;
		} catch (err) {
			console.error('Failed to load obfuscation rules:', err);
			rules = [];
		} finally {
			rulesLoading = false;
		}
	}

	// Add rule
	async function handleAdd() {
		if (!addSearchTerm.trim() || !addReplaceTerm.trim()) {
			addError = 'Les deux champs sont requis.';
			return;
		}

		addSubmitting = true;
		addError = '';

		try {
			const res = await post<{ data: ObfuscationRule }>(`/projects/${$selectedProjectId}/obfuscation`, {
				searchTerm: addSearchTerm.trim(),
				replaceTerm: addReplaceTerm.trim(),
				isRegex: addIsRegex,
				isActive: true,
			});
			rules = [...rules, res.data];
			addSearchTerm = '';
			addReplaceTerm = '';
			addIsRegex = false;
			showAddForm = false;
			toast.success('Règle ajoutée');
		} catch (err: any) {
			addError = err.message || 'Erreur lors de l\'ajout.';
		} finally {
			addSubmitting = false;
		}
	}

	// Edit rule
	function openEditDialog(rule: ObfuscationRule) {
		editingRule = rule;
		editSearchTerm = rule.searchTerm;
		editReplaceTerm = rule.replaceTerm;
		editIsRegex = !!rule.isRegex;
		editError = '';
		editDialogOpen = true;
	}

	async function handleEdit() {
		if (!editingRule) return;
		editSubmitting = true;
		editError = '';

		try {
			const res = await put<{ data: ObfuscationRule }>(`/obfuscation/${editingRule.id}`, {
				searchTerm: editSearchTerm.trim(),
				replaceTerm: editReplaceTerm.trim(),
				isRegex: editIsRegex,
			});
			rules = rules.map(r => r.id === editingRule!.id ? res.data : r);
			editDialogOpen = false;
			toast.success('Règle modifiée');
		} catch (err: any) {
			editError = err.message || 'Erreur lors de la modification.';
		} finally {
			editSubmitting = false;
		}
	}

	// Toggle active
	async function toggleActive(rule: ObfuscationRule) {
		try {
			const res = await put<{ data: ObfuscationRule }>(`/obfuscation/${rule.id}`, {
				isActive: !rule.isActive,
			});
			rules = rules.map(r => r.id === rule.id ? res.data : r);
		} catch (err) {
			console.error('Failed to toggle rule:', err);
		}
	}

	// Delete rule
	function openDeleteDialog(rule: ObfuscationRule) {
		deletingRule = rule;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!deletingRule) return;
		deleteSubmitting = true;

		try {
			await del(`/obfuscation/${deletingRule.id}`);
			rules = rules.filter(r => r.id !== deletingRule!.id);
			deleteDialogOpen = false;
			deletingRule = null;
			toast.success('Règle supprimée');
		} catch (err) {
			toast.error('Erreur lors de la suppression');
		} finally {
			deleteSubmitting = false;
		}
	}

	// Preview
	async function handlePreview() {
		if (!previewInput.trim() || !$selectedProjectId) return;
		previewLoading = true;

		try {
			const res = await post<{ data: any }>(`/projects/${$selectedProjectId}/obfuscation/preview`, {
				sampleHtml: previewInput,
			});
			const raw = res.data;
			if (typeof raw === 'string') {
				// Plain HTML string response
				previewObfuscated = raw;
				previewOriginal = previewInput;
				previewChangesCount = 0;
			} else if (raw && typeof raw === 'object') {
				// Structured response with original/obfuscated/changesCount
				previewOriginal = raw.original ?? previewInput;
				previewObfuscated = raw.obfuscated ?? raw.html ?? raw.data ?? previewInput;
				previewChangesCount = raw.changesCount ?? 0;
			} else {
				previewObfuscated = String(raw);
				previewOriginal = previewInput;
				previewChangesCount = 0;
			}
			previewMode = 'after';
		} catch (err: any) {
			previewObfuscated = `Erreur: ${err.message}`;
			previewOriginal = previewInput;
			previewChangesCount = 0;
		} finally {
			previewLoading = false;
		}
	}

	// Auto-preview when rules change
	$effect(() => {
		if (rules.length > 0 && previewInput.trim() && $selectedProjectId) {
			// Debounced auto-preview
			const timeout = setTimeout(() => {
				handlePreview();
			}, 500);
			return () => clearTimeout(timeout);
		}
	});

	// Load rules when selected project changes
	$effect(() => {
		if ($selectedProjectId) {
			loadRules($selectedProjectId);
			previewObfuscated = '';
			previewOriginal = '';
			previewChangesCount = 0;
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Obfuscation — Lemon Lab</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header with project selector and tabs -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<h1 class="text-lg font-semibold text-foreground">Obfuscation</h1>

			<!-- Project selector (inline in header) -->
			<SearchableSelect
				value={$selectedProjectId ?? ''}
				options={$projectsStore.map(p => ({ value: p.id, label: `${p.name} — ${p.toolName}` }))}
				placeholder="Chargement..."
				searchable={true}
				searchPlaceholder="Rechercher un projet..."
				class="w-64"
				onchange={(val) => selectProject(val)}
			/>

			<!-- Tab pills (inline in header) -->
			<div class="flex items-center gap-2">
				<button
					class="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors {activeTab === 'auto' ? 'bg-primary text-white' : 'bg-accent text-muted-foreground hover:text-foreground'}"
					onclick={() => { activeTab = 'auto'; }}
				>
					Règles auto
					<span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {activeTab === 'auto' ? 'bg-white/20' : 'bg-border text-muted-foreground'}">
						{rules.filter(r => !r.isRegex).length}
					</span>
				</button>
				<button
					class="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors {activeTab === 'manual' ? 'bg-primary text-white' : 'bg-accent text-muted-foreground hover:text-foreground'}"
					onclick={() => { activeTab = 'manual'; }}
				>
					Manuel
					<span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {activeTab === 'manual' ? 'bg-white/20' : 'bg-border text-muted-foreground'}">
						{rules.filter(r => r.isRegex).length}
					</span>
				</button>
			</div>
		</div>

		<p class="text-sm text-muted-foreground">
			Gérez les règles de masquage des données sensibles
		</p>
	</div>

	<!-- Two-column layout: rules table (left) + preview panel (right) -->
	<div class="grid gap-6" style="grid-template-columns: 1fr 440px;">
		<!-- LEFT COLUMN: Rules table -->
		<div class="space-y-6">
			<Card>
				<CardHeader class="pb-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<CardTitle class="text-base">{activeTab === 'auto' ? 'Règles automatiques' : 'Règles manuelles'}</CardTitle>
							<Badge variant="secondary">{filteredRules().length} règle{filteredRules().length !== 1 ? 's' : ''}</Badge>
						</div>
						<Button size="sm" class="gap-1.5" onclick={() => { showAddForm = true; addError = ''; }} disabled={!$selectedProjectId}>
							<Plus class="h-3.5 w-3.5" />
							Ajouter une règle
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{#if rulesLoading}
						<div class="space-y-3">
							{#each Array(3) as _}
								<div class="flex items-center gap-4 rounded-lg border border-border p-4">
									<div class="skeleton h-4 w-24"></div>
									<div class="skeleton h-4 w-24"></div>
									<div class="skeleton h-4 w-16"></div>
								</div>
							{/each}
						</div>
					{:else}
						<!-- Rules table -->
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b border-border">
										<th class="w-10 pb-2"></th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Rechercher</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Remplacer par</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Occurrences</th>
										<th class="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Statut</th>
										<th class="pb-2"></th>
									</tr>
								</thead>
								<tbody>
									{#each filteredRules() as rule}
										<tr
											class="group border-b border-border last:border-0 transition-colors hover:bg-accent/50"
											style="border-left: 3px solid {rule.isActive ? '#10B981' : '#E2E3E6'};"
											draggable="true"
											ondragstart={() => { draggedRuleId = rule.id; }}
											ondragend={() => { draggedRuleId = null; }}
										>
											<!-- Drag handle + type icon -->
											<td class="py-3 pr-1">
												<div class="flex items-center gap-1">
													<div class="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
														<GripVertical class="h-4 w-4 text-muted" />
													</div>
													{#if rule.isRegex}
														<div class="flex h-[22px] w-[22px] items-center justify-center rounded bg-purple-50 dark:bg-purple-950/30" style="opacity: {rule.isActive ? 1 : 0.5}">
															<Regex class="h-3 w-3 text-purple-600 dark:text-purple-400" />
														</div>
													{:else}
														<div class="flex h-[22px] w-[22px] items-center justify-center rounded bg-blue-50 dark:bg-blue-950/30" style="opacity: {rule.isActive ? 1 : 0.5}">
															<Type class="h-3 w-3 text-blue-600 dark:text-blue-400" />
														</div>
													{/if}
												</div>
											</td>
											<td class="py-3 pr-4" style="opacity: {rule.isActive ? 1 : 0.5}">
												<code class="rounded bg-input px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">{rule.searchTerm}</code>
											</td>
											<td class="py-3 pr-4" style="opacity: {rule.isActive ? 1 : 0.5}">
												<code class="rounded bg-accent px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{rule.replaceTerm}</code>
											</td>
											<td class="py-3 pr-4" style="opacity: {rule.isActive ? 1 : 0.5}">
												<span class="inline-flex items-center gap-1 font-mono text-xs font-semibold text-muted-foreground">
													<Eye class="h-3 w-3 text-muted" />
													{getRuleOccurrences(rule)}
												</span>
											</td>
											<!-- Mini CSS toggle switch -->
											<td class="py-3 pr-4">
												<button
													class="relative inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {rule.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}"
													onclick={() => toggleActive(rule)}
													title={rule.isActive ? 'Désactiver' : 'Activer'}
													role="switch"
													aria-checked={!!rule.isActive}
												>
													<span
														class="pointer-events-none block h-[14px] w-[14px] rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out {rule.isActive ? 'translate-x-[16px]' : 'translate-x-[2px]'}"
													></span>
												</button>
											</td>
											<td class="py-3 text-right">
												<div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													<button
														class="rounded-md p-1.5 text-muted transition-colors hover:bg-accent hover:text-foreground"
														onclick={() => openEditDialog(rule)}
														title="Modifier"
													>
														<Pencil class="h-3.5 w-3.5" />
													</button>
													<button
														class="rounded-md p-1.5 text-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
														onclick={() => openDeleteDialog(rule)}
														title="Supprimer"
													>
														<Trash2 class="h-3.5 w-3.5" />
													</button>
												</div>
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="6" class="py-8 text-center text-sm text-muted-foreground">
												<EyeOff class="mx-auto mb-2 h-8 w-8 text-muted" />
												Aucune règle {activeTab === 'auto' ? 'automatique' : 'manuelle'} pour ce projet.
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Inline add form -->
						{#if showAddForm}
							<div class="mt-4 rounded-lg border border-primary/30 bg-accent/50 p-4">
								<div class="flex items-end gap-3">
									<div class="space-y-1">
										<label class="text-xs font-medium text-foreground">Type</label>
										<SearchableSelect
											value={addIsRegex ? 'true' : 'false'}
											options={[
												{ value: 'false', label: 'Texte exact' },
												{ value: 'true', label: 'Regex' },
											]}
											placeholder="Type"
											onchange={(val) => { addIsRegex = val === 'true'; }}
										/>
									</div>
									<div class="flex-1 space-y-1">
										<label class="text-xs font-medium text-foreground">Texte à masquer</label>
										<Input bind:value={addSearchTerm} placeholder="Texte à masquer..." class="text-sm" />
									</div>
									<div class="flex-1 space-y-1">
										<label class="text-xs font-medium text-foreground">Remplacer par</label>
										<Input bind:value={addReplaceTerm} placeholder="Auto-généré si vide" class="text-sm" />
									</div>
									<div class="flex gap-2">
										<Button size="sm" onclick={handleAdd} disabled={addSubmitting}>
											{#if addSubmitting}
												...
											{:else}
												<Check class="h-3.5 w-3.5" />
											{/if}
											Ajouter
										</Button>
										<Button variant="outline" size="sm" onclick={() => { showAddForm = false; addError = ''; }}>
											<X class="h-3.5 w-3.5" />
											Annuler
										</Button>
									</div>
								</div>
								{#if addError}
									<p class="mt-2 flex items-center gap-1 text-xs text-destructive">
										<AlertCircle class="h-3 w-3" />
										{addError}
									</p>
								{/if}
							</div>
						{/if}
					{/if}
				</CardContent>
			</Card>

			<!-- Masquage dans l'éditeur section (purple themed) -->
			<Card class="border-purple-200 dark:border-purple-800/50">
				<CardContent class="p-5">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
								<Eye class="h-5 w-5 text-purple-600 dark:text-purple-400" />
							</div>
							<div>
								<h3 class="text-sm font-semibold text-foreground">Obfuscation manuelle</h3>
								<p class="text-xs text-muted-foreground">
									Sélectionnez des éléments directement sur la page de démo pour les obfusquer. Cliquez sur un texte, une image ou un bloc pour appliquer un masque personnalisé.
								</p>
							</div>
						</div>
						<Button
							variant="outline"
							size="sm"
							class="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/20"
						>
							<Eye class="h-3.5 w-3.5" />
							Ouvrir l'éditeur visuel
						</Button>
					</div>
					<div class="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
						<span class="inline-flex items-center gap-1">
							<ShieldCheck class="h-3 w-3 text-purple-500" />
							Sélection visuelle des zones à masquer
						</span>
						<span class="inline-flex items-center gap-1">
							<ShieldCheck class="h-3 w-3 text-purple-500" />
							Aperçu en temps réel
						</span>
						<span class="inline-flex items-center gap-1">
							<ShieldCheck class="h-3 w-3 text-purple-500" />
							Compatible avec les règles auto
						</span>
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- RIGHT COLUMN: Persistent preview panel -->
		<div class="space-y-0">
			<div class="sticky top-20">
				<div class="overflow-hidden rounded-lg border border-border bg-card">
					<!-- Header -->
					<div class="flex items-center justify-between border-b border-border px-5 py-3.5">
						<span class="text-sm font-semibold text-foreground">Aperçu en direct</span>
						<!-- Before/After toggle - dark active state like mockup -->
						<div class="flex items-center rounded-full border border-border bg-accent p-0.5">
							<button
								class="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition-all {previewMode === 'before' ? 'bg-foreground text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
								onclick={() => { previewMode = 'before'; }}
							>
								<Eye class="h-3 w-3" />
								Avant
							</button>
							<button
								class="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition-all {previewMode === 'after' ? 'bg-foreground text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
								onclick={() => { previewMode = 'after'; }}
							>
								<EyeOff class="h-3 w-3" />
								Après
							</button>
						</div>
					</div>

					<!-- Preview area -->
					<div class="space-y-4 p-5">
						<!-- Mini preview area -->
						<div class="space-y-2">
							<label class="text-xs font-medium text-muted-foreground">HTML source</label>
							<textarea
								bind:value={previewInput}
								placeholder="Collez du HTML ici pour tester les règles..."
								rows="5"
								class="flex w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-xs shadow-xs transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							></textarea>
						</div>

						<Button
							size="sm"
							class="w-full gap-1.5"
							onclick={handlePreview}
							disabled={previewLoading || !previewInput.trim() || !$selectedProjectId}
						>
							<Eye class="h-3.5 w-3.5" />
							{previewLoading ? 'Application...' : 'Appliquer les règles'}
						</Button>

						<!-- Preview result -->
						{#if previewObfuscated || previewInput}
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<label class="text-xs font-medium text-muted-foreground">
										{previewMode === 'before' ? 'Original' : 'Résultat'}
									</label>
									{#if previewChangesCount > 0 && previewMode === 'after'}
										<span class="text-[10px] font-medium text-success">{previewChangesCount} modification{previewChangesCount !== 1 ? 's' : ''}</span>
									{/if}
								</div>
								<div class="max-h-48 overflow-y-auto rounded-md border border-border bg-accent/50 p-3 font-mono text-xs leading-relaxed">
									{#if previewMode === 'before'}
										<pre class="whitespace-pre-wrap break-all text-foreground">{previewOriginal || previewInput}</pre>
									{:else if previewObfuscated}
										<pre class="whitespace-pre-wrap break-all text-foreground">{previewObfuscated}</pre>
									{:else}
										<p class="text-muted-foreground italic">Cliquez sur "Appliquer les règles" pour voir le résultat</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>

					<!-- Coverage bar -->
					<div class="border-t border-border px-5 py-3.5">
						<div class="flex items-center justify-between mb-2">
							<span class="text-xs font-medium text-muted-foreground">Couverture d'obfuscation</span>
							<span class="text-xs font-bold text-primary">{previewStats().coverage}%</span>
						</div>
						<div class="h-1.5 overflow-hidden rounded-full bg-border">
							<div
								class="h-full rounded-full transition-all duration-1000 ease-out"
								style="width: {previewStats().coverage}%; background: linear-gradient(90deg, #2B72EE, #4E89F1);"
							></div>
						</div>
					</div>

					<!-- Stats footer - matching mockup layout -->
					<div class="flex border-t border-border">
						<div class="flex-1 border-r border-border px-4 py-3.5 text-center">
							<p class="text-lg font-bold tabular-nums text-foreground">{animatedRulesCount}</p>
							<p class="text-[11px] text-muted-foreground">règles actives</p>
						</div>
						<div class="flex-1 border-r border-border px-4 py-3.5 text-center">
							<p class="text-lg font-bold tabular-nums text-foreground">{animatedOccurrences}</p>
							<p class="text-[11px] text-muted-foreground">occurrences trouvées</p>
						</div>
						<div class="flex-1 px-4 py-3.5 text-center">
							<p class="text-lg font-bold tabular-nums text-foreground">{animatedPages}</p>
							<p class="text-[11px] text-muted-foreground">pages affectées</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Edit Dialog -->
<Dialog bind:open={editDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Modifier la règle</DialogTitle>
			<DialogDescription>Modifiez les paramètres de la règle d'obfuscation.</DialogDescription>
		</DialogHeader>
		<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleEdit(); }}>
			<div class="space-y-2">
				<label for="edit-search" class="text-sm font-medium text-foreground">Rechercher</label>
				<Input id="edit-search" bind:value={editSearchTerm} placeholder="Texte à rechercher..." />
			</div>
			<div class="space-y-2">
				<label for="edit-replace" class="text-sm font-medium text-foreground">Remplacer par</label>
				<Input id="edit-replace" bind:value={editReplaceTerm} placeholder="Texte de remplacement..." />
			</div>
			<div class="flex items-center gap-3">
				<label class="text-sm font-medium text-foreground">Type :</label>
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={editIsRegex} class="rounded" />
					Expression régulière (Regex)
				</label>
			</div>
			{#if editError}
				<p class="text-sm text-destructive">{editError}</p>
			{/if}
			<DialogFooter>
				<Button variant="outline" type="button" onclick={() => { editDialogOpen = false; }}>Annuler</Button>
				<Button type="submit" disabled={editSubmitting}>
					{editSubmitting ? 'Enregistrement...' : 'Enregistrer'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>

<!-- Delete Dialog -->
<Dialog bind:open={deleteDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Supprimer la règle</DialogTitle>
			<DialogDescription>
				Êtes-vous sûr de vouloir supprimer la règle &laquo; <strong>{deletingRule?.searchTerm}</strong> &raquo; ? Cette action est irréversible.
			</DialogDescription>
		</DialogHeader>
		<DialogFooter>
			<Button variant="outline" onclick={() => { deleteDialogOpen = false; }}>Annuler</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={deleteSubmitting}>
				{deleteSubmitting ? 'Suppression...' : 'Supprimer'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
