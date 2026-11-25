import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import { getGeocodeProgress } from "#lib/server/geocode.ts";

export const GET: RequestHandler = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, ["view-reports"]);
  return json(getGeocodeProgress());
};
