// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormFieldInfo {
	selectorPath: string;
	element: HTMLElement;
	tagName: string;
	name: string;
	id: string;
	inputType: string;
	label: string;
	validation: ValidationRules;
	hasValidation: boolean;
	hasEsValidation: boolean;
}

export interface ValidationRules {
	required: boolean;
	type: string;
	pattern: string | null;
	patternTitle: string | null;
	min: string | null;
	max: string | null;
	minlength: number | null;
	maxlength: number | null;
	customMessage: string | null;
	placeholder: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORM_FIELD_SELECTOR = [
	'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
	'textarea',
	'select'
].join(', ');

const VALIDATION_ATTRS = ['required', 'pattern', 'min', 'max', 'minlength', 'maxlength'] as const;

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

export function scanFormFields(doc: Document): FormFieldInfo[] {
	const elements = doc.querySelectorAll(FORM_FIELD_SELECTOR);
	const fields: FormFieldInfo[] = [];

	elements.forEach((el) => {
		const htmlEl = el as HTMLElement;
		const validation = extractValidationRules(htmlEl);
		const hasValidation = VALIDATION_ATTRS.some((attr) => htmlEl.hasAttribute(attr));

		fields.push({
			selectorPath: buildSelectorPath(htmlEl),
			element: htmlEl,
			tagName: htmlEl.tagName.toLowerCase(),
			name: htmlEl.getAttribute('name') || '',
			id: htmlEl.id || '',
			inputType: htmlEl.getAttribute('type') || (htmlEl.tagName === 'TEXTAREA' ? 'textarea' : htmlEl.tagName === 'SELECT' ? 'select' : 'text'),
			label: findFieldLabel(htmlEl, doc),
			validation,
			hasValidation,
			hasEsValidation: htmlEl.getAttribute('data-es-validation') === 'true'
		});
	});

	return fields;
}

export function buildSelectorPath(el: HTMLElement): string {
	const parts: string[] = [];
	let current: HTMLElement | null = el;

	while (current && current !== current.ownerDocument?.body) {
		const parent = current.parentElement;
		if (!parent) break;

		const siblings = Array.from(parent.children);
		const sameTag = siblings.filter((s) => s.tagName === current!.tagName);

		let part = current.tagName.toLowerCase();
		if (sameTag.length > 1) {
			const index = sameTag.indexOf(current) + 1;
			part += `:nth-of-type(${index})`;
		}
		if (current.id) {
			part = `${current.tagName.toLowerCase()}#${current.id}`;
		}

		parts.unshift(part);
		current = parent;
	}

	parts.unshift('body');
	return parts.join(' > ');
}

export function extractValidationRules(el: HTMLElement): ValidationRules {
	const minlengthAttr = el.getAttribute('minlength');
	const maxlengthAttr = el.getAttribute('maxlength');

	return {
		required: el.hasAttribute('required'),
		type: el.getAttribute('type') || 'text',
		pattern: el.getAttribute('pattern') || null,
		patternTitle: el.getAttribute('title') || null,
		min: el.getAttribute('min') || null,
		max: el.getAttribute('max') || null,
		minlength: minlengthAttr ? parseInt(minlengthAttr, 10) : null,
		maxlength: maxlengthAttr ? parseInt(maxlengthAttr, 10) : null,
		customMessage: el.getAttribute('data-es-message') || null,
		placeholder: el.getAttribute('placeholder') || null
	};
}

export function applyValidationRules(el: HTMLElement, rules: Partial<ValidationRules>): void {
	// Required
	if (rules.required !== undefined) {
		if (rules.required) el.setAttribute('required', '');
		else el.removeAttribute('required');
	}

	// Type (only for input elements)
	if (rules.type !== undefined && el.tagName === 'INPUT') {
		el.setAttribute('type', rules.type);
	}

	// Pattern
	if (rules.pattern !== undefined) {
		if (rules.pattern) el.setAttribute('pattern', rules.pattern);
		else el.removeAttribute('pattern');
	}

	// Pattern title (validation message)
	if (rules.patternTitle !== undefined) {
		if (rules.patternTitle) el.setAttribute('title', rules.patternTitle);
		else el.removeAttribute('title');
	}

	// Min / Max
	if (rules.min !== undefined) {
		if (rules.min) el.setAttribute('min', rules.min);
		else el.removeAttribute('min');
	}
	if (rules.max !== undefined) {
		if (rules.max) el.setAttribute('max', rules.max);
		else el.removeAttribute('max');
	}

	// Minlength / Maxlength
	if (rules.minlength !== undefined) {
		if (rules.minlength !== null) el.setAttribute('minlength', String(rules.minlength));
		else el.removeAttribute('minlength');
	}
	if (rules.maxlength !== undefined) {
		if (rules.maxlength !== null) el.setAttribute('maxlength', String(rules.maxlength));
		else el.removeAttribute('maxlength');
	}

	// Custom message
	if (rules.customMessage !== undefined) {
		if (rules.customMessage) el.setAttribute('data-es-message', rules.customMessage);
		else el.removeAttribute('data-es-message');
	}

	// Placeholder
	if (rules.placeholder !== undefined) {
		if (rules.placeholder) el.setAttribute('placeholder', rules.placeholder);
		else el.removeAttribute('placeholder');
	}

	// Mark as modified by the tool
	el.setAttribute('data-es-validation', 'true');
}

export function findFieldLabel(el: HTMLElement, doc: Document): string {
	// 1. <label for="id">
	if (el.id) {
		const label = doc.querySelector(`label[for="${el.id}"]`);
		if (label?.textContent?.trim()) return label.textContent.trim();
	}

	// 2. Parent <label>
	const parentLabel = el.closest('label');
	if (parentLabel) {
		const text = parentLabel.textContent?.trim();
		if (text) return text;
	}

	// 3. aria-label
	const ariaLabel = el.getAttribute('aria-label');
	if (ariaLabel) return ariaLabel;

	// 4. aria-labelledby
	const labelledby = el.getAttribute('aria-labelledby');
	if (labelledby) {
		const refEl = doc.getElementById(labelledby);
		if (refEl?.textContent?.trim()) return refEl.textContent.trim();
	}

	// 5. placeholder
	const placeholder = el.getAttribute('placeholder');
	if (placeholder) return placeholder;

	// 6. name or id fallback
	return el.getAttribute('name') || el.id || el.tagName.toLowerCase();
}
