<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	let {
		class: className,
		inset,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { inset?: boolean; children?: import("svelte").Snippet } = $props();
</script>

<div
	class={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</div>
