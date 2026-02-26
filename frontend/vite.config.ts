import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
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
