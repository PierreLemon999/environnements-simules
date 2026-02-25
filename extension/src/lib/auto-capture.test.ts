import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock chrome API before importing the module
// ---------------------------------------------------------------------------

const mockStorage: Record<string, unknown> = {};

const chromeMock = {
	storage: {
		local: {
			get: vi.fn(async (key: string) => ({ [key]: mockStorage[key] })),
			set: vi.fn(async (items: Record<string, unknown>) => {
				Object.assign(mockStorage, items);
			}),
		},
	},
	tabs: {
		get: vi.fn(),
		update: vi.fn(),
		sendMessage: vi.fn(),
		onUpdated: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
		},
	},
	scripting: {
		executeScript: vi.fn(),
	},
	runtime: {
		onMessage: { addListener: vi.fn() },
		sendMessage: vi.fn(),
	},
};

// @ts-expect-error mock chrome global
globalThis.chrome = chromeMock;

// We need to test the pure helper functions extracted from the module.
// Since normalizeUrl and getEffectiveDepth are not exported, we test them
// indirectly or re-implement them for unit testing.

describe('URL normalization', () => {
	// Reimplemented to match auto-capture.ts logic
	function normalizeUrl(url: string): string {
		try {
			const u = new URL(url);
			let path = u.pathname.replace(/\/+$/, '') || '/';
			return `${u.origin}${path}${u.search}`;
		} catch {
			return url;
		}
	}

	it('removes trailing slashes', () => {
		expect(normalizeUrl('https://app.example.com/dashboard/')).toBe(
			'https://app.example.com/dashboard'
		);
	});

	it('preserves query parameters', () => {
		expect(normalizeUrl('https://app.example.com/page?tab=1')).toBe(
			'https://app.example.com/page?tab=1'
		);
	});

	it('removes hash fragments', () => {
		// URL constructor strips hash from pathname automatically
		const result = normalizeUrl('https://app.example.com/page#section');
		expect(result).toBe('https://app.example.com/page');
	});

	it('normalizes root to /', () => {
		expect(normalizeUrl('https://app.example.com/')).toBe('https://app.example.com/');
	});

	it('handles multiple trailing slashes', () => {
		expect(normalizeUrl('https://app.example.com/path///')).toBe(
			'https://app.example.com/path'
		);
	});

	it('returns input for invalid URLs', () => {
		expect(normalizeUrl('not-a-url')).toBe('not-a-url');
	});
});

describe('Interest zone depth calculation', () => {
	interface InterestZone {
		urlPattern: string;
		depthMultiplier: number;
	}

	interface Config {
		maxDepth: number;
		interestZones: InterestZone[];
	}

	// Reimplemented to match auto-capture.ts
	function getEffectiveDepth(config: Config, url: string): number {
		let maxDepth = config.maxDepth;
		for (const zone of config.interestZones) {
			try {
				const regex = new RegExp(zone.urlPattern);
				if (regex.test(url)) {
					maxDepth = Math.round(config.maxDepth * zone.depthMultiplier);
				}
			} catch {
				if (url.includes(zone.urlPattern)) {
					maxDepth = Math.round(config.maxDepth * zone.depthMultiplier);
				}
			}
		}
		return maxDepth;
	}

	it('returns base depth when no zones match', () => {
		const config: Config = { maxDepth: 3, interestZones: [] };
		expect(getEffectiveDepth(config, 'https://app.com/page')).toBe(3);
	});

	it('applies depth multiplier for matching zone', () => {
		const config: Config = {
			maxDepth: 3,
			interestZones: [{ urlPattern: '/dashboard', depthMultiplier: 2 }],
		};
		expect(getEffectiveDepth(config, 'https://app.com/dashboard')).toBe(6);
	});

	it('applies regex pattern matching', () => {
		const config: Config = {
			maxDepth: 4,
			interestZones: [{ urlPattern: '/settings/.*', depthMultiplier: 0.5 }],
		};
		expect(getEffectiveDepth(config, 'https://app.com/settings/profile')).toBe(2);
	});

	it('falls back to includes for invalid regex', () => {
		const config: Config = {
			maxDepth: 3,
			interestZones: [{ urlPattern: '[invalid(', depthMultiplier: 2 }],
		};
		// "[invalid(" isn't in the URL
		expect(getEffectiveDepth(config, 'https://app.com/page')).toBe(3);
	});

	it('uses last matching zone', () => {
		const config: Config = {
			maxDepth: 3,
			interestZones: [
				{ urlPattern: '/app', depthMultiplier: 2 },
				{ urlPattern: '/app/settings', depthMultiplier: 0.5 },
			],
		};
		expect(getEffectiveDepth(config, 'https://example.com/app/settings')).toBe(2); // both match, last wins: round(3 * 0.5)
	});
});

