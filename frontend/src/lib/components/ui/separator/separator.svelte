<script lang="ts">
	import { cn } from "$lib/utils";

	let {
		class: className,
		orientation = "horizontal",
		...restProps
	}: { class?: string; orientation?: "horizontal" | "vertical"; [key: string]: unknown } = $props();
</script>

<div
	role="separator"
	aria-orientation={orientation}
	class={cn(
		"shrink-0 bg-border",
		orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
		className
	)}
	{...restProps}
></div>
