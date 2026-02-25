<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		class: className,
		sideOffset = 4,
		children,
		...restProps
	}: TooltipPrimitive.ContentProps & { children?: import("svelte").Snippet } = $props();
</script>

<TooltipPrimitive.Portal>
	<TooltipPrimitive.Content
		{sideOffset}
		class={cn(
			"z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95",
			className
		)}
		{...restProps}
	>
		{#if children}
			{@render children()}
		{/if}
	</TooltipPrimitive.Content>
</TooltipPrimitive.Portal>
