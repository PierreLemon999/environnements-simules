// ---------------------------------------------------------------------------
// Validation Preview Script
// Injected transiently into the iframe in preview mode.
// Shows real-time feedback (green/red borders + inline messages) using
// native HTML5 constraint validation. Never persisted.
// ---------------------------------------------------------------------------

export const PREVIEW_SCRIPT_ID = 'es-validation-preview';
export const PREVIEW_STYLE_ID = 'es-validation-preview-styles';

export function getPreviewStylesCSS(): string {
	return `
		.es-valid {
			outline: 2px solid #10B981 !important;
			outline-offset: 1px !important;
		}
		.es-invalid {
			outline: 2px solid #EF4444 !important;
			outline-offset: 1px !important;
		}
		.es-validation-msg {
			display: block;
			font-size: 11px;
			margin-top: 4px;
			padding: 2px 6px;
			border-radius: 4px;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		}
		.es-validation-msg.es-msg-error {
			color: #DC2626;
			background: #FEF2F2;
		}
		.es-validation-msg.es-msg-success {
			color: #059669;
			background: #ECFDF5;
		}
	`;
}

export function getPreviewScript(): string {
	return `
(function() {
	const FIELD_SELECTOR = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select';

	function validateField(el) {
		// Remove previous state
		el.classList.remove('es-valid', 'es-invalid');
		var msg = el.parentElement ? el.parentElement.querySelector('.es-validation-msg') : null;
		if (msg) msg.remove();

		// Skip empty non-required fields
		if (!el.value && !el.required) return;

		// Use native checkValidity
		var valid = el.checkValidity();

		// Custom message from data-es-message
		var customMsg = el.getAttribute('data-es-message');

		if (valid) {
			el.classList.add('es-valid');
			if (el.value) {
				var successMsg = document.createElement('span');
				successMsg.className = 'es-validation-msg es-msg-success';
				successMsg.textContent = '\\u2713 Valide';
				el.parentElement.insertBefore(successMsg, el.nextSibling);
			}
		} else {
			el.classList.add('es-invalid');
			var errorMsg = document.createElement('span');
			errorMsg.className = 'es-validation-msg es-msg-error';
			errorMsg.textContent = customMsg || el.validationMessage || 'Valeur invalide';
			el.parentElement.insertBefore(errorMsg, el.nextSibling);
		}
	}

	// Attach listeners
	var fields = document.querySelectorAll(FIELD_SELECTOR);
	fields.forEach(function(el) {
		el.addEventListener('input', function() { validateField(el); });
		el.addEventListener('blur', function() { validateField(el); });
	});

	// Intercept form submit
	document.querySelectorAll('form').forEach(function(form) {
		form.addEventListener('submit', function(e) {
			e.preventDefault();
			e.stopPropagation();
			var formFields = form.querySelectorAll(FIELD_SELECTOR);
			formFields.forEach(function(el) { validateField(el); });
		}, true);
	});
})();
	`.trim();
}

export function injectPreviewMode(doc: Document): void {
	// Inject styles
	if (!doc.getElementById(PREVIEW_STYLE_ID)) {
		const style = doc.createElement('style');
		style.id = PREVIEW_STYLE_ID;
		style.textContent = getPreviewStylesCSS();
		doc.head.appendChild(style);
	}

	// Inject script
	if (!doc.getElementById(PREVIEW_SCRIPT_ID)) {
		const script = doc.createElement('script');
		script.id = PREVIEW_SCRIPT_ID;
		script.setAttribute('data-es-injected', 'true');
		script.textContent = getPreviewScript();
		doc.body.appendChild(script);
	}
}

export function removePreviewMode(doc: Document): void {
	// Remove styles
	const style = doc.getElementById(PREVIEW_STYLE_ID);
	if (style) style.remove();

	// Remove script
	const script = doc.getElementById(PREVIEW_SCRIPT_ID);
	if (script) script.remove();

	// Remove visual classes and inline messages
	doc.querySelectorAll('.es-valid, .es-invalid').forEach((el) => {
		el.classList.remove('es-valid', 'es-invalid');
	});
	doc.querySelectorAll('.es-validation-msg').forEach((el) => el.remove());
}
