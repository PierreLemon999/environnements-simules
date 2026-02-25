import { type VariantProps, tv } from "tailwind-variants";
import Badge from "./badge.svelte";

const badgeVariants = tv({
	base: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
	variants: {
		variant: {
			default: "border-transparent bg-primary text-primary-foreground",
			secondary: "border-transparent bg-accent text-accent-foreground",
			destructive: "border-transparent bg-destructive text-white",
			outline: "text-foreground",
			success: "border-success-border bg-success-bg text-success",
			warning: "border-warning-border bg-warning-bg text-warning",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

type Variant = VariantProps<typeof badgeVariants>["variant"];

export { Badge, badgeVariants, type Variant as BadgeVariant };
