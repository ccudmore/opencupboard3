import type { Actions, PageServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import { loadHeatPoints } from "#lib/server/heatmap.ts";
import {
  getGeocodeProgress,
  getLocationCounts,
  startGeocoding,
} from "#lib/server/geocode.ts";

const SERVED_CHOICES = [0, 3, 6, 12];

export const load: PageServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, ["view-reports"]);

  const weightByPeople = url.searchParams.get("people") === "1";
  const asked = Number(url.searchParams.get("served"));
  const servedMonths = SERVED_CHOICES.includes(asked) ? asked : 0;

  const [heat, counts] = await Promise.all([
    loadHeatPoints({ weightByPeople, servedMonths }),
    getLocationCounts(),
  ]);

  return {
    ...heat,
    counts,
    progress: getGeocodeProgress(),
    weightByPeople,
    servedMonths,
  };
};

export const actions: Actions = {
  // Starts looking up addresses in the background; the page polls for progress
  locate: async ({ locals, url }) => {
    requirePermission(locals?.user?.permissions, url, ["view-reports"]);
    return { progress: await startGeocoding() };
  },
};
