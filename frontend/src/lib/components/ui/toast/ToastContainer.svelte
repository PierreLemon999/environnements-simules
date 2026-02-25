<script lang="ts">
	import { toasts, toast as toastStore, type Toast } from '$lib/stores/toast';
	import { fly, fade } from 'svelte/transition';
	import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-svelte';

	const iconMap: Record<Toast['type'], typeof CheckCircle2> = {
		success: CheckCircle2,
		error: XCircle,
		warning: AlertTriangle,
		info: Info,
	};

	const colorMap: Record<Toast['type'], string> = {
		success: 'border-success/30 bg-success/5 text-success',
		error: 'border-destructive/30 bg-destructive/5 text-destructive',
		warning: 'border-warning/30 bg-warning/5 text-warning',
		info: 'border-primary/30 bg-primary/5 text-primary',
	};

	const iconColorMap: Record<Toast['type'], string> = {
		success: 'text-success',
		error: 'text-destructive',
		warning: 'text-warning',
		info: 'text-primary',
	};
</script>

{#if $toasts.length > 0}
	<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
		{#each $toasts as t (t.id)}
			<div
				class="flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm {colorMap[t.type]}"
				in:fly={{ y: 20, duration: 200 }}
				out:fade={{ duration: 150 }}
			>
				<svelte:component this={iconMap[t.type]} class="h-4 w-4 shrink-0 {iconColorMap[t.type]}" />
				<p class="text-sm font-medium text-foreground">{t.message}</p>
				<button
					onclick={() => toastStore.remove(t.id)}
					class="ml-2 shrink-0 rounded p-0.5 text-muted transition-colors hover:text-foreground"
					title="Fermer"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>
		{/each}
	</div>
{/if}
