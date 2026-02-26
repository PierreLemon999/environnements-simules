<script lang="ts">
	import type { FormFieldInfo, ValidationRules } from '$lib/validation-scanner';

	let {
		field,
		onApply,
		onBack
	}: {
		field: FormFieldInfo;
		onApply: (field: FormFieldInfo, rules: Partial<ValidationRules>) => void;
		onBack: () => void;
	} = $props();

	// Local editable state initialized from current field rules
	let required = $state(field.validation.required);
	let type = $state(field.validation.type);
	let pattern = $state(field.validation.pattern ?? '');
	let patternTitle = $state(field.validation.patternTitle ?? '');
	let min = $state(field.validation.min ?? '');
	let max = $state(field.validation.max ?? '');
	let minlength = $state(field.validation.minlength?.toString() ?? '');
	let maxlength = $state(field.validation.maxlength?.toString() ?? '');
	let customMessage = $state(field.validation.customMessage ?? '');
	let placeholder = $state(field.validation.placeholder ?? '');

	// Test pattern
	let testValue = $state('');
	let testResult = $derived.by(() => {
		if (!pattern || !testValue) return null;
		try {
			return new RegExp(pattern).test(testValue);
		} catch {
			return null;
		}
	});

	// Reset state when field changes
	$effect(() => {
		required = field.validation.required;
		type = field.validation.type;
		pattern = field.validation.pattern ?? '';
		patternTitle = field.validation.patternTitle ?? '';
		min = field.validation.min ?? '';
		max = field.validation.max ?? '';
		minlength = field.validation.minlength?.toString() ?? '';
		maxlength = field.validation.maxlength?.toString() ?? '';
		customMessage = field.validation.customMessage ?? '';
		placeholder = field.validation.placeholder ?? '';
		testValue = '';
	});

	const TYPE_OPTIONS = [
		{ value: 'text', label: 'Texte' },
		{ value: 'email', label: 'Email' },
		{ value: 'url', label: 'URL' },
		{ value: 'number', label: 'Nombre' },
		{ value: 'tel', label: 'Téléphone' },
		{ value: 'date', label: 'Date' },
		{ value: 'password', label: 'Mot de passe' },
	];

	const PRESETS = [
		{ label: 'Email', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', title: 'Adresse e-mail valide' },
		{ label: 'Tél. FR', pattern: '^(\\+33|0)[1-9](\\d{2}){4}$', title: 'Numéro de téléphone français' },
		{ label: 'Code postal', pattern: '^\\d{5}$', title: 'Code postal à 5 chiffres' },
		{ label: 'URL', pattern: '^https?://.*', title: 'URL commençant par http(s)://' },
		{ label: 'Numérique', pattern: '^\\d+$', title: 'Chiffres uniquement' },
	];

	let isNumericType = $derived(type === 'number' || type === 'date');
	let isTextType = $derived(!isNumericType && field.tagName !== 'select');

	function applyPreset(preset: typeof PRESETS[number]) {
		pattern = preset.pattern;
		patternTitle = preset.title;
	}

	function handleApply() {
		const rules: Partial<ValidationRules> = {
			required,
			type: field.tagName === 'input' ? type : undefined,
			pattern: pattern || null,
			patternTitle: patternTitle || null,
			min: min || null,
			max: max || null,
			minlength: minlength ? parseInt(minlength, 10) : null,
			maxlength: maxlength ? parseInt(maxlength, 10) : null,
			customMessage: customMessage || null,
			placeholder: placeholder || null,
		};
		onApply(field, rules);
	}

	function handleReset() {
		required = false;
		type = 'text';
		pattern = '';
		patternTitle = '';
		min = '';
		max = '';
		minlength = '';
		maxlength = '';
		customMessage = '';
		placeholder = '';
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header with back button -->
	<div class="border-b border-border px-4 py-3">
		<button
			onclick={onBack}
			class="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
		>
			<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="15 18 9 12 15 6" />
			</svg>
			Retour à la liste
		</button>

		<!-- Element info -->
		<div class="rounded-lg bg-muted/50 px-3 py-2">
			<p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Élément</p>
			<p class="mt-0.5 font-mono text-xs text-foreground">
				&lt;{field.tagName}&gt;
				{#if field.name}<span class="text-muted-foreground"> name="{field.name}"</span>{/if}
				{#if field.id}<span class="text-blue-600"> #{field.id}</span>{/if}
			</p>
			{#if field.label}
				<p class="mt-1 text-[10px] text-muted-foreground">Label : {field.label}</p>
			{/if}
		</div>
	</div>

	<!-- Rules form -->
	<div class="flex-1 space-y-4 overflow-y-auto px-4 py-3">
		<!-- Required toggle -->
		<div class="flex items-center justify-between">
			<label for="required-toggle" class="text-xs font-medium text-foreground">Obligatoire</label>
			<button
				id="required-toggle"
				onclick={() => (required = !required)}
				class="relative h-5 w-9 rounded-full transition-colors {required ? 'bg-primary' : 'bg-gray-300'}"
				role="switch"
				aria-checked={required}
			>
				<span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform {required ? 'translate-x-4' : ''}"></span>
			</button>
		</div>

		<!-- Type dropdown (input only) -->
		{#if field.tagName === 'input'}
			<div>
				<label for="type-select" class="mb-1 block text-xs font-medium text-foreground">Type de champ</label>
				<select
					id="type-select"
					bind:value={type}
					class="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{#each TYPE_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- Length min/max (text types) -->
		{#if isTextType}
			<div>
				<p class="mb-1 text-xs font-medium text-foreground">Longueur min / max</p>
				<div class="flex gap-2">
					<input
						type="number"
						bind:value={minlength}
						placeholder="Min"
						min="0"
						class="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
					<input
						type="number"
						bind:value={maxlength}
						placeholder="Max"
						min="0"
						class="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
			</div>
		{/if}

		<!-- Value min/max (number/date) -->
		{#if isNumericType}
			<div>
				<p class="mb-1 text-xs font-medium text-foreground">Valeur min / max</p>
				<div class="flex gap-2">
					<input
						type={type === 'date' ? 'date' : 'number'}
						bind:value={min}
						placeholder="Min"
						class="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
					<input
						type={type === 'date' ? 'date' : 'number'}
						bind:value={max}
						placeholder="Max"
						class="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
			</div>
		{/if}

		<!-- Pattern -->
		{#if field.tagName !== 'select'}
			<div>
				<label for="pattern-input" class="mb-1 block text-xs font-medium text-foreground">Expression régulière</label>
				<input
					id="pattern-input"
					type="text"
					bind:value={pattern}
					placeholder="^[a-zA-Z]+$"
					class="w-full rounded-lg border border-border bg-white px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>

			<!-- Pattern title (error message) -->
			{#if pattern}
				<div>
					<label for="pattern-title" class="mb-1 block text-xs font-medium text-foreground">Message d'erreur</label>
					<input
						id="pattern-title"
						type="text"
						bind:value={patternTitle}
						placeholder="Entrez une valeur valide"
						class="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<!-- Test area -->
				<div>
					<label for="test-input" class="mb-1 block text-xs font-medium text-muted-foreground">Tester</label>
					<div class="flex items-center gap-2">
						<input
							id="test-input"
							type="text"
							bind:value={testValue}
							placeholder="Valeur test…"
							class="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						{#if testResult === true}
							<svg class="h-4 w-4 shrink-0 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>
						{:else if testResult === false}
							<svg class="h-4 w-4 shrink-0 text-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Presets -->
			<div>
				<p class="mb-1.5 text-xs font-medium text-muted-foreground">Presets</p>
				<div class="flex flex-wrap gap-1.5">
					{#each PRESETS as preset}
						<button
							onclick={() => applyPreset(preset)}
							class="rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
						>
							{preset.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Custom message -->
		<div>
			<label for="custom-msg" class="mb-1 block text-xs font-medium text-foreground">Message personnalisé</label>
			<input
				id="custom-msg"
				type="text"
				bind:value={customMessage}
				placeholder="Ce champ est requis"
				class="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
			/>
		</div>

		<!-- Placeholder -->
		<div>
			<label for="placeholder-input" class="mb-1 block text-xs font-medium text-foreground">Placeholder</label>
			<input
				id="placeholder-input"
				type="text"
				bind:value={placeholder}
				placeholder="Entrez votre email…"
				class="w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
			/>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex gap-2 border-t border-border px-4 py-3">
		<button
			onclick={handleReset}
			class="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			Réinitialiser
		</button>
		<button
			onclick={handleApply}
			class="flex-1 rounded-lg bg-primary py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600"
		>
			Appliquer
		</button>
	</div>
</div>
