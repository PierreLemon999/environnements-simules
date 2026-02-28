import { writable, derived, get } from 'svelte/store';
import { fr } from './locales/fr';

export type Locale = 'fr' | 'en' | 'de' | 'es';
export type TranslationKeys = keyof typeof fr;

export const SUPPORTED_LOCALES: { value: Locale; label: string }[] = [
	{ value: 'fr', label: 'Français' },
	{ value: 'en', label: 'English' },
	{ value: 'de', label: 'Deutsch' },
	{ value: 'es', label: 'Español' }
];

const translations: Record<Locale, Record<string, string>> = {
	fr,
	en: fr, // placeholder — will be replaced by real translations
	de: fr,
	es: fr
};

function loadLocaleFiles() {
	import('./locales/en').then((m) => (translations.en = m.en));
	import('./locales/de').then((m) => (translations.de = m.de));
	import('./locales/es').then((m) => (translations.es = m.es));
}

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('locale') : null;
export const locale = writable<Locale>((stored as Locale) || 'fr');

// Load non-FR locales lazily
if (typeof window !== 'undefined') {
	loadLocaleFiles();
}

export const T = derived(locale, ($locale) => {
	const dict = translations[$locale] || translations.fr;
	return (key: TranslationKeys, params?: Record<string, string | number>): string => {
		let text = dict[key] ?? translations.fr[key] ?? key;
		if (params) {
			for (const [k, v] of Object.entries(params)) {
				text = text.replaceAll(`{${k}}`, String(v));
			}
		}
		return text;
	};
});

/** Imperative translation (for use outside templates, e.g. toasts) */
export function t(key: TranslationKeys, params?: Record<string, string | number>): string {
	const $locale = get(locale);
	const dict = translations[$locale] || translations.fr;
	let text = dict[key] ?? translations.fr[key] ?? key;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			text = text.replaceAll(`{${k}}`, String(v));
		}
	}
	return text;
}

export function setLocale(l: Locale) {
	locale.set(l);
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('locale', l);
	}
	if (typeof document !== 'undefined') {
		document.documentElement.lang = l;
	}
}

const DATE_LOCALES: Record<Locale, string> = {
	fr: 'fr-FR',
	en: 'en-US',
	de: 'de-DE',
	es: 'es-ES'
};

/** Returns the Intl locale string for the current locale */
export function getDateLocale(): string {
	return DATE_LOCALES[get(locale)] || 'fr-FR';
}
