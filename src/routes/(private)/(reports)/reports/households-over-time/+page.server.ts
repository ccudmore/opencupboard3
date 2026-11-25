import type { PageServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import { householdTrend, parseMonths } from "#lib/server/reportStats.ts";

export const load: PageServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, ["view-reports"]);
  const months = parseMonths(url.searchParams.get("months"));
  return {
    months,
    split: url.searchParams.get("split") === "1",
    trend: await householdTrend(months),
  };
};
