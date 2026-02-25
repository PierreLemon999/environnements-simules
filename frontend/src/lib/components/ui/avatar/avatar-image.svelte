<script lang="ts">
	import { cn } from "$lib/utils";

	let {
		class: className,
		src,
		alt = "",
		...restProps
	}: { class?: string; src?: string | null; alt?: string; [key: string]: unknown } = $props();

	let hasError = $state(false);
</script>

{#if src && !hasError}
	<img
		class={cn("aspect-square h-full w-full object-cover", className)}
		{src}
		{alt}
		onerror={() => (hasError = true)}
		{...restProps}
	/>
{/if}
