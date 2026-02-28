/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				/* --- Neutral (bluish grays from Lemon Learning DS) --- */
				gray: {
					50: '#F7F7F8',
					100: '#F0F1F2',
					200: '#E2E3E6',
					300: '#D3D5D9',
					400: '#B6BAC0',
					500: '#9197A0',
					600: '#6D7481',
					700: '#485261',
					800: '#242F42',
					900: '#1E2737'
				},

				/* --- Semantic tokens --- */
				border: '#E2E3E6',
				input: '#F0F1F2',
				ring: '#2B72EE',
				background: '#F7F7F8',
				foreground: '#242F42',
				primary: {
					DEFAULT: '#2B72EE',
					foreground: '#FFFFFF',
					hover: '#245FC6',
					light: '#71A4FA'
				},
				secondary: {
					DEFAULT: '#485261',
					foreground: '#FFFFFF'
				},
				muted: {
					DEFAULT: '#9197A0',
					foreground: '#6D7481'
				},
				accent: {
					DEFAULT: '#E3EDFE',
					foreground: '#2B72EE'
				},
				card: {
					DEFAULT: '#ffffff',
					foreground: '#242F42'
				},
				sidebar: {
					DEFAULT: '#F7F7F8'
				},
				success: {
					DEFAULT: '#10B981',
					bg: '#ECFDF5',
					border: '#A7F3D0'
				},
				warning: {
					DEFAULT: '#F18E2A',
					bg: '#FDF6EF',
					border: '#F8C694'
				},
				destructive: {
					DEFAULT: '#F1362A',
					bg: '#FEF0EF',
					border: '#FCA5A0'
				},
				purple: {
					DEFAULT: '#7c3aed',
					bg: '#f5f3ff',
					border: '#ddd6fe'
				},
				yellow: {
					DEFAULT: '#FAE100',
					light: '#FFF496',
					bg: '#FFFBD5',
					dark: '#D4C326'
				},

				/* --- Lemon Learning blue palette --- */
				ll: {
					50: '#E3EDFE',
					100: '#D5E3FC',
					200: '#B8D0F9',
					300: '#95B8F6',
					400: '#72A1F4',
					500: '#4E89F1',
					600: '#2B72EE',
					700: '#245FC6',
					800: '#1D4C9F',
					900: '#153977'
				}
			},
			fontFamily: {
				sans: ['Albert Sans', 'system-ui', '-apple-system', 'sans-serif'],
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
				'fade-in': 'fadeIn 0.3s ease both',
				'slide-in': 'slideIn 0.3s ease both',
				'pulse-dot': 'pulseDot 2s ease-in-out infinite',
				'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite'
			},
			keyframes: {
				fadeUp: {
					from: { opacity: '0', transform: 'translateY(8px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				fadeIn: {
					from: { opacity: '0' },
					to: { opacity: '1' }
				},
				slideIn: {
					from: { opacity: '0', transform: 'translateX(-8px)' },
					to: { opacity: '1', transform: 'translateX(0)' }
				},
				pulseDot: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.4' }
				},
				bounceSubtle: {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(4px)' }
				}
			}
		}
	},
	plugins: []
};
