/**
 * Toast notification store — provides a simple queue-based toast system.
 */

import { writable, derived } from 'svelte/store';

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	message: string;
	duration: number;
}

const _toasts = writable<Toast[]>([]);

export const toasts = derived(_toasts, ($t) => $t);

let counter = 0;

function addToast(type: Toast['type'], message: string, duration = 4000): void {
	const id = `toast-${++counter}`;
	const toast: Toast = { id, type, message, duration };

	_toasts.update((t) => [...t, toast]);

	if (duration > 0) {
		setTimeout(() => {
			removeToast(id);
		}, duration);
	}
}

function removeToast(id: string): void {
	_toasts.update((t) => t.filter((toast) => toast.id !== id));
}

export const toast = {
	success: (message: string, duration?: number) => addToast('success', message, duration),
	error: (message: string, duration?: number) => addToast('error', message, duration ?? 6000),
	warning: (message: string, duration?: number) => addToast('warning', message, duration),
	info: (message: string, duration?: number) => addToast('info', message, duration),
	remove: removeToast,
};
