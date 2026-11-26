import type { PageServerLoad } from "./$types";
import { hasPermission } from "#lib/utils.ts";

export const load: PageServerLoad = async ({ locals }) => ({
  // the expenses report is only listed for people who may open it
  canSeeExpenses: !!hasPermission(locals?.user?.permissions, ["manage-expenses"]),
});