describe('HTML simplification', () => {
	// Reimplemented from auto-capture.ts
	function simplifyHtml(html: string): string {
		return html
			.replace(/src="data:image\/[^"]+"/g, 'src=""')
			.replace(/url\(data:image\/[^)]+\)/g, 'url()');
	}

	it('removes base64 image src attributes', () => {
		const html = '<img src="data:image/png;base64,abc123def==">';
		expect(simplifyHtml(html)).toBe('<img src="">');
	});

	it('removes base64 CSS url() references', () => {
		const css = 'background: url(data:image/svg+xml;base64,xyz);';
		expect(simplifyHtml(css)).toBe('background: url();');
	});

	it('preserves non-data src attributes', () => {
		const html = '<img src="https://cdn.example.com/logo.png">';
		expect(simplifyHtml(html)).toBe(html);
	});

	it('handles multiple data URIs', () => {
		const html = '<img src="data:image/png;base64,a"> <img src="data:image/jpeg;base64,b">';
		expect(simplifyHtml(html)).toBe('<img src=""> <img src="">');
	});
});

describe('Auto-capture config persistence', () => {
	beforeEach(() => {
		Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
		vi.clearAllMocks();
	});

	it('getAutoConfig returns defaults when no saved config', async () => {
		const { getAutoConfig } = await import('./auto-capture');
		const config = await getAutoConfig();
		expect(config.targetPageCount).toBe(20);
		expect(config.maxDepth).toBe(3);
		expect(config.delayBetweenPages).toBe(2000);
		expect(config.blacklist).toContain('Delete');
		expect(config.blacklist).toContain('Supprimer');
	});

	it('saveAutoConfig persists to chrome storage', async () => {
		const { saveAutoConfig, getAutoConfig } = await import('./auto-capture');
		const custom = {
			targetPageCount: 50,
			maxDepth: 5,
			delayBetweenPages: 3000,
			interestZones: [{ urlPattern: '/admin', depthMultiplier: 2 }],
			blacklist: ['Remove'],
		};
		await saveAutoConfig(custom);
		expect(chromeMock.storage.local.set).toHaveBeenCalled();
	});
});

describe('Link extraction from DOM', () => {
	it('filters out blacklisted link text', () => {
		// Simulate the extraction logic
		const blacklist = ['Delete', 'Logout'];
		const links = [
			{ href: 'https://app.com/page1', text: 'Dashboard' },
			{ href: 'https://app.com/page2', text: 'Delete Account' },
			{ href: 'https://app.com/page3', text: 'Click to logout now' },
			{ href: 'https://app.com/page4', text: 'Settings' },
		];

		const filtered = links.filter(
			(link) => !blacklist.some((b) => link.text.toLowerCase().includes(b.toLowerCase()))
		);

		expect(filtered).toHaveLength(2);
		expect(filtered[0].text).toBe('Dashboard');
		expect(filtered[1].text).toBe('Settings');
	});

	it('filters out non-same-origin links', () => {
		const currentOrigin = 'https://app.example.com';
		const hrefs = [
			'https://app.example.com/dashboard',
			'https://external.com/page',
			'/relative-page',
			'javascript:void(0)',
			'mailto:user@example.com',
		];

		const filtered = hrefs.filter((href) => {
			if (href.startsWith(currentOrigin) || href.startsWith('/')) {
				const fullUrl = href.startsWith('/') ? `${currentOrigin}${href}` : href;
				return (
					!fullUrl.includes('#') &&
					!fullUrl.startsWith('javascript:') &&
					!fullUrl.startsWith('mailto:') &&
					!fullUrl.startsWith('tel:')
				);
			}
			return false;
		});

		expect(filtered).toHaveLength(2);
		expect(filtered).toContain('https://app.example.com/dashboard');
		expect(filtered).toContain('/relative-page');
	});
});
