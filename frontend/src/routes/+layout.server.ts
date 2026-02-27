import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ request }) => {
	const host = request.headers.get('host') || '';
	const isLandingDomain = host.includes('getlemonlab');
	return { isLandingDomain };
};
