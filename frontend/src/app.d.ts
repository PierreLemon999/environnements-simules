// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Google Identity Services (GIS) types
	interface GoogleCredentialResponse {
		credential: string;
		select_by: string;
	}

	interface GooglePromptNotification {
		isNotDisplayed(): boolean;
		isSkippedMoment(): boolean;
		isDismissedMoment(): boolean;
		getNotDisplayedReason(): string;
		getSkippedReason(): string;
		getDismissedReason(): string;
	}

	interface GoogleAccountsId {
		initialize(config: {
			client_id: string;
			callback: (response: GoogleCredentialResponse) => void;
			auto_select?: boolean;
			cancel_on_tap_outside?: boolean;
		}): void;
		prompt(callback?: (notification: GooglePromptNotification) => void): void;
		renderButton(
			parent: HTMLElement,
			options: {
				theme?: 'outline' | 'filled_blue' | 'filled_black';
				size?: 'large' | 'medium' | 'small';
				text?: string;
				shape?: string;
				width?: number;
			}
		): void;
		disableAutoSelect(): void;
		revoke(hint: string, callback?: () => void): void;
	}

	declare const __APP_VERSION__: string;

	const google: {
		accounts: {
			id: GoogleAccountsId;
		};
	};
}

export {};
