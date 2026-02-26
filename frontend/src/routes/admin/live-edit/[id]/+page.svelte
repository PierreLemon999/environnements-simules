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
		ShieldCheck,
	} from 'lucide-svelte';
	import { scanFormFields, applyValidationRules, buildSelectorPath } from '$lib/validation-scanner';
	import type { FormFieldInfo, ValidationRules } from '$lib/validation-scanner';
	import ValidationInventoryPanel from '$lib/components/validation/ValidationInventoryPanel.svelte';
	import ValidationRuleEditor from '$lib/components/validation/ValidationRuleEditor.svelte';
	import { injectPreviewMode, removePreviewMode } from '$lib/components/validation/validation-preview-script';

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

	type EditorMode = 'edit' | 'validation' | 'preview';

	let pageId = $derived($page.params.id);
	let currentPage: PageData | null = $state(null);
	let htmlContent = $state('');
	let originalContent = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let saved = $state(false);
	let editorMode = $state<EditorMode>('edit');
	let editCount = $state(0);

	// Validation state
	let formFields = $state<FormFieldInfo[]>([]);
	let selectedField = $state<FormFieldInfo | null>(null);
	let scanLoading = $state(false);

	let isDirty = $derived(htmlContent !== originalContent);
	let showSidePanel = $derived(editorMode === 'validation');

	let iframeEl: HTMLIFrameElement | undefined = $state();

	// -----------------------------------------------------------------------
	// Edit mode
	// -----------------------------------------------------------------------

	function injectEditMode() {
		if (!iframeEl?.contentDocument) return;
		const doc = iframeEl.contentDocument;

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

		const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label, button, div:not(:has(*))';
		const elements = doc.querySelectorAll(editableSelectors);
		elements.forEach((el) => {
			const htmlEl = el as HTMLElement;
			if (htmlEl.childNodes.length > 0 && htmlEl.textContent?.trim()) {
				htmlEl.setAttribute('contenteditable', 'true');
				htmlEl.addEventListener('input', () => {
					editCount++;
					htmlContent = doc.documentElement.outerHTML;
				});
			}
		});

		doc.addEventListener('click', (e) => {
			if (editorMode === 'edit') {
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

		doc.querySelectorAll('[contenteditable]').forEach((el) => {
			el.removeAttribute('contenteditable');
		});

		const style = doc.getElementById('live-edit-styles');
		if (style) style.remove();
	}

	// -----------------------------------------------------------------------
	// Validation mode
	// -----------------------------------------------------------------------

	function injectValidationMode() {
		if (!iframeEl?.contentDocument) return;
		const doc = iframeEl.contentDocument;

		// Scan fields
		scanFormFields_internal();

		// Inject styles
		const style = doc.createElement('style');
		style.id = 'es-validation-styles';
		style.textContent = `
			input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]),
			textarea, select {
				outline: 2px dashed rgba(245, 158, 11, 0.4) !important;
				outline-offset: 1px !important;
				transition: outline 0.15s ease !important;
			}
			input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):hover,
			textarea:hover, select:hover {
				outline: 2px dashed #F59E0B !important;
				cursor: pointer !important;
			}
			.es-validation-selected {
				outline: 2px solid #F59E0B !important;
				outline-offset: 2px !important;
				background-color: rgba(245, 158, 11, 0.05) !important;
			}
			[required], [pattern], [min], [max], [minlength], [maxlength] {
				border-left: 3px solid #10B981 !important;
			}
			[data-es-validation="true"] {
				border-left: 3px solid #F59E0B !important;
			}
		`;
		doc.head.appendChild(style);

		// Click handler to select fields
		doc.addEventListener('click', handleValidationClick, true);
	}

	function handleValidationClick(e: MouseEvent) {
		if (editorMode !== 'validation') return;
		e.preventDefault();
		e.stopPropagation();

		const target = e.target as HTMLElement;
		const field = target.closest('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select') as HTMLElement | null;

		if (!field) return;

		// Remove previous selection highlight
		const doc = iframeEl?.contentDocument;
		if (doc) {
			doc.querySelectorAll('.es-validation-selected').forEach((el) => {
				el.classList.remove('es-validation-selected');
			});
		}

		// Highlight selected
		field.classList.add('es-validation-selected');

		// Find matching FormFieldInfo
		const selectorPath = buildSelectorPath(field);
		const match = formFields.find((f) => f.selectorPath === selectorPath);
		if (match) {
			selectedField = match;
		}
	}

	function removeValidationMode() {
		if (!iframeEl?.contentDocument) return;
		const doc = iframeEl.contentDocument;

		// Remove styles
		const style = doc.getElementById('es-validation-styles');
		if (style) style.remove();

		// Remove selection class
		doc.querySelectorAll('.es-validation-selected').forEach((el) => {
			el.classList.remove('es-validation-selected');
		});

		// Remove click handler
		doc.removeEventListener('click', handleValidationClick, true);

		selectedField = null;
	}

	function scanFormFields_internal() {
		if (!iframeEl?.contentDocument) return;
		scanLoading = true;
		formFields = scanFormFields(iframeEl.contentDocument);
		scanLoading = false;
	}

	function handleSelectField(field: FormFieldInfo) {
		// Remove previous selection
		const doc = iframeEl?.contentDocument;
		if (doc) {
			doc.querySelectorAll('.es-validation-selected').forEach((el) => {
				el.classList.remove('es-validation-selected');
			});
		}

		selectedField = field;

		// Highlight in iframe
		field.element.classList.add('es-validation-selected');
		field.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function handleApplyValidation(field: FormFieldInfo, rules: Partial<ValidationRules>) {
		if (!iframeEl?.contentDocument) return;

		applyValidationRules(field.element, rules);
		editCount++;
		htmlContent = iframeEl.contentDocument.documentElement.outerHTML;

		// Re-scan to refresh state
		scanFormFields_internal();

		// Re-select the same field (updated)
		const updated = formFields.find((f) => f.selectorPath === field.selectorPath);
		if (updated) {
			selectedField = updated;
		}
	}

	// -----------------------------------------------------------------------
	// Mode switching
	// -----------------------------------------------------------------------

	function setEditorMode(mode: EditorMode) {
		if (mode === editorMode) return;

		// Clean up current mode
		if (editorMode === 'edit') removeEditMode();
		else if (editorMode === 'validation') removeValidationMode();
		else if (editorMode === 'preview' && iframeEl?.contentDocument) removePreviewMode(iframeEl.contentDocument);

		editorMode = mode;

		// Activate new mode
		if (mode === 'edit') injectEditMode();
		else if (mode === 'validation') injectValidationMode();
		else if (mode === 'preview' && iframeEl?.contentDocument) injectPreviewMode(iframeEl.contentDocument);
	}

	// -----------------------------------------------------------------------
	// Save / revert / shortcuts
	// -----------------------------------------------------------------------

	async function saveContent() {
		if (!currentPage || !isDirty || !iframeEl?.contentDocument) return;
		saving = true;
		saved = false;

		try {
			// Clean up transient artifacts before save
			const doc = iframeEl.contentDocument;
			const cleanupSelectors = [
				'[contenteditable]',
			];
			cleanupSelectors.forEach((sel) => {
				doc.querySelectorAll(sel).forEach((el) => el.removeAttribute('contenteditable'));
			});

			// Remove injected styles and scripts
			['live-edit-styles', 'es-validation-styles', 'es-validation-preview', 'es-validation-preview-styles'].forEach((id) => {
				const el = doc.getElementById(id);
				if (el) el.remove();
			});

			// Remove transient classes
			doc.querySelectorAll('.es-validation-selected, .es-valid, .es-invalid').forEach((el) => {
				el.classList.remove('es-validation-selected', 'es-valid', 'es-invalid');
			});
			doc.querySelectorAll('.es-validation-msg').forEach((el) => el.remove());
			doc.querySelectorAll('script[data-es-injected]').forEach((el) => el.remove());

			// Serialize clean HTML
			const cleanHtml = doc.documentElement.outerHTML;
			await patch(`/pages/${currentPage.id}/content`, { html: cleanHtml });
			htmlContent = cleanHtml;
			originalContent = cleanHtml;
			editCount = 0;
			saved = true;
			setTimeout(() => { saved = false; }, 3000);

			// Re-inject current mode
			setTimeout(() => {
				if (editorMode === 'edit') injectEditMode();
				else if (editorMode === 'validation') injectValidationMode();
				else if (editorMode === 'preview' && iframeEl?.contentDocument) injectPreviewMode(iframeEl.contentDocument);
			}, 50);
		} catch (err) {
			console.error('Save error:', err);
		} finally {
			saving = false;
		}
	}

	function handleIframeLoad() {
		if (editorMode === 'edit') injectEditMode();
		else if (editorMode === 'validation') injectValidationMode();
		else if (editorMode === 'preview' && iframeEl?.contentDocument) injectPreviewMode(iframeEl.contentDocument);
	}

	function revertChanges() {
		if (!iframeEl?.contentDocument || !originalContent) return;
		htmlContent = originalContent;
		editCount = 0;
		selectedField = null;
		formFields = [];

		const doc = iframeEl.contentDocument;
		doc.open();
		doc.write(originalContent);
		doc.close();
		setTimeout(() => {
			if (editorMode === 'edit') injectEditMode();
			else if (editorMode === 'validation') injectValidationMode();
			else if (editorMode === 'preview' && iframeEl?.contentDocument) injectPreviewMode(iframeEl.contentDocument);
		}, 100);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			saveContent();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);

		(async () => {
			try {
				const pageRes = await get<{ data: PageData }>(`/pages/${pageId}`);
				currentPage = pageRes.data;

				const contentRes = await get<{ data: { html: string } }>(`/pages/${pageId}/content`);
				htmlContent = contentRes.data?.html ?? '';
				originalContent = htmlContent;
			} catch (err) {
				console.error('Live edit init error:', err);
			} finally {
				loading = false;
			}
		})();

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	$effect(() => {
		if (!loading && iframeEl && htmlContent && editCount === 0) {
			const doc = iframeEl.contentDocument;
			if (doc) {
				doc.open();
				doc.write(htmlContent);
				doc.close();
				setTimeout(() => {
					if (editorMode === 'edit') injectEditMode();
					else if (editorMode === 'validation') injectValidationMode();
					else if (editorMode === 'preview' && iframeEl?.contentDocument) injectPreviewMode(iframeEl.contentDocument);
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

			<!-- 3-mode segmented control -->
			<div class="flex rounded-lg border border-border bg-muted/50 p-0.5">
				<button
					onclick={() => setEditorMode('edit')}
					class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {editorMode === 'edit' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				>
					<Pencil class="h-3.5 w-3.5" />
					Édition
				</button>
				<button
					onclick={() => setEditorMode('validation')}
					class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {editorMode === 'validation' ? 'bg-white text-warning shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				>
					<ShieldCheck class="h-3.5 w-3.5" />
					Validation
				</button>
				<button
					onclick={() => setEditorMode('preview')}
					class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {editorMode === 'preview' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				>
					<Eye class="h-3.5 w-3.5" />
					Aperçu
				</button>
			</div>

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

	<!-- Mode hint bars -->
	{#if editorMode === 'edit'}
		<div class="flex shrink-0 items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-1.5">
			<MousePointer class="h-3.5 w-3.5 text-primary" />
			<span class="text-xs text-primary">
				Cliquez sur un texte pour le modifier directement. Les modifications sont surlignées en bleu.
			</span>
		</div>
	{:else if editorMode === 'validation'}
		<div class="flex shrink-0 items-center gap-2 border-b border-warning/20 bg-warning/5 px-4 py-1.5">
			<ShieldCheck class="h-3.5 w-3.5 text-warning" />
			<span class="text-xs text-warning">
				Cliquez sur un champ de formulaire pour modifier ses règles de validation.
				{#if formFields.length > 0}
					<span class="font-medium">{formFields.length} champ{formFields.length > 1 ? 's' : ''} détecté{formFields.length > 1 ? 's' : ''}.</span>
				{/if}
			</span>
		</div>
	{/if}

	<!-- Main content area -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Iframe -->
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

		<!-- Validation side panel -->
		{#if showSidePanel}
			<div class="w-80 shrink-0 border-l border-border bg-card overflow-hidden">
				{#if selectedField}
					<ValidationRuleEditor
						field={selectedField}
						onApply={handleApplyValidation}
						onBack={() => { selectedField = null; }}
					/>
				{:else}
					<ValidationInventoryPanel
						fields={formFields}
						{selectedField}
						onSelectField={handleSelectField}
						onRefreshScan={scanFormFields_internal}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>
