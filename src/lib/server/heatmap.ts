import prisma from "#lib/prisma.ts";
import { HouseholdStatus, AppointmentBookingStatus } from "#prisma/enums";

// Privacy: the browser never receives an exact household location. Households are grouped into
// squares of about CELL_METRES and each square is sent as one point at its centre, with a count.
const CELL_METRES = 500;
const METRES_PER_DEGREE_LAT = 111_320;

export type HeatPoint = { lat: number; lng: number; count: number };

export type HeatmapOptions = {
  /** Count people (adults + children) instead of households */
  weightByPeople: boolean;
  /** Only households with a completed booking in the last N months; 0 = all active households */
  servedMonths: number;
};

export async function loadHeatPoints(opts: HeatmapOptions) {
  const since = new Date();
  since.setMonth(since.getMonth() - opts.servedMonths);

  const households = await prisma.household.findMany({
    where: {
      status: HouseholdStatus.ACTIVE,
      latitude: { not: null },
      longitude: { not: null },
      ...(opts.servedMonths > 0
        ? {
            bookings: {
              some: {
                status: AppointmentBookingStatus.COMPLETE,
                createdAt: { gte: since },
              },
            },
          }
        : {}),
    },
    select: {
      latitude: true,
      longitude: true,
      _count: { select: { members: true } },
    },
  });

  const latStep = CELL_METRES / METRES_PER_DEGREE_LAT;
  const cells = new Map<string, HeatPoint>();
  let total = 0;

  for (const h of households) {
    const weight = opts.weightByPeople
      ? Math.max(1, h._count.members)
      : 1;
    const row = Math.floor(h.latitude! / latStep);
    const lat = (row + 0.5) * latStep;
    // a degree of longitude gets shorter away from the equator, so the step depends on the row
    const lngStep = latStep / Math.cos((lat * Math.PI) / 180);
    const col = Math.floor(h.longitude! / lngStep);
    const key = `${row}:${col}`;
    const cell = cells.get(key) ?? {
      lat,
      lng: (col + 0.5) * lngStep,
      count: 0,
    };
    cell.count += weight;
    cells.set(key, cell);
    total += weight;
  }

  return { points: [...cells.values()], total, households: households.length };
}
