import { mount } from 'svelte';
import App from '../popup/App.svelte';
import './app.css';

const app = mount(App, {
	target: document.getElementById('app')!
});

// Dev hot-reload: poll hot-reload.json and reload sidepanel when rebuild is detected
if (import.meta.env.MODE === 'development') {
	let lastTs = '';
	setInterval(async () => {
		try {
			const url = chrome.runtime.getURL('hot-reload.json') + '?t=' + Date.now();
			const res = await fetch(url);
			const { ts } = await res.json();
			if (lastTs && ts !== lastTs) {
				location.reload();
				return;
			}
			lastTs = ts;
		} catch {
			// Extension reloading or file not ready yet
		}
	}, 1000);
}

export default app;
