<script lang="ts">
	import { cn } from '$lib/utils';
	import { ChevronDown, Search, Check } from 'lucide-svelte';

	interface Option {
		value: string;
		label: string;
		color?: string;
	}

	let {
		value = $bindable(''),
		options,
		placeholder = 'Sélectionner...',
		searchable = false,
		searchPlaceholder = 'Rechercher...',
		class: className,
		disabled = false,
		onchange,
	}: {
		value?: string;
		options: Option[];
		placeholder?: string;
		searchable?: boolean;
		searchPlaceholder?: string;
		class?: string;
		disabled?: boolean;
		onchange?: (value: string) => void;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let triggerEl: HTMLButtonElement | undefined = $state();

	let selectedLabel = $derived(() => {
		const opt = options.find(o => o.value === value);
		return opt?.label ?? '';
	});

	let filtered = $derived(() => {
		if (!searchable || !query.trim()) return options;
		const q = query.toLowerCase();
		return options.filter(o => o.label.toLowerCase().includes(q));
	});

	function select(val: string) {
		value = val;
		open = false;
		query = '';
		onchange?.(val);
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (triggerEl && !triggerEl.closest('.searchable-select-root')?.contains(target)) {
			open = false;
			query = '';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			query = '';
		}
	}
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<div class={cn('relative searchable-select-root', className)}>
	<button
		type="button"
		bind:this={triggerEl}
		class="flex h-9 w-full items-center justify-between rounded-md border border-border bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
		{disabled}
		onclick={() => { if (!disabled) { open = !open; query = ''; } }}
	>
		{#if selectedLabel()}
			<span class="truncate text-foreground">{selectedLabel()}</span>
		{:else}
			<span class="truncate text-muted">{placeholder}</span>
		{/if}
		<ChevronDown class="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform {open ? 'rotate-180' : ''}" />
	</button>

	{#if open}
		<div class="absolute left-0 top-[calc(100%+4px)] z-50 w-full rounded-md border border-border bg-card shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
			{#if searchable}
				<div class="border-b border-border p-1.5">
					<div class="relative">
						<Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
						<input
							type="text"
							class="h-8 w-full rounded-md border border-border bg-transparent pl-8 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ring"
							placeholder={searchPlaceholder}
							bind:value={query}
						/>
					</div>
				</div>
			{/if}

			<div class="max-h-52 overflow-y-auto p-1">
				{#each filtered() as opt}
					<button
						type="button"
						class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent {opt.value === value ? 'bg-accent/70 font-medium text-primary' : 'text-foreground'}"
						onclick={() => select(opt.value)}
					>
						{#if opt.color}
							<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {opt.color}"></span>
						{/if}
						<span class="truncate flex-1">{opt.label}</span>
						{#if opt.value === value}
							<Check class="h-3.5 w-3.5 shrink-0 text-primary" />
						{/if}
					</button>
				{:else}
					<p class="px-2.5 py-3 text-center text-sm text-muted-foreground">Aucun résultat</p>
				{/each}
			</div>
		</div>
	{/if}
</div>
