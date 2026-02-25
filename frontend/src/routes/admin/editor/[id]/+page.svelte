<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get, patch, put } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { Card, CardContent } from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import { Input } from '$components/ui/input';
	import { Tabs, TabsList, TabsTrigger } from '$components/ui/tabs';
	import { Separator } from '$components/ui/separator';
	import {
		FileText,
		Search,
		Save,
		Eye,
		ExternalLink,
		Link2,
		Code,
		Globe,
		ArrowLeft,
		CheckCircle2,
		AlertCircle,
		ChevronRight,
		Loader2,
	} from 'lucide-svelte';

	// Types
	interface PageData {
		id: string;
		versionId: string;
		urlSource: string;
		urlPath: string;
		title: string;
		filePath: string;
		fileSize: number | null;
		captureMode: 'free' | 'guided' | 'auto';
		thumbnailPath: string | null;
		healthStatus: 'ok' | 'warning' | 'error';
		createdAt: string;
	}

	interface Project {
		id: string;
		name: string;
		toolName: string;
		subdomain: string;
		versions: Array<{
			id: string;
			name: string;
			status: string;
		}>;
	}

	// State
	let pageId = $derived($page.params.id);
	let currentPage: PageData | null = $state(null);
	let htmlContent = $state('');
	let originalContent = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let saved = $state(false);
	let activeEditorTab = $state('html');

	// Page list for sidebar
	let projects: Project[] = $state([]);
	let selectedProjectId = $state('');
	let selectedVersionId = $state('');
	let pages: PageData[] = $state([]);
	let pagesLoading = $state(false);
	let pageSearchQuery = $state('');

	// Links detection from HTML content
	let detectedLinks = $derived(() => {
		if (!htmlContent) return [];
		const linkRegex = /href=["']([^"']*?)["']/gi;
		const links: Array<{ url: string; type: 'internal' | 'external' }> = [];
		let match;
		const seen = new Set<string>();
		while ((match = linkRegex.exec(htmlContent)) !== null) {
			const url = match[1];
			if (!seen.has(url) && !url.startsWith('#') && !url.startsWith('javascript:') && !url.startsWith('mailto:')) {
				seen.add(url);
				const isInternal = url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || (!url.startsWith('http') && !url.startsWith('//'));
				links.push({ url, type: isInternal ? 'internal' : 'external' });
			}
		}
		return links;
	});

	let internalLinks = $derived(detectedLinks().filter((l) => l.type === 'internal'));
	let externalLinks = $derived(detectedLinks().filter((l) => l.type === 'external'));

	let isDirty = $derived(htmlContent !== originalContent);

	let filteredPages = $derived(
		pages.filter((p) => {
			const q = pageSearchQuery.toLowerCase();
			if (!q) return true;
			return p.title.toLowerCase().includes(q) || p.urlPath.toLowerCase().includes(q);
		})
	);

	// Helpers
	function getHealthDot(status: string): string {
		switch (status) {
			case 'ok': return 'bg-success';
			case 'warning': return 'bg-warning';
			case 'error': return 'bg-destructive';
			default: return 'bg-muted';
		}
	}

	function formatFileSize(bytes: number | null): string {
		if (!bytes) return '—';
		if (bytes < 1024) return `${bytes} o`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	// Line count for gutter
	let lineCount = $derived(htmlContent.split('\n').length);

	// Save content
	async function saveContent() {
		if (!currentPage || !isDirty) return;
		saving = true;
		saved = false;

		try {
			await patch(`/pages/${currentPage.id}/content`, { html: htmlContent });
			originalContent = htmlContent;
			saved = true;
			setTimeout(() => { saved = false; }, 3000);
			toast.success('Contenu sauvegardé');
		} catch (err) {
			toast.error('Erreur lors de la sauvegarde');
		} finally {
			saving = false;
		}
	}

	// Load page HTML content
	async function loadPageContent(id: string) {
		try {
			// Fetch page metadata
			const pageRes = await get<{ data: PageData }>(`/pages/${id}`);
			currentPage = pageRes.data;

			// Fetch HTML content
			const contentRes = await get<{ data: { html: string } }>(`/pages/${id}/content`);
			htmlContent = contentRes.data?.html ?? '';
			originalContent = htmlContent;
		} catch (err) {
			console.error('Load page content error:', err);
			htmlContent = '<!-- Erreur de chargement -->';
			originalContent = htmlContent;
		}
	}

	// Load page list for sidebar
	async function loadPages(versionId: string) {
		if (!versionId) return;
		pagesLoading = true;
		try {
			const res = await get<{ data: PageData[] }>(`/versions/${versionId}/pages`);
			pages = res.data;
		} catch (err) {
			console.error('Load pages error:', err);
			pages = [];
		} finally {
			pagesLoading = false;
		}
	}

	// Keyboard shortcut: Ctrl+S to save
	function handleKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			saveContent();
		}
	}

	// Navigate to another page
	function navigateToPage(page: PageData) {
		window.location.href = `/admin/editor/${page.id}`;
	}

	onMount(async () => {
		window.addEventListener('keydown', handleKeyDown);

		try {
			// Load page content first
			await loadPageContent(pageId);

			// Load projects list for sidebar
			const projectsRes = await get<{ data: Array<{ id: string; name: string; toolName: string; subdomain: string }> }>('/projects');
			const detailed = await Promise.all(
				projectsRes.data.map((p) =>
					get<{ data: Project }>(`/projects/${p.id}`).then((r) => r.data)
				)
			);
			projects = detailed;

			// Find the project/version for current page
			if (currentPage) {
				for (const p of projects) {
					const v = p.versions?.find((v) => v.id === currentPage!.versionId);
					if (v) {
						selectedProjectId = p.id;
						selectedVersionId = v.id;
						break;
					}
				}
				if (selectedVersionId) {
					await loadPages(selectedVersionId);
				}
			}
		} catch (err) {
			console.error('Editor init error:', err);
		} finally {
			loading = false;
		}

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	// React to version changes
	$effect(() => {
		if (selectedVersionId) {
			loadPages(selectedVersionId);
		}
	});
</script>

<svelte:head>
	<title>{currentPage?.title ?? 'Éditeur'} — Environnements Simulés</title>
</svelte:head>

<div class="flex h-[calc(100vh-56px)] overflow-hidden -m-6">
	<!-- Page list sidebar (left) -->
	<div class="flex w-64 shrink-0 flex-col border-r border-border bg-card">
		<!-- Sidebar header -->
		<div class="space-y-2 border-b border-border p-3">
			<a
				href="/admin/tree"
				class="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft class="h-3 w-3" />
				Retour à l'arborescence
			</a>

			<!-- Project selector -->
			<select
				bind:value={selectedProjectId}
				onchange={() => {
					const proj = projects.find((p) => p.id === selectedProjectId);
					if (proj && proj.versions.length > 0) {
						const active = proj.versions.find((v) => v.status === 'active');
						selectedVersionId = active?.id ?? proj.versions[0].id;
					}
				}}
				class="flex h-8 w-full rounded-md border border-border bg-transparent px-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{#each projects as project}
					<option value={project.id}>{project.toolName}</option>
				{/each}
			</select>

			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
				<Input
					bind:value={pageSearchQuery}
					placeholder="Filtrer les pages..."
					class="h-8 pl-8 text-xs"
				/>
			</div>
		</div>

		<!-- Page list -->
		<div class="flex-1 overflow-y-auto px-1 py-2">
			{#if pagesLoading}
				<div class="space-y-1 px-2">
					{#each Array(6) as _}
						<div class="flex items-center gap-2 py-1.5">
							<div class="skeleton h-2 w-2 rounded-full"></div>
							<div class="skeleton h-3 w-32 rounded"></div>
						</div>
					{/each}
				</div>
			{:else if filteredPages.length === 0}
				<p class="px-3 py-6 text-center text-xs text-muted-foreground">Aucune page trouvée.</p>
			{:else}
				{#each filteredPages as pg}
					<button
						class="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent {currentPage?.id === pg.id ? 'bg-accent text-primary' : ''}"
						onclick={() => navigateToPage(pg)}
					>
						<span class="h-1.5 w-1.5 shrink-0 rounded-full {getHealthDot(pg.healthStatus)}"></span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs {currentPage?.id === pg.id ? 'font-medium text-primary' : 'text-foreground'}">
								{pg.title}
							</p>
							<p class="truncate text-[10px] text-muted-foreground">{formatDate(pg.createdAt)}</p>
						</div>
					</button>
				{/each}
			{/if}
		</div>

		<!-- Footer -->
		<div class="border-t border-border px-3 py-2">
			<span class="text-xs text-muted-foreground">{pages.length} page{pages.length !== 1 ? 's' : ''}</span>
		</div>
	</div>

	<!-- Main editor area -->
	<div class="flex min-w-0 flex-1 flex-col">
		{#if loading}
			<div class="flex flex-1 items-center justify-center">
				<Loader2 class="h-6 w-6 animate-spin text-primary" />
			</div>
		{:else if !currentPage}
			<div class="flex flex-1 flex-col items-center justify-center text-center">
				<FileText class="h-12 w-12 text-muted" />
				<p class="mt-3 text-sm text-muted-foreground">Page introuvable</p>
				<a href="/admin/tree" class="mt-2 text-sm text-primary hover:underline">Retour à l'arborescence</a>
			</div>
		{:else}
			<!-- Editor toolbar -->
			<div class="flex items-center justify-between border-b border-border bg-card px-4 py-2">
				<div class="flex items-center gap-3">
					<h2 class="text-sm font-semibold text-foreground">{currentPage.title}</h2>
					<span class="text-xs text-muted-foreground">/{currentPage.urlPath}</span>
					{#if isDirty}
						<Badge variant="warning" class="text-[10px]">Modifié</Badge>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					{#if saved}
						<span class="inline-flex items-center gap-1 text-xs font-medium text-success">
							<CheckCircle2 class="h-3.5 w-3.5" />
							Enregistré
						</span>
					{/if}
					<Button variant="outline" size="sm" class="gap-1.5" onclick={() => {
						window.open(`/demo/${projects.find(p => p.id === selectedProjectId)?.subdomain ?? ''}/${currentPage!.urlPath}`, '_blank');
					}}>
						<Eye class="h-3.5 w-3.5" />
						Aperçu
					</Button>
					<Button size="sm" class="gap-1.5" onclick={saveContent} disabled={!isDirty || saving}>
						{#if saving}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
							Enregistrement...
						{:else}
							<Save class="h-3.5 w-3.5" />
							Enregistrer
						{/if}
					</Button>
				</div>
			</div>

			<!-- Editor tabs -->
			<div class="border-b border-border bg-card px-4">
				<Tabs value={activeEditorTab} onValueChange={(v) => { activeEditorTab = v; }}>
					<TabsList>
						<TabsTrigger value="html" class="gap-1.5 text-xs">
							<Code class="h-3 w-3" />
							Éditeur HTML
						</TabsTrigger>
						<TabsTrigger value="links" class="gap-1.5 text-xs">
							<Link2 class="h-3 w-3" />
							Liens & Navigation
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			<!-- Editor content area -->
			{#if activeEditorTab === 'html'}
				<div class="flex flex-1 overflow-hidden">
					<!-- Code editor -->
					<div class="flex flex-1 overflow-hidden bg-[#1e1e1e]">
						<!-- Line numbers gutter -->
						<div class="shrink-0 select-none overflow-hidden border-r border-[#333] bg-[#1e1e1e] py-3 text-right">
							{#each Array(lineCount) as _, i}
								<div class="px-3 font-mono text-xs leading-5 text-[#858585]">{i + 1}</div>
							{/each}
						</div>
						<!-- Text editor area -->
						<textarea
							bind:value={htmlContent}
							class="flex-1 resize-none bg-[#1e1e1e] p-3 font-mono text-xs leading-5 text-[#d4d4d4] outline-none"
							spellcheck="false"
							wrap="off"
						></textarea>
					</div>
				</div>
			{:else if activeEditorTab === 'links'}
				<div class="flex-1 overflow-y-auto p-6">
					<!-- Link summary -->
					<div class="mb-6 grid gap-4 sm:grid-cols-3">
						<Card>
							<CardContent class="p-4">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total de liens</p>
										<p class="mt-1 text-2xl font-bold text-foreground">{detectedLinks().length}</p>
									</div>
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
										<Link2 class="h-5 w-5 text-primary" />
									</div>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent class="p-4">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Liens internes</p>
										<p class="mt-1 text-2xl font-bold text-foreground">{internalLinks.length}</p>
									</div>
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
										<Globe class="h-5 w-5 text-success" />
									</div>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent class="p-4">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Liens externes</p>
										<p class="mt-1 text-2xl font-bold text-foreground">{externalLinks.length}</p>
									</div>
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
										<ExternalLink class="h-5 w-5 text-warning" />
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					<!-- Links list -->
					{#if detectedLinks().length === 0}
						<div class="flex flex-col items-center justify-center py-16">
							<Link2 class="h-10 w-10 text-muted" />
							<p class="mt-3 text-sm font-medium text-foreground">Aucun lien détecté</p>
							<p class="mt-1 text-sm text-muted-foreground">Le contenu HTML ne contient pas de liens.</p>
						</div>
					{:else}
						<Card>
							<CardContent class="p-0">
								<table class="w-full">
									<thead>
										<tr class="border-b border-border">
											<th class="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">URL</th>
											<th class="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Type</th>
											<th class="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted">Statut</th>
										</tr>
									</thead>
									<tbody>
										{#each detectedLinks() as link}
											{@const isMapped = pages.some((p) => `/${p.urlPath}` === link.url || p.urlPath === link.url.replace(/^\//, ''))}
											<tr class="border-b border-border last:border-0">
												<td class="px-4 py-2.5">
													<span class="font-mono text-xs text-foreground">{link.url}</span>
												</td>
												<td class="px-4 py-2.5">
													<Badge variant={link.type === 'internal' ? 'success' : 'warning'} class="text-[10px]">
														{link.type === 'internal' ? 'Interne' : 'Externe'}
													</Badge>
												</td>
												<td class="px-4 py-2.5">
													{#if link.type === 'internal'}
														{#if isMapped}
															<span class="inline-flex items-center gap-1 text-xs text-success">
																<CheckCircle2 class="h-3 w-3" />
																Mappé
															</span>
														{:else}
															<span class="inline-flex items-center gap-1 text-xs text-warning">
																<AlertCircle class="h-3 w-3" />
																Non mappé
															</span>
														{/if}
													{:else}
														<span class="text-xs text-muted-foreground">—</span>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</CardContent>
						</Card>
					{/if}

					<!-- Link map (simple visual) -->
					{#if internalLinks.length > 0}
						<div class="mt-6">
							<h3 class="mb-3 text-sm font-semibold text-foreground">Carte des liens</h3>
							<Card>
								<CardContent class="p-6">
									<div class="flex flex-wrap items-center justify-center gap-4">
										<!-- Central page -->
										<div class="flex flex-col items-center">
											<div class="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-primary bg-primary/10">
												<FileText class="h-6 w-6 text-primary" />
											</div>
											<span class="mt-1.5 max-w-20 truncate text-[10px] font-medium text-foreground">
												{currentPage.title}
											</span>
										</div>

										<!-- Arrows -->
										<div class="flex flex-col gap-1">
											{#each internalLinks.slice(0, 6) as link}
												<div class="flex items-center gap-2">
													<div class="h-px w-8 bg-border"></div>
													<ChevronRight class="h-3 w-3 text-muted" />
													<div class="rounded-md border border-border bg-card px-2 py-1">
														<span class="font-mono text-[10px] text-muted-foreground">{link.url}</span>
													</div>
												</div>
											{/each}
											{#if internalLinks.length > 6}
												<span class="ml-12 text-[10px] text-muted-foreground">+{internalLinks.length - 6} de plus</span>
											{/if}
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>
