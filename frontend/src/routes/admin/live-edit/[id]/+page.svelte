<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get, patch } from '$lib/api';
	import { Button } from '$components/ui/button';
	import { Badge } from '$components/ui/badge';
	import {
		Save,
		ArrowLeft,
		Pencil,
		Eye,
		Loader2,
		CheckCircle2,
		MousePointer,
		Undo2,
	} from 'lucide-svelte';

	interface PageData {
		id: string;
		versionId: string;
		urlSource: string;
		urlPath: string;
		title: string;
		filePath: string;
		fileSize: number | null;
		healthStatus: string;
		createdAt: string;
	}

	let pageId = $derived($page.params.id);
	let currentPage: PageData | null = $state(null);
	let htmlContent = $state('');
	let originalContent = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let saved = $state(false);
	let editMode = $state(true);
	let editCount = $state(0);

	let isDirty = $derived(htmlContent !== originalContent);

	let iframeEl: HTMLIFrameElement | undefined = $state();

	function injectEditMode() {
		if (!iframeEl?.contentDocument) return;

		const doc = iframeEl.contentDocument;

		// Add edit mode styles
		const style = doc.createElement('style');
		style.id = 'live-edit-styles';
		style.textContent = `
			[contenteditable="true"]:hover {
				outline: 2px dashed #3B82F6 !important;
				outline-offset: 2px !important;
				cursor: text !important;
			}
			[contenteditable="true"]:focus {
				outline: 2px solid #3B82F6 !important;
				outline-offset: 2px !important;
				background-color: rgba(59, 130, 246, 0.05) !important;
			}
			.live-edit-highlight {
				outline: 1px dashed rgba(59, 130, 246, 0.3) !important;
			}
		`;
		doc.head.appendChild(style);

		// Make text elements editable
		const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label, button, div:not(:has(*))';
		const elements = doc.querySelectorAll(editableSelectors);
		elements.forEach((el) => {
			const htmlEl = el as HTMLElement;
			// Only make leaf text nodes editable (elements with direct text content)
			if (htmlEl.childNodes.length > 0 && htmlEl.textContent?.trim()) {
				htmlEl.setAttribute('contenteditable', 'true');
				htmlEl.addEventListener('input', () => {
					editCount++;
					// Update the HTML content from the modified DOM
					htmlContent = doc.documentElement.outerHTML;
				});
			}
		});

		// Prevent link navigation in edit mode
		doc.addEventListener('click', (e) => {
			if (editMode) {
				const target = e.target as HTMLElement;
				const link = target.closest('a');
				if (link) {
					e.preventDefault();
					e.stopPropagation();
				}
			}
		}, true);
	}

	function removeEditMode() {
		if (!iframeEl?.contentDocument) return;
		const doc = iframeEl.contentDocument;

		// Remove contenteditable
		doc.querySelectorAll('[contenteditable]').forEach((el) => {
			el.removeAttribute('contenteditable');
		});

		// Remove edit styles
		const style = doc.getElementById('live-edit-styles');
		if (style) style.remove();
	}

	async function saveContent() {
		if (!currentPage || !isDirty) return;
		saving = true;
		saved = false;

		try {
			await patch(`/pages/${currentPage.id}/content`, { html: htmlContent });
			originalContent = htmlContent;
			editCount = 0;
			saved = true;
			setTimeout(() => { saved = false; }, 3000);
		} catch (err) {
			console.error('Save error:', err);
		} finally {
			saving = false;
		}
	}

	function handleIframeLoad() {
		if (editMode) {
			injectEditMode();
		}
	}

	function toggleEditMode() {
		editMode = !editMode;
		if (editMode) {
			injectEditMode();
		} else {
			removeEditMode();
		}
	}

	function revertChanges() {
		if (!iframeEl?.contentDocument || !originalContent) return;
		htmlContent = originalContent;
		editCount = 0;
		// Reload the iframe with original content
		const doc = iframeEl.contentDocument;
		doc.open();
		doc.write(originalContent);
		doc.close();
		if (editMode) {
			setTimeout(injectEditMode, 100);
		}
	}

	// Keyboard shortcut: Ctrl+S
	function handleKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			saveContent();
		}
	}

	onMount(async () => {
		window.addEventListener('keydown', handleKeyDown);

		try {
			// Load page metadata
			const pageRes = await get<{ data: PageData }>(`/pages/${pageId}`);
			currentPage = pageRes.data;

			// Load HTML content
			const contentRes = await get<{ data: { html: string } }>(`/pages/${pageId}/content`);
			htmlContent = contentRes.data?.html ?? '';
			originalContent = htmlContent;
		} catch (err) {
			console.error('Live edit init error:', err);
		} finally {
			loading = false;
		}

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	// Write content to iframe once loaded
	$effect(() => {
		if (!loading && iframeEl && htmlContent && editCount === 0) {
			const doc = iframeEl.contentDocument;
			if (doc) {
				doc.open();
				doc.write(htmlContent);
				doc.close();
				setTimeout(() => {
					if (editMode) injectEditMode();
				}, 100);
			}
		}
	});
</script>

<svelte:head>
	<title>Édition en direct — {currentPage?.title ?? ''}</title>
</svelte:head>

<div class="flex h-[calc(100vh-56px)] flex-col overflow-hidden -m-6">
	<!-- Toolbar -->
	<div class="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2">
		<div class="flex items-center gap-3">
			<a
				href="/admin/tree"
				class="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeft class="h-3.5 w-3.5" />
				Retour
			</a>
			<div class="h-5 w-px bg-border"></div>
			<h2 class="text-sm font-semibold text-foreground">{currentPage?.title ?? 'Chargement...'}</h2>
			{#if isDirty}
				<Badge variant="warning" class="text-[10px]">{editCount} modification{editCount !== 1 ? 's' : ''}</Badge>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			{#if saved}
				<span class="inline-flex items-center gap-1 text-xs font-medium text-success">
					<CheckCircle2 class="h-3.5 w-3.5" />
					Enregistré
				</span>
			{/if}

			<!-- Edit mode toggle -->
			<Button
				variant={editMode ? 'default' : 'outline'}
				size="sm"
				class="gap-1.5"
				onclick={toggleEditMode}
			>
				{#if editMode}
					<Pencil class="h-3.5 w-3.5" />
					Mode édition
				{:else}
					<Eye class="h-3.5 w-3.5" />
					Mode aperçu
				{/if}
			</Button>

			{#if isDirty}
				<Button variant="outline" size="sm" class="gap-1.5" onclick={revertChanges}>
					<Undo2 class="h-3.5 w-3.5" />
					Annuler
				</Button>
			{/if}

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

	<!-- Edit hint bar -->
	{#if editMode}
		<div class="flex shrink-0 items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-1.5">
			<MousePointer class="h-3.5 w-3.5 text-primary" />
			<span class="text-xs text-primary">
				Cliquez sur un texte pour le modifier directement. Les modifications sont surlignées en bleu.
			</span>
		</div>
	{/if}

	<!-- Demo content -->
	<div class="flex-1 overflow-hidden bg-white">
		{#if loading}
			<div class="flex h-full items-center justify-center bg-background">
				<Loader2 class="h-6 w-6 animate-spin text-primary" />
			</div>
		{:else}
			<iframe
				bind:this={iframeEl}
				class="h-full w-full border-0"
				title="Édition en direct"
				onload={handleIframeLoad}
			></iframe>
		{/if}
	</div>
</div>
