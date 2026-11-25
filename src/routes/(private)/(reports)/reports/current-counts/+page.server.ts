import type { PageServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import { currentCounts } from "#lib/server/reportStats.ts";

export const load: PageServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, ["view-reports"]);
  return { counts: await currentCounts() };
};
