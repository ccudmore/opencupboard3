import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '$lib/utils';
import { searchUsers, listRoles, parseAdminSearchParams } from '$lib/server/queries/admin';
import { ADMIN_PERMISSION, createUser, setUserStatus, setUserRoles, setUserPassword } from '$lib/server/adminActions';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);

	const [result, roles] = await Promise.all([searchUsers(parseAdminSearchParams(url.searchParams)), listRoles()]);
	return { ...result, roles, currentUserId: locals.user?.id ?? '' };
};

// These are called with fetch from +page.svelte. Each one checks the permission itself.
export const actions: Actions = {
	createUser: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
		return createUser(await request.formData());
	},
	setUserStatus: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
		return setUserStatus(locals.user?.id, await request.formData());
	},
	setUserRoles: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
		return setUserRoles(await request.formData());
	},
	setUserPassword: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
		return setUserPassword(locals.user?.id, locals.session?.id, await request.formData());
	}
};
