import type { LayoutServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import { CONTACTS_PERMISSION } from "#lib/server/contacts.ts";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, [CONTACTS_PERMISSION]);
};
