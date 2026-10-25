import type { PageServerLoad } from './$types';
import { requirePermission } from '$lib/utils';
import { searchVolunteer, parseVolunteerSearchParams } from '$lib/server/queries/volunteer';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);
	return searchVolunteer(parseVolunteerSearchParams(url.searchParams));
};
