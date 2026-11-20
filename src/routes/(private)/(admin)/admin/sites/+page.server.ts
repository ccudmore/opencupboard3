import type { Actions, PageServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import { ADMIN_PERMISSION } from "#lib/server/adminActions.ts";
import {
  createSite,
  deleteSite,
  listSites,
  updateSite,
} from "#lib/server/sites.ts";

export const load: PageServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
  return { sites: await listSites() };
};

// Called with fetch from +page.svelte. Each one checks the permission itself.
export const actions: Actions = {
  createSite: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
    return createSite(locals.user?.id, await request.formData());
  },
  updateSite: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
    return updateSite(await request.formData());
  },
  deleteSite: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, [ADMIN_PERMISSION]);
    return deleteSite(await request.formData());
  },
};
