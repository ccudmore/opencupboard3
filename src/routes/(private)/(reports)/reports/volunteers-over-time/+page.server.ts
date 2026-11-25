import type { PageServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import { volunteerTrend, parseMonths } from "#lib/server/reportStats.ts";

export const load: PageServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, ["view-reports"]);
  const months = parseMonths(url.searchParams.get("months"));
  return { months, trend: await volunteerTrend(months) };
};
