/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				border: '#e7e5e4',
				input: '#f5f5f4',
				ring: '#2563eb',
				background: '#f8f8f8',
				foreground: '#0c0a09',
				primary: {
					DEFAULT: '#2563eb',
					foreground: '#fafaf9',
					hover: '#1d4ed8'
				},
				secondary: {
					DEFAULT: '#57534e',
					foreground: '#fafaf9'
				},
				muted: {
					DEFAULT: '#a8a29e',
					foreground: '#57534e'
				},
				accent: {
					DEFAULT: '#eff6ff',
					foreground: '#2563eb'
				},
				card: {
					DEFAULT: '#ffffff',
					foreground: '#0c0a09'
				},
				sidebar: {
					DEFAULT: '#fafaf9'
				},
				success: {
					DEFAULT: '#16a34a',
					bg: '#f0fdf4',
					border: '#bbf7d0'
				},
				warning: {
					DEFAULT: '#d97706',
					bg: '#fffbeb',
					border: '#fde68a'
				},
				destructive: {
					DEFAULT: '#dc2626',
					bg: '#fef2f2',
					border: '#fecaca'
				},
				purple: {
					DEFAULT: '#7c3aed',
					bg: '#f5f3ff',
					border: '#ddd6fe'
				}
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
				mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace']
			},
			borderRadius: {
				xs: '4px',
				sm: '6px',
				DEFAULT: '8px',
				md: '10px',
				lg: '12px'
			},
			boxShadow: {
				xs: '0 1px 2px rgba(0,0,0,.04)',
				sm: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
				DEFAULT: '0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -2px rgba(0,0,0,.05)',
				md: '0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.04)',
				lg: '0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.04)'
			},
			animation: {
				'fade-up': 'fadeUp 0.5s ease both',
				'slide-in': 'slideIn 0.3s ease both',
				'pulse-dot': 'pulseDot 2s ease-in-out infinite'
			},
			keyframes: {
				fadeUp: {
					from: { opacity: '0', transform: 'translateY(8px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				slideIn: {
					from: { opacity: '0', transform: 'translateX(-8px)' },
					to: { opacity: '1', transform: 'translateX(0)' }
				},
				pulseDot: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.4' }
				}
			}
		}
	},
	plugins: []
};
