export const API_BASE_URL = 'http://localhost:3001/api';
export const BACKOFFICE_URL = 'http://localhost:5173';

export const STORAGE_KEYS = {
	AUTH_TOKEN: 'auth_token',
	USER: 'user',
	ACTIVE_PROJECT: 'active_project',
	ACTIVE_VERSION: 'active_version',
	CAPTURE_MODE: 'capture_mode',
	CAPTURE_STATE: 'capture_state',
	VERSION_OUTDATED: 'version_outdated'
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
	logoUrl?: string | null;
	iconColor?: string | null;
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
	pageType?: 'page' | 'modal' | 'spa_state';
	parentPageLocalId?: string;
	domFingerprint?: string;
	syntheticUrl?: string;
	captureTimingMs?: number;
}

export interface LLGuide {
	id: string;
	name: string;
	stepCount: number;
	selected: boolean;
}

export interface GuidedProgress {
	currentGuideIndex: number;
	totalGuides: number;
	currentGuideName: string;
	currentStepIndex: number;
	totalSteps: number;
	executionMode: 'manual' | 'auto';
	capturedPages: number;
	status: 'waiting_bubble' | 'capturing' | 'advancing' | 'idle' | 'done';
}

export interface CaptureState {
	mode: CaptureMode;
	isRunning: boolean;
	isPaused: boolean;
	jobId?: string;
	pages: CapturedPage[];
	targetPageCount: number;
	captureStrategy?: 'url_based' | 'fingerprint_based';
	transitions: TransitionRecord[];
	lastCapturedPageLocalId?: string;
	guided?: GuidedProgress;
}

export interface TransitionRecord {
	id: string;
	sourcePageLocalId: string;
	targetPageLocalId: string;
	triggerType: 'click' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange' | 'manual';
	triggerSelector?: string;
	triggerText?: string;
	loadingTimeMs?: number;
	hadLoadingIndicator: boolean;
	loadingIndicatorType?: string;
}

export const CAPTURE_STRATEGIES = {
	URL_BASED: 'url_based',
	FINGERPRINT_BASED: 'fingerprint_based'
} as const;

export type CaptureStrategy = (typeof CAPTURE_STRATEGIES)[keyof typeof CAPTURE_STRATEGIES];
