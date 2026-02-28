<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get, patch } from '$lib/api';
	import { toast } from '$lib/stores/toast';
	import { selectedProject } from '$lib/stores/project';
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
		Braces,
		ArrowLeft,
		CheckCircle2,
		AlertCircle,
		ChevronRight,
		ChevronDown,
		Loader2,
		AlignLeft,
		Undo2,
		Redo2,
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

	// State
	let pageId = $derived($page.params.id);
	let currentPage: PageData | null = $state(null);
	let htmlContent = $state('');
	let originalContent = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let saved = $state(false);
	let activeEditorTab = $state('html');

	// Pages for link mapping
	let pages: PageData[] = $state([]);

	// Link groups collapsed state
	let collapsedGroups = $state<Record<string, boolean>>({});

	// Links detection from HTML content
	let detectedLinks = $derived(() => {
		if (!htmlContent) return [];
		const linkRegex = /href=["']([^"']*?)["']/gi;
		const links: Array<{ url: string; type: 'internal' | 'external'; anchorText: string }> = [];
		let match;
		const seen = new Set<string>();
		while ((match = linkRegex.exec(htmlContent)) !== null) {
			const url = match[1];
			if (!seen.has(url) && !url.startsWith('#') && !url.startsWith('javascript:') && !url.startsWith('mailto:')) {
				seen.add(url);
				const isInternal = url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || (!url.startsWith('http') && !url.startsWith('//'));
				// Try to extract anchor text from the full match context
				const anchorRegex = new RegExp(`href=["']${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([^<]*)`, 'i');
				const anchorMatch = anchorRegex.exec(htmlContent);
				const anchorText = anchorMatch?.[1]?.trim() || url;
				links.push({ url, type: isInternal ? 'internal' : 'external', anchorText });
			}
		}
		return links;
	});

	let internalLinks = $derived(detectedLinks().filter((l) => l.type === 'internal'));
	let externalLinks = $derived(detectedLinks().filter((l) => l.type === 'external'));

	// Group links by category for tree view
	let linkGroups = $derived(() => {
		const links = detectedLinks();
		const groups: Array<{ name: string; key: string; links: typeof links }> = [];

		const navLinks = links.filter(l => l.type === 'internal' && (l.url.includes('home') || l.url.includes('dashboard') || l.url === '/'));
		const contentLinks = links.filter(l => l.type === 'internal' && !navLinks.includes(l));
		const extLinks = links.filter(l => l.type === 'external');

		if (navLinks.length > 0) groups.push({ name: 'Navigation principale', key: 'nav', links: navLinks });
		if (contentLinks.length > 0) groups.push({ name: 'Contenu & Pages', key: 'content', links: contentLinks });
		if (extLinks.length > 0) groups.push({ name: 'Liens externes', key: 'external', links: extLinks });

		return groups;
	});

	// JavaScript detection from HTML content
	let detectedScripts = $derived(() => {
		if (!htmlContent) return [];
		const scriptRegex = /<script[^>]*(?:src=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/script>/gi;
		const scripts: Array<{ src: string | null; inline: boolean; snippet: string; enabled: boolean }> = [];
		let match;
		while ((match = scriptRegex.exec(htmlContent)) !== null) {
			const src = match[1] || null;
			const body = match[2]?.trim() || '';
			scripts.push({
				src,
				inline: !src && body.length > 0,
				snippet: src ? src : body.slice(0, 120) + (body.length > 120 ? '...' : ''),
				enabled: true,
			});
		}
		return scripts;
	});

	let isDirty = $derived(htmlContent !== originalContent);
	let editorSearchQuery = $state('');

	// Helpers
	function formatFileSize(bytes: number | null): string {
		if (!bytes) return '—';
		if (bytes < 1024) return `${bytes} o`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
	}

	// Line count for gutter
	let lineCount = $derived(htmlContent.split('\n').length);

	// Cursor position tracking
	let cursorLine = $state(1);
	let cursorCol = $state(1);
	let textareaEl: HTMLTextAreaElement | undefined = $state();

	function updateCursorPosition() {
		if (!textareaEl) return;
		const pos = textareaEl.selectionStart;
		const text = textareaEl.value.substring(0, pos);
		const lines = text.split('\n');
		cursorLine = lines.length;
		cursorCol = lines[lines.length - 1].length + 1;
	}

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
		if (!id) {
			currentPage = null;
			return;
		}
		try {
			const pageRes = await get<{ data: PageData }>(`/pages/${id}`);
			currentPage = pageRes.data;

			const contentRes = await get<{ data: { html: string } }>(`/pages/${id}/content`);
			htmlContent = contentRes.data?.html ?? '';
			originalContent = htmlContent;
		} catch (err) {
			console.error('Load page content error:', err);
			currentPage = null;
			htmlContent = '';
			originalContent = '';
		}
	}

	// Load pages for link mapping
	async function loadPages(versionId: string) {
		if (!versionId) return;
		try {
			const res = await get<{ data: PageData[] }>(`/versions/${versionId}/pages`);
			pages = res.data;
		} catch {
			pages = [];
		}
	}

	// Keyboard shortcut: Ctrl+S to save
	function handleKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			saveContent();
		}
	}

	function toggleGroup(key: string) {
		collapsedGroups = { ...collapsedGroups, [key]: !collapsedGroups[key] };
	}

	function isLinkMapped(url: string): boolean {
		return pages.some((p) => `/${p.urlPath}` === url || p.urlPath === url.replace(/^\//, ''));
	}

	function getMappedPage(url: string): PageData | undefined {
		return pages.find((p) => `/${p.urlPath}` === url || p.urlPath === url.replace(/^\//, ''));
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);

		(async () => {
			try {
				await loadPageContent(pageId ?? '');
				if (currentPage?.versionId) {
					await loadPages(currentPage.versionId);
				}
			} catch (err) {
				console.error('Editor init error:', err);
			} finally {
				loading = false;
			}
		})();

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<svelte:head>
	<title>{currentPage?.title ?? 'Éditeur'} — Lemon Lab</title>
</svelte:head>

<div class="flex h-[calc(100vh-56px)] overflow-hidden -m-6">
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
				<div class="flex items-center gap-3 min-w-0">
					<a href="/admin/editor" class="shrink-0 text-xs text-primary hover:underline flex items-center gap-1">
						<ArrowLeft class="h-3 w-3" />
						Pages
					</a>
					{#if $selectedProject}
						<span class="text-muted shrink-0">/</span>
						<span class="text-xs text-muted-foreground shrink-0">{$selectedProject.toolName}</span>
					{/if}
					<span class="text-muted shrink-0">/</span>
					<h2 class="text-sm font-semibold text-foreground truncate">{currentPage.title}</h2>
					<span class="text-xs text-muted-foreground shrink-0">/{currentPage.urlPath}</span>
					{#if isDirty}
						<Badge variant="warning" class="text-[10px] shrink-0">Modifié</Badge>
					{/if}
				</div>
				<div class="flex items-center gap-2 shrink-0">
					{#if saved}
						<span class="inline-flex items-center gap-1 text-xs font-medium text-success">
							<CheckCircle2 class="h-3.5 w-3.5" />
							Enregistré
						</span>
					{/if}

					<div class="relative">
						<Search class="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
						<input
							type="text"
							bind:value={editorSearchQuery}
							placeholder="Recherche..."
							class="h-7 w-32 rounded-md border border-border bg-transparent pl-7 pr-2 text-xs text-foreground outline-none transition-colors placeholder:text-muted focus:w-44 focus:border-primary focus:ring-1 focus:ring-primary/20"
						/>
					</div>

					<Separator orientation="vertical" class="h-5" />

					<Button variant="outline" size="sm" class="gap-1.5 text-xs" onclick={() => {
						window.open(`/admin/live-edit/${currentPage!.id}`, '_blank');
					}}>
						<Eye class="h-3.5 w-3.5" />
						Aperçu
					</Button>
					<Button size="sm" class="gap-1.5 text-xs" onclick={saveContent} disabled={!isDirty || saving}>
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
			<div class="flex items-center border-b border-border bg-card px-4">
				<Tabs value={activeEditorTab} onValueChange={(v) => { activeEditorTab = v; }}>
					<TabsList>
						<TabsTrigger value="html" class="gap-1.5 text-xs">
							<Code class="h-3 w-3" />
							Éditeur HTML
						</TabsTrigger>
						<TabsTrigger value="links" class="gap-1.5 text-xs">
							<Link2 class="h-3 w-3" />
							Liens & Navigation
							{#if detectedLinks().length > 0}
								<span class="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-semibold text-muted-foreground">{detectedLinks().length}</span>
							{/if}
						</TabsTrigger>
						<TabsTrigger value="javascript" class="gap-1.5 text-xs">
							<Braces class="h-3 w-3" />
							JavaScript
							{#if detectedScripts().length > 0}
								<span class="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-semibold text-muted-foreground">{detectedScripts().length}</span>
							{/if}
						</TabsTrigger>
					</TabsList>
				</Tabs>
				<div class="flex-1"></div>
				<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<FileText class="h-3.5 w-3.5" />
					<span>{currentPage.title}</span>
				</div>
			</div>

			<!-- Editor content area -->
			{#if activeEditorTab === 'html'}
				<!-- HTML Toolbar -->
				<div class="flex items-center gap-1.5 border-b border-border bg-card px-4 py-1.5">
					<button
						class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						onclick={() => { toast.success('Code formaté'); }}
					>
						<AlignLeft class="h-3 w-3" />
						Formater
					</button>
					<button
						class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						onclick={() => { document.execCommand('undo'); }}
					>
						<Undo2 class="h-3 w-3" />
						Annuler
					</button>
					<button
						class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						onclick={() => { document.execCommand('redo'); }}
					>
						<Redo2 class="h-3 w-3" />
						Rétablir
					</button>
					<div class="mx-1 h-5 w-px bg-border"></div>
					<button
						class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<Search class="h-3 w-3" />
						Rechercher
					</button>
				</div>

				<!-- Code editor -->
				<div class="flex flex-1 overflow-hidden">
					<div class="flex flex-1 overflow-hidden bg-[#1e1e1e]">
						<div class="shrink-0 select-none overflow-hidden border-r border-[#333] bg-[#1e1e1e] py-3 text-right">
							{#each Array(lineCount) as _, i}
								<div class="px-3 font-mono text-xs leading-5 text-[#858585] {cursorLine === i + 1 ? '!text-[#c6c6c6] bg-white/[0.04]' : ''}">{i + 1}</div>
							{/each}
						</div>
						<textarea
							bind:this={textareaEl}
							bind:value={htmlContent}
							onclick={updateCursorPosition}
							onkeyup={updateCursorPosition}
							class="flex-1 resize-none bg-[#1e1e1e] p-3 font-mono text-xs leading-5 text-[#d4d4d4] outline-none"
							spellcheck="false"
							wrap="off"
						></textarea>
					</div>
				</div>

				<!-- Editor bottom bar -->
				<div class="flex items-center justify-between border-t border-border bg-card px-5 py-2">
					<div class="flex items-center gap-3 text-xs text-muted-foreground">
						<span>Ligne {cursorLine}, Col {cursorCol}</span>
						<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground/70">HTML</span>
						<span>UTF-8</span>
						<span>{formatFileSize(currentPage.fileSize)}</span>
					</div>
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" class="gap-1.5 text-xs" onclick={async () => {
							await saveContent();
							window.open(`/admin/live-edit/${currentPage!.id}`, '_blank');
						}} disabled={!isDirty || saving}>
							<Eye class="h-3.5 w-3.5" />
							Enregistrer et prévisualiser
						</Button>
						<Button size="sm" class="gap-1.5 text-xs" onclick={saveContent} disabled={!isDirty || saving}>
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
			{:else if activeEditorTab === 'links'}
				<div class="flex flex-1 overflow-hidden">
					<!-- Links main content -->
					<div class="flex-1 overflow-y-auto p-5">
						<!-- Source header -->
						<div class="mb-4 flex items-center gap-3">
							<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
								<FileText class="h-4.5 w-4.5 text-primary" />
							</div>
							<div>
								<p class="text-sm font-semibold text-foreground">{currentPage.title}</p>
								<p class="font-mono text-[11px] text-muted-foreground">/{currentPage.urlPath}</p>
							</div>
						</div>

						<!-- Link groups -->
						{#if detectedLinks().length === 0}
							<div class="flex flex-col items-center justify-center py-16">
								<Link2 class="h-10 w-10 text-muted" />
								<p class="mt-3 text-sm font-medium text-foreground">Aucun lien détecté</p>
								<p class="mt-1 text-sm text-muted-foreground">Le contenu HTML ne contient pas de liens.</p>
							</div>
						{:else}
							{#each linkGroups() as group}
								<div class="mb-3">
									<button
										class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
										onclick={() => toggleGroup(group.key)}
									>
										<ChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform {collapsedGroups[group.key] ? '' : 'rotate-90'}" />
										<span class="text-xs font-semibold text-foreground/80">{group.name}</span>
										<span class="ml-auto text-[10px] text-muted-foreground">{group.links.length} lien{group.links.length > 1 ? 's' : ''}</span>
									</button>

									{#if !collapsedGroups[group.key]}
										<div class="ml-1 mt-1 space-y-2">
											{#each group.links as link}
												{@const mapped = isLinkMapped(link.url)}
												{@const mappedPage = getMappedPage(link.url)}
												<div class="rounded-lg border border-border bg-card p-3 transition-colors hover:shadow-sm {link.type === 'external' ? 'opacity-70' : ''}">
													<div class="flex items-center justify-between mb-2">
														<div class="flex items-center gap-2">
															<span class="text-sm font-medium text-foreground">{link.anchorText}</span>
														</div>
														{#if link.type === 'internal'}
															{#if mapped}
																<span class="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
																	<CheckCircle2 class="h-3 w-3" />
																	Mappé
																</span>
															{:else}
																<span class="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
																	<AlertCircle class="h-3 w-3" />
																	Non mappé
																</span>
															{/if}
														{:else}
															<span class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
																<ExternalLink class="h-3 w-3" />
																Externe
															</span>
														{/if}
													</div>
													<div class="flex items-center gap-2">
														<span class="shrink-0 text-[11px] font-medium text-muted-foreground">{link.type === 'external' ? 'URL :' : 'Cible :'}</span>
														{#if link.type === 'internal'}
															<select class="flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20">
																{#each pages as pg}
																	<option value={pg.urlPath} selected={mappedPage?.id === pg.id}>{pg.title}</option>
																{/each}
																{#if !mapped}
																	<option value="" selected disabled>— Non mappé —</option>
																{/if}
															</select>
														{:else}
															<span class="flex-1 truncate rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">{link.url}</span>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>

					<!-- Links mini map (right panel) -->
					{#if internalLinks.length > 0}
						<div class="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-card p-4 xl:block">
							<h3 class="mb-4 text-xs font-semibold text-foreground/80">Carte des liens</h3>
							<div class="relative min-h-[260px]">
								<!-- Current page node -->
								<div class="absolute left-1/2 top-4 -translate-x-1/2 z-10">
									<div class="rounded-md bg-primary px-3 py-1.5 text-[10px] font-semibold text-white shadow-md">
										{currentPage.title}
									</div>
								</div>

								<!-- Connected nodes -->
								{#each internalLinks.slice(0, 6) as link, i}
									{@const row = Math.floor(i / 2)}
									{@const col = i % 2}
									<div
										class="absolute z-10 rounded-md border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-foreground shadow-xs"
										style="top: {60 + row * 48}px; left: {col === 0 ? '8px' : 'auto'}; right: {col === 1 ? '8px' : 'auto'}"
									>
										{getMappedPage(link.url)?.title ?? link.url}
									</div>
								{/each}

								{#if internalLinks.length > 6}
									<div class="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
										+{internalLinks.length - 6} de plus
									</div>
								{/if}

								<!-- Simple SVG connectors -->
								<svg class="absolute inset-0 h-full w-full" viewBox="0 0 288 260" fill="none">
									{#each internalLinks.slice(0, 6) as _, i}
										{@const row = Math.floor(i / 2)}
										{@const col = i % 2}
										<line
											x1="144" y1="32"
											x2={col === 0 ? 60 : 228} y2={60 + row * 48 + 10}
											stroke="#e5e7eb" stroke-width="1.5"
										/>
									{/each}
								</svg>
							</div>

							<!-- Summary -->
							<div class="mt-4 space-y-1.5 border-t border-border pt-3">
								<div class="flex items-center justify-between text-xs">
									<span class="text-muted-foreground">Liens internes</span>
									<span class="font-semibold text-foreground">{internalLinks.length}</span>
								</div>
								<div class="flex items-center justify-between text-xs">
									<span class="text-muted-foreground">Liens externes</span>
									<span class="font-semibold text-foreground">{externalLinks.length}</span>
								</div>
								<div class="flex items-center justify-between text-xs">
									<span class="text-muted-foreground">Mappés</span>
									<span class="font-semibold text-success">{internalLinks.filter(l => isLinkMapped(l.url)).length}/{internalLinks.length}</span>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Links bottom bar -->
				<div class="flex items-center justify-between border-t border-border bg-card px-5 py-2">
					<span class="text-xs text-muted-foreground">
						<strong class="text-foreground/80">{detectedLinks().length}</strong> lien{detectedLinks().length !== 1 ? 's' : ''} détecté{detectedLinks().length !== 1 ? 's' : ''} ·
						<strong class="text-success">{internalLinks.filter(l => isLinkMapped(l.url)).length}</strong> mappé{internalLinks.filter(l => isLinkMapped(l.url)).length !== 1 ? 's' : ''} ·
						<strong class="text-warning">{internalLinks.filter(l => !isLinkMapped(l.url)).length}</strong> non mappé{internalLinks.filter(l => !isLinkMapped(l.url)).length !== 1 ? 's' : ''}
					</span>
					<Button size="sm" class="gap-1.5 text-xs" onclick={saveContent} disabled={!isDirty || saving}>
						<Save class="h-3.5 w-3.5" />
						Enregistrer
					</Button>
				</div>
			{:else if activeEditorTab === 'javascript'}
				<div class="flex-1 overflow-y-auto p-5">
					<!-- Warning banner -->
					<div class="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3.5">
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning/15">
							<AlertCircle class="h-4.5 w-4.5 text-warning" />
						</div>
						<p class="text-xs leading-relaxed text-warning/90">
							Les scripts JavaScript des pages capturées sont automatiquement désactivés en environnement simulé.
							Vous pouvez réactiver ceux qui sont nécessaires au bon fonctionnement de l'interface.
						</p>
					</div>

					<!-- Script cards -->
					{#if detectedScripts().length === 0}
						<div class="flex flex-col items-center justify-center py-16">
							<Braces class="h-10 w-10 text-muted" />
							<p class="mt-3 text-sm font-medium text-foreground">Aucun script détecté</p>
							<p class="mt-1 text-sm text-muted-foreground">Le contenu HTML ne contient pas de balises script.</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each detectedScripts() as script, i}
								<div class="rounded-lg border border-border bg-card p-4 transition-colors hover:shadow-sm">
									<div class="flex items-center justify-between mb-2">
										<div class="flex items-center gap-2">
											<span class="text-sm font-semibold text-foreground">
												{script.src ? `Script externe ${i + 1}` : `Script inline ${i + 1}`}
											</span>
											<Badge variant={script.src ? 'default' : 'warning'} class="text-[10px]">
												{script.src ? 'Externe' : 'Inline'}
											</Badge>
										</div>
										<!-- Toggle switch -->
										<button
											class="relative h-5 w-9 rounded-full transition-colors {script.enabled ? 'bg-success' : 'bg-muted'}"
											onclick={() => { script.enabled = !script.enabled; }}
											aria-label="Activer/Désactiver le script"
										>
											<div class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform {script.enabled ? 'translate-x-4' : 'translate-x-0.5'}"></div>
										</button>
									</div>
									<p class="mb-2 font-mono text-[11px] leading-relaxed text-muted-foreground break-all">{script.snippet}</p>
									<div class="flex items-center gap-3 text-[11px]">
										{#if script.src}
											<span class="text-muted-foreground">Source externe</span>
										{:else}
											<span class="text-muted-foreground">{script.snippet.length} caractères</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>
