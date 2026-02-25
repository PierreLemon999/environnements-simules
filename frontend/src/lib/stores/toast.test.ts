import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { toasts, toast } from './toast';

beforeEach(() => {
	// Clear all toasts before each test
	const current = get(toasts);
	current.forEach((t) => toast.remove(t.id));
	vi.useFakeTimers();
});

describe('Toast store', () => {
	it('adds a success toast', () => {
		toast.success('Operation succeeded');
		const list = get(toasts);
		expect(list).toHaveLength(1);
		expect(list[0].type).toBe('success');
		expect(list[0].message).toBe('Operation succeeded');
	});

	it('adds an error toast with longer default duration', () => {
		toast.error('Something failed');
		const list = get(toasts);
		expect(list).toHaveLength(1);
		expect(list[0].type).toBe('error');
		expect(list[0].duration).toBe(6000);
	});

	it('adds warning and info toasts', () => {
		toast.warning('Be careful');
		toast.info('FYI');
		const list = get(toasts);
		expect(list).toHaveLength(2);
		expect(list[0].type).toBe('warning');
		expect(list[1].type).toBe('info');
	});

	it('removes a toast by id', () => {
		toast.success('First');
		toast.success('Second');
		const before = get(toasts);
		expect(before).toHaveLength(2);

		toast.remove(before[0].id);
		const after = get(toasts);
		expect(after).toHaveLength(1);
		expect(after[0].message).toBe('Second');
	});

	it('auto-removes toast after duration', () => {
		toast.success('Auto-remove', 1000);
		expect(get(toasts)).toHaveLength(1);

		vi.advanceTimersByTime(1000);
		expect(get(toasts)).toHaveLength(0);
	});

	it('generates unique ids for each toast', () => {
		toast.success('A');
		toast.success('B');
		toast.success('C');
		const list = get(toasts);
		const ids = list.map((t) => t.id);
		expect(new Set(ids).size).toBe(3);
	});
});
