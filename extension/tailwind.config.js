/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				primary: '#2B72EE',
				success: '#10B981',
				error: '#F1362A',
				warning: '#F18E2A'
			}
		}
	},
	plugins: []
};
