export const API_BASE_URL = 'http://localhost:3001/api';

export const STORAGE_KEYS = {
	AUTH_TOKEN: 'auth_token',
	USER: 'user',
	ACTIVE_PROJECT: 'active_project',
	ACTIVE_VERSION: 'active_version',
	CAPTURE_MODE: 'capture_mode',
	CAPTURE_STATE: 'capture_state',
	MHTML_DEBUG: 'mhtml_debug'
} as const;

export const CAPTURE_MODES = {
	FREE: 'free',
	GUIDED: 'guided',
	AUTO: 'auto'
} as const;

export type CaptureMode = (typeof CAPTURE_MODES)[keyof typeof CAPTURE_MODES];

export const PAGE_STATUS = {
	PENDING: 'pending',
	CAPTURING: 'capturing',
	UPLOADING: 'uploading',
	DONE: 'done',
	ERROR: 'error'
} as const;

export type PageStatus = (typeof PAGE_STATUS)[keyof typeof PAGE_STATUS];

export interface User {
	id: string;
	name: string;
	email: string;
	role: 'admin' | 'client';
	avatarUrl?: string;
	language?: string;
}

export interface Project {
	id: string;
	name: string;
	toolName: string;
	subdomain: string;
	description?: string;
	versionCount: number;
	pageCount: number;
}

export interface Version {
	id: string;
	projectId: string;
	name: string;
	status: string;
	language: string;
	pageCount?: number;
}

export interface CapturedPage {
	id: string;
	localId: string;
	title: string;
	url: string;
	urlPath?: string;
	fileSize: number;
	status: PageStatus;
	error?: string;
	capturedAt: string;
}

export interface LLGuide {
	id: string;
	name: string;
	stepCount: number;
	selected: boolean;
}

export interface GuidedCaptureState {
	playerDetected: boolean;
	guides: LLGuide[];
	scanning: boolean;
	capturing: boolean;
	currentGuideIndex: number;
	currentStepIndex: number;
	executionMode: 'manual' | 'auto';
}

export interface CaptureState {
	mode: CaptureMode;
	isRunning: boolean;
	isPaused: boolean;
	jobId?: string;
	pages: CapturedPage[];
	targetPageCount: number;
}
