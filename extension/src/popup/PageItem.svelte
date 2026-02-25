<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { PAGE_STATUS, type CapturedPage } from '$lib/constants';

	let { page, formatSize }: { page: CapturedPage; formatSize: (bytes: number) => string } = $props();
	const dispatch = createEventDispatcher<{ remove: void; recapture: void }>();

	let showActions = $state(false);

	const statusConfig = {
		[PAGE_STATUS.PENDING]: { color: 'text-gray-400', bg: 'bg-gray-100', label: 'En attente', icon: 'clock' },
		[PAGE_STATUS.CAPTURING]: { color: 'text-warning', bg: 'bg-amber-50', label: 'Capture...', icon: 'spinner' },
		[PAGE_STATUS.UPLOADING]: { color: 'text-primary', bg: 'bg-blue-50', label: 'Envoi...', icon: 'spinner' },
		[PAGE_STATUS.DONE]: { color: 'text-success', bg: 'bg-green-50', label: 'OK', icon: 'check' },
		[PAGE_STATUS.ERROR]: { color: 'text-error', bg: 'bg-red-50', label: 'Erreur', icon: 'x' }
	};

	let config = $derived(statusConfig[page.status] || statusConfig[PAGE_STATUS.PENDING]);
</script>

<div
	class="group flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition cursor-default"
	role="listitem"
	onmouseenter={() => (showActions = true)}
	onmouseleave={() => (showActions = false)}
>
	<!-- Status icon -->
	<div class="shrink-0 mt-0.5">
		{#if config.icon === 'spinner'}
			<div class="w-4 h-4 border-2 border-gray-200 {page.status === PAGE_STATUS.UPLOADING ? 'border-t-primary' : 'border-t-warning'} rounded-full animate-spin"></div>
		{:else if config.icon === 'check'}
			<svg class="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12" />
			</svg>
		{:else if config.icon === 'x'}
			<svg class="w-4 h-4 text-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
			</svg>
		{:else}
			<svg class="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
			</svg>
		{/if}
	</div>

	<!-- Page info -->
	<div class="flex-1 min-w-0">
		<p class="text-xs font-medium text-gray-800 truncate leading-tight">
			{page.title || 'Sans titre'}
		</p>
		<p class="text-[10px] text-gray-400 truncate mt-0.5">
			{page.url || 'URL inconnue'}
		</p>
		{#if page.error}
			<p class="text-[10px] text-error mt-0.5">{page.error}</p>
		{/if}
	</div>

	<!-- Right side: size or actions -->
	<div class="shrink-0 flex items-center gap-1">
		{#if showActions}
			{#if page.status === PAGE_STATUS.ERROR}
				<button
					onclick={() => dispatch('recapture')}
					class="p-1 text-gray-400 hover:text-primary rounded transition"
					title="Recapturer"
				>
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
					</svg>
				</button>
			{/if}
			<button
				onclick={() => dispatch('remove')}
				class="p-1 text-gray-400 hover:text-error rounded transition"
				title="Supprimer"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
				</svg>
			</button>
		{:else}
			{#if page.fileSize > 0}
				<span class="text-[10px] text-gray-300">{formatSize(page.fileSize)}</span>
			{:else}
				<span class="text-[10px] {config.color}">{config.label}</span>
			{/if}
		{/if}
	</div>
</div>
