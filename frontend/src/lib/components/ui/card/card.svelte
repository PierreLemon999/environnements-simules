<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	let {
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { children?: import("svelte").Snippet } = $props();
</script>

<div class={cn("rounded-lg border border-border bg-card text-card-foreground shadow-xs", className)} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</div>
