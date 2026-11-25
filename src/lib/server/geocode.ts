import prisma from "#lib/prisma.ts";
import { HouseholdStatus } from "#prisma/enums";
import { addressQuery, lookupAddress } from "#lib/geocodeLookup.ts";

// Saves household locations for the heat map report. A household is looked up when it is
// created, when its address changes, and in bulk from the report page (for households that
// existed before this feature, or whose earlier look-up failed).

const activeHouseholds = {
  where: { status: HouseholdStatus.ACTIVE },
  select: {
    id: true,
    street: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
    geocodedQuery: true,
  },
} as const;

/** Active households whose saved location is missing or no longer matches their address. */
async function householdsToLocate() {
  const all = await prisma.household.findMany(activeHouseholds);
  return all
    .map((h) => ({ id: h.id, query: addressQuery(h), done: h.geocodedQuery }))
    .filter((h) => h.query && h.query !== h.done) as {
    id: string;
    query: string;
    done: string | null;
  }[];
}

export type GeocodeProgress = {
  running: boolean;
  /** Households in the current run, and how many are finished */
  total: number;
  finished: number;
  error: string | null;
};

// One job at a time, held in memory. It is fine if it is lost on a restart: the next run
// starts again with whatever is still missing.
const job: GeocodeProgress = {
  running: false,
  total: 0,
  finished: 0,
  error: null,
};

export const getGeocodeProgress = (): GeocodeProgress => ({ ...job });

/** Starts the background lookup (if one isn't already running) and returns at once. */
export async function startGeocoding(): Promise<GeocodeProgress> {
  if (job.running) return getGeocodeProgress();
  const todo = await householdsToLocate();
  job.running = true;
  job.total = todo.length;
  job.finished = 0;
  job.error = null;

  void (async () => {
    try {
      for (const h of todo) {
        const found = await lookupAddress(h.query);
        await prisma.household.update({
          where: { id: h.id },
          data: {
            latitude: found?.lat ?? null,
            longitude: found?.lng ?? null,
            geocodedQuery: h.query, // saved even when nothing was found, so it isn't retried
          },
        });
        job.finished++;
      }
    } catch (err) {
      console.error("Household geocoding stopped:", err);
      job.error = err instanceof Error ? err.message : "Lookup failed";
    } finally {
      job.running = false;
    }
  })();

  return getGeocodeProgress();
}

/** For the report: how many active households have a location, and how many are still to do. */
export async function getLocationCounts() {
  const all = await prisma.household.findMany({
    ...activeHouseholds,
    select: { ...activeHouseholds.select, latitude: true },
  });
  let located = 0;
  let notFound = 0;
  let noAddress = 0;
  let pending = 0;
  for (const h of all) {
    const q = addressQuery(h);
    if (!q) noAddress++;
    else if (q !== h.geocodedQuery) pending++;
    else if (h.latitude == null) notFound++;
    else located++;
  }
  return { total: all.length, located, notFound, noAddress, pending };
}

/**
 * Brings one household's saved location up to date with its address. Does nothing (and makes no
 * request) when the address hasn't changed since the last look-up.
 */
export async function geocodeHousehold(id: string) {
  const h = await prisma.household.findUnique({
    where: { id },
    select: {
      street: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      geocodedQuery: true,
      latitude: true,
    },
  });
  if (!h) return;
  const query = addressQuery(h);
  if (!query) {
    // address removed: forget the old location
    if (h.geocodedQuery || h.latitude != null) {
      await prisma.household.update({
        where: { id },
        data: { latitude: null, longitude: null, geocodedQuery: null },
      });
    }
    return;
  }
  if (query === h.geocodedQuery) return;
  const found = await lookupAddress(query);
  await prisma.household.update({
    where: { id },
    data: {
      latitude: found?.lat ?? null,
      longitude: found?.lng ?? null,
      geocodedQuery: query,
    },
  });
}

/**
 * Same, but in the background: the caller doesn't wait, and a failure (such as no internet)
 * is only logged. The report page can pick up anything that was missed.
 */
export function geocodeHouseholdLater(id: string) {
  void geocodeHousehold(id).catch((err) =>
    console.error(`Could not locate household ${id}:`, err),
  );
}
