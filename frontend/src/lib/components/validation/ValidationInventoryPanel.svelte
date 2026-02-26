<script lang="ts">
	import type { FormFieldInfo } from '$lib/validation-scanner';

	let {
		fields,
		selectedField,
		onSelectField,
		onRefreshScan
	}: {
		fields: FormFieldInfo[];
		selectedField: FormFieldInfo | null;
		onSelectField: (field: FormFieldInfo) => void;
		onRefreshScan: () => void;
	} = $props();

	let validatedCount = $derived(fields.filter((f) => f.hasValidation).length);
	let noValidationCount = $derived(fields.filter((f) => !f.hasValidation && !f.hasEsValidation).length);
	let esCount = $derived(fields.filter((f) => f.hasEsValidation).length);

	function tagColor(tag: string): string {
		if (tag === 'select') return 'bg-purple-100 text-purple-700';
		if (tag === 'textarea') return 'bg-teal-100 text-teal-700';
		return 'bg-gray-100 text-gray-600';
	}

	function statusDot(field: FormFieldInfo): string {
		if (field.hasEsValidation) return 'bg-warning';
		if (field.hasValidation) return 'bg-success';
		return 'bg-gray-300';
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
			</svg>
			<h3 class="text-sm font-semibold text-foreground">Champs de formulaire</h3>
		</div>
		<button
			onclick={onRefreshScan}
			class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			title="Rescanner"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
			</svg>
		</button>
	</div>

	<!-- Stats -->
	<div class="flex gap-2 border-b border-border px-4 py-2.5">
		{#if validatedCount > 0}
			<span class="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
				<span class="h-1.5 w-1.5 rounded-full bg-success"></span>
				{validatedCount} validé{validatedCount > 1 ? 's' : ''}
			</span>
		{/if}
		{#if noValidationCount > 0}
			<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
				<span class="h-1.5 w-1.5 rounded-full bg-gray-300"></span>
				{noValidationCount} sans
			</span>
		{/if}
		{#if esCount > 0}
			<span class="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
				<span class="h-1.5 w-1.5 rounded-full bg-warning"></span>
				{esCount} ajouté{esCount > 1 ? 's' : ''}
			</span>
		{/if}
		{#if fields.length === 0}
			<span class="text-[10px] text-muted-foreground">Aucun champ détecté</span>
		{/if}
	</div>

	<!-- Field list -->
	<div class="flex-1 overflow-y-auto">
		{#if fields.length === 0}
			<div class="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
				<svg class="h-8 w-8 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
				</svg>
				<p class="text-xs text-muted-foreground">Aucun champ de formulaire<br />trouvé sur cette page.</p>
			</div>
		{:else}
			{#each fields as field}
				<button
					onclick={() => onSelectField(field)}
					class="flex w-full items-center gap-2.5 border-b border-border/50 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 {selectedField?.selectorPath === field.selectorPath ? 'bg-warning/5 border-l-2 border-l-warning' : ''}"
				>
					<!-- Status dot -->
					<span class="h-2 w-2 shrink-0 rounded-full {statusDot(field)}"></span>

					<!-- Info -->
					<div class="flex-1 min-w-0">
						<p class="truncate text-xs font-medium text-foreground">
							{field.label || field.name || field.id || 'Sans nom'}
						</p>
						<div class="mt-0.5 flex items-center gap-1.5">
							<span class="rounded px-1 py-0.5 text-[9px] font-mono {tagColor(field.tagName)}">
								{field.tagName}
							</span>
							{#if field.inputType && field.inputType !== 'text'}
								<span class="rounded bg-blue-50 px-1 py-0.5 text-[9px] font-mono text-blue-600">
									{field.inputType}
								</span>
							{/if}
							{#if field.validation.required}
								<span class="text-[9px] font-medium text-error">requis</span>
							{/if}
						</div>
					</div>

					<!-- Arrow -->
					<svg class="h-3.5 w-3.5 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</button>
			{/each}
		{/if}
	</div>

	<!-- Footer count -->
	{#if fields.length > 0}
		<div class="border-t border-border px-4 py-2">
			<p class="text-[10px] text-muted-foreground">{fields.length} champ{fields.length > 1 ? 's' : ''} détecté{fields.length > 1 ? 's' : ''}</p>
		</div>
	{/if}
</div>
