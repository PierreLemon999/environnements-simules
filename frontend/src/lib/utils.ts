import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx for conditional class names.
 * This is the standard utility used by shadcn-svelte components.
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
