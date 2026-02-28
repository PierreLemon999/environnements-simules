import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	server: {
		port: 5173,
		proxy: {
			// Proxy API calls to the Express backend during development
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				secure: false
			},
			// Proxy demo page serving to the Express backend
			'/demo-api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				secure: false,
				rewrite: (path: string) => path.replace(/^\/demo-api/, '/demo')
			},
			// Proxy uploads to backend
			'/uploads': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				secure: false
			}
		}
	}
});
