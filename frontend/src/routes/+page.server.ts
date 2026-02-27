import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ request }) => {
	const host = request.headers.get('host') || '';
	// Show landing page on getlemonlab.com, redirect on env-ll.com and localhost
	const isLandingDomain = host.includes('getlemonlab');
	return { isLandingDomain };
};
