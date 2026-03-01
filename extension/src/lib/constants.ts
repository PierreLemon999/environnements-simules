export const API_BASE_URL = 'http://localhost:3001/api';
export const BACKOFFICE_URL = 'http://localhost:5173';

export const STORAGE_KEYS = {
	AUTH_TOKEN: 'auth_token',
	USER: 'user',
	ACTIVE_PROJECT: 'active_project',
	ACTIVE_VERSION: 'active_version',
	CAPTURE_MODE: 'capture_mode',
	CAPTURE_STATE: 'capture_state',
	VERSION_OUTDATED: 'version_outdated',
	SCANNED_GUIDES: 'scanned_guides'
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
	guideName?: string;
	captureVariant?: 'clean' | 'annotated';
	guideStepIndex?: number;
	runIndex?: number;
	runLabel?: string;
}

// ---------------------------------------------------------------------------
// LL Guide data — enriched from React Query cache
// ---------------------------------------------------------------------------

export const LL_STEP_TYPES = {
	REGULAR: 'regular',
	INTRO: 'intro',
	OUTRO: 'outro',
	QUESTION: 'question',
	CONDITION: 'condition',
	VARIABLE: 'variable',
	AUTO: 'auto',
	SUBGUIDE: 'subguide'
} as const;

export type LLStepType = (typeof LL_STEP_TYPES)[keyof typeof LL_STEP_TYPES];

export const LL_TRIGGER_TYPES = {
	NEXT: 'NEXT',
	CLICK: 'CLICK',
	INPUT: 'INPUT',
	CHANGE: 'CHANGE',
	APPEAR: 'APPEAR',
	DISAPPEAR: 'DISAPPEAR',
	WAIT: 'WAIT',
	MULTIPAGE: 'MULTIPAGE',
	HOVER: 'HOVER',
	MOUSEDOWN: 'MOUSEDOWN'
} as const;

export type LLTriggerType = (typeof LL_TRIGGER_TYPES)[keyof typeof LL_TRIGGER_TYPES];

export interface LLQuestionAnswer {
	id: number;
	title: string;
}

export interface LLQuestion {
	id: number;
	answers: LLQuestionAnswer[];
}

export interface LLConditionBranch {
	id: number;
	conditionType: string; // 'question', 'element_exists', 'url_contains', etc.
	conditionContent: string; // JSON string with condition details
	nextStep: number | null;
	name: string | null;
}

export interface LLGuideStep {
	id: number;
	stepType: LLStepType;
	triggers: Array<{ type: LLTriggerType; option?: string }>;
	targetPaths?: unknown; // LL Player's "paths" object used by TargetAdapter
	nextStep: number | null;
	isFirst: boolean;
	previousEnabled: boolean;
	title?: string;
	content?: string;
	stepKey?: string; // Identifier for linking questions to conditions
	question?: LLQuestion; // Question data with answer options
	conditions?: LLConditionBranch[]; // Condition branches for branching steps
}

export interface RunPlan {
	answers: Record<string, number>; // stepKey → answerIndex
	label: string; // e.g. "Q1=Oui, Q2=Option A"
}

export interface LLGuideData {
	id: string;
	name: string;
	steps: LLGuideStep[];
	stepCount: number;
	sectionName?: string;
}

export interface LLGuide {
	id: string;
	name: string;
	stepCount: number;
	selected: boolean;
	steps?: LLGuideStep[];
	sectionName?: string;
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
	runIndex?: number; // Current run index (0-based) for multi-branch capture
	totalRuns?: number; // Total runs planned for current guide
	runLabel?: string; // Human-readable label for current run
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

// ---------------------------------------------------------------------------
// LL Player Bridge — Step action types for guided capture
// ---------------------------------------------------------------------------

export const STEP_ACTION_TYPES = {
	NEXT: 'next',
	CLICK: 'click',
	INPUT: 'input',
	CHECKBOX: 'checkbox',
	UNKNOWN: 'unknown'
} as const;

export type StepActionType = (typeof STEP_ACTION_TYPES)[keyof typeof STEP_ACTION_TYPES];

export interface StepActionInfo {
	actionType: StepActionType;
	targetSelector?: string;
	targetTagName?: string;
	hasNextButton: boolean;
	debugInfo?: string;
	instructionText?: string;
}
