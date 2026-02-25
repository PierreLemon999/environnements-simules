<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";
	import DialogOverlay from "./dialog-overlay.svelte";
	import { X } from "lucide-svelte";

	let {
		class: className,
		children,
		...restProps
	}: DialogPrimitive.ContentProps & { children?: import("svelte").Snippet } = $props();
</script>

<DialogPrimitive.Portal>
	<DialogOverlay />
	<DialogPrimitive.Content
		class={cn(
			"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-6 shadow-lg rounded-lg",
			className
		)}
		{...restProps}
	>
		{#if children}
			{@render children()}
		{/if}
		<DialogPrimitive.Close
			class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
		>
			<X class="h-4 w-4" />
			<span class="sr-only">Fermer</span>
		</DialogPrimitive.Close>
	</DialogPrimitive.Content>
</DialogPrimitive.Portal>
