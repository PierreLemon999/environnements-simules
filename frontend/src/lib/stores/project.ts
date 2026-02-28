/**
 * Project store — manages the globally selected project and version.
 *
 * Uses Svelte writable/derived stores so any component can subscribe
 * reactively. Selected project ID is persisted in localStorage.
 */

import { writable, derived, get as getStore } from 'svelte/store';
import { browser } from '$app/environment';
import { get } from '$lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectSummary {
	id: string;
	name: string;
	toolName: string;
	subdomain: string;
	description: string | null;
	logoUrl: string | null;
	iconColor: string | null;
	createdAt: string;
	updatedAt: string;
	versionCount: number;
	pageCount: number;
}

export interface Version {
	id: string;
	name: string;
	status: string;
	projectId: string;
	language: string;
	createdAt: string;
	pageCount?: number;
}

// ---------------------------------------------------------------------------
// Internal stores
// ---------------------------------------------------------------------------

const _projects = writable<ProjectSummary[]>([]);
const _selectedProjectId = writable<string | null>(null);
const _versions = writable<Version[]>([]);
const _selectedVersionId = writable<string | null>(null);
const _loading = writable(false);

const STORAGE_KEY = 'selected-project-id';

// ---------------------------------------------------------------------------
// Public derived stores
// ---------------------------------------------------------------------------

export const projects = derived(_projects, ($p) => $p);
export const selectedProjectId = derived(_selectedProjectId, ($id) => $id);
export const projectsLoading = derived(_loading, ($l) => $l);

export const selectedProject = derived(
	[_projects, _selectedProjectId],
	([$projects, $id]) => $projects.find((p) => p.id === $id) ?? null
);

export const versions = derived(_versions, ($v) => $v);
export const selectedVersionId = derived(_selectedVersionId, ($id) => $id);

export const selectedVersion = derived(
	[_versions, _selectedVersionId],
	([$versions, $id]) => $versions.find((v) => v.id === $id) ?? null
);

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function sortProjects(items: ProjectSummary[]): ProjectSummary[] {
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
	const cutoff = sixMonthsAgo.toISOString();

	return [...items].sort((a, b) => {
		const aRecent = a.updatedAt >= cutoff;
		const bRecent = b.updatedAt >= cutoff;

		if (aRecent && bRecent) return b.updatedAt.localeCompare(a.updatedAt);
		if (aRecent && !bRecent) return -1;
		if (!aRecent && bRecent) return 1;
		return b.pageCount - a.pageCount;
	});
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Read selectedProjectId from localStorage on app start. */
export function initFromStorage(): void {
	if (!browser) return;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) _selectedProjectId.set(stored);
}

/** Fetch all projects, sort them, and auto-select if needed. */
export async function loadProjects(): Promise<void> {
	_loading.set(true);
	try {
		const res = await get<{ data: ProjectSummary[] }>('/projects');
		const sorted = sortProjects(res.data);
		_projects.set(sorted);

		const currentId = getStore(_selectedProjectId);
		const valid = currentId && sorted.some((p) => p.id === currentId);

		if (!valid && sorted.length > 0) {
			_selectedProjectId.set(sorted[0].id);
			if (browser) localStorage.setItem(STORAGE_KEY, sorted[0].id);
		}

		// Load versions for the selected project
		await loadVersions();
	} catch {
		// Silently fail — sidebar will show empty
	} finally {
		_loading.set(false);
	}
}

/** Select a project — persists to localStorage and loads its versions. */
export async function selectProject(projectId: string): Promise<void> {
	_selectedProjectId.set(projectId);
	if (browser) localStorage.setItem(STORAGE_KEY, projectId);
	await loadVersions();
}

/** Fetch versions for the currently selected project, auto-select active. */
export async function loadVersions(): Promise<void> {
	const projectId = getStore(_selectedProjectId);
	if (!projectId) {
		_versions.set([]);
		_selectedVersionId.set(null);
		return;
	}

	try {
		const res = await get<{ data: { versions: Version[] } }>(`/projects/${projectId}`);
		const versionList = res.data.versions ?? [];
		_versions.set(versionList);

		// Auto-select: prefer active version, then first available
		const active = versionList.find((v) => v.status === 'active');
		_selectedVersionId.set(active?.id ?? versionList[0]?.id ?? null);
	} catch {
		_versions.set([]);
		_selectedVersionId.set(null);
	}
}

/** Directly select a version (no refetch). */
export function selectVersion(versionId: string): void {
	_selectedVersionId.set(versionId);
}

/**
 * Set versions directly from already-fetched data.
 * Avoids a redundant API call when the project detail page
 * has already loaded the project with its versions.
 */
export function setVersionsFromData(projectId: string, versionList: Version[]): void {
	_selectedProjectId.set(projectId);
	if (browser) localStorage.setItem(STORAGE_KEY, projectId);
	_versions.set(versionList);

	// Auto-select: prefer active version, then first available
	const current = getStore(_selectedVersionId);
	const stillValid = current && versionList.some((v) => v.id === current);
	if (!stillValid) {
		const active = versionList.find((v) => v.status === 'active');
		_selectedVersionId.set(active?.id ?? versionList[0]?.id ?? null);
	}
}
