/**
 * Detect whether we're running in the side panel or the popup.
 */
export function isSidePanel(): boolean {
	return window.location.pathname.includes('sidepanel');
}

export function isPopup(): boolean {
	return !isSidePanel();
}
