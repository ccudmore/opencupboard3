import type { LayoutServerLoad } from "./$types";
import { requirePermission } from "$lib/utils";

// Submitters and managers both use /expenses; what each sees is decided by the page.
export const load: LayoutServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, [
    "submit-expenses",
    "manage-expenses",
  ]);
};
