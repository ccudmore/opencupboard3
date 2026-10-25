import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '$lib/utils';
import { searchRoles, listPermissions, parseAdminSearchParams } from '$lib/server/queries/admin';
import { ADMIN_PERMISSION, createRole, updateRole } from '$lib/server/adminActions';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);

	const [result, permissions] = await Promise.all([searchRoles(parseAdminSearchParams(url.searchParams)), listPermissions()]);
	return { ...result, permissions };
};

// These are called with fetch from +page.svelte. Each one checks the permission itself.
export const actions: Actions = {
	createRole: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
		return createRole(locals.user?.id, await request.formData());
	},
	updateRole: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
		return updateRole(locals.user?.id, await request.formData());
	}
};
