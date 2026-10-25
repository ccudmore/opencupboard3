import type { LayoutServerLoad } from './$types';
import { requirePermission } from '$lib/utils';

// Every page under /admin needs the `admin` permission. Actions check it again,
// because this runs only when a page is loaded.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	requirePermission(locals?.user?.permissions, url, ['admin']);
};
