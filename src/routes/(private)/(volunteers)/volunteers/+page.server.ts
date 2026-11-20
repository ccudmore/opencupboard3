import type { PageServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import {
  searchVolunteer,
  parseVolunteerSearchParams,
} from "#lib/server/queries/volunteer.ts";

export const load: PageServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, ["manage-volunteers"]);
  return searchVolunteer(parseVolunteerSearchParams(url.searchParams));
};
