import type { PageServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import { expensesByMonth, parseMonths } from "#lib/server/reportStats.ts";

export const load: PageServerLoad = async ({ locals, url }) => {
  // Expense amounts are for expense managers, as well as people allowed to see reports
  requirePermission(locals?.user?.permissions, url, ["view-reports"]);
  requirePermission(locals?.user?.permissions, url, ["manage-expenses"]);
  const months = parseMonths(url.searchParams.get("months"));
  const includePending = url.searchParams.get("pending") === "1";
  return {
    months,
    includePending,
    report: await expensesByMonth(months, includePending),
  };
};
