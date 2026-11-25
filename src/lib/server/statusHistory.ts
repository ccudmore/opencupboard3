import type { Prisma } from "#prisma/client";
import type { HouseholdStatus, VolunteerStatus } from "#prisma/enums";

// History of status changes, for the reports. These are safe to call after any save: nothing is
// written unless the status is different from the last one recorded.

type Db = Pick<
  Prisma.TransactionClient,
  "householdStatusChange" | "volunteerStatusChange"
>;

export async function noteHouseholdStatus(
  db: Db,
  householdId: string,
  status: HouseholdStatus,
  by?: string | null,
) {
  const last = await db.householdStatusChange.findFirst({
    where: { householdId },
    orderBy: { changedAt: "desc" },
    select: { status: true },
  });
  if (last?.status === status) return;
  await db.householdStatusChange.create({
    data: { householdId, status, changedBy: by ?? null },
  });
}

export async function noteVolunteerStatus(
  db: Db,
  volunteerId: string,
  status: VolunteerStatus,
  by?: string | null,
) {
  const last = await db.volunteerStatusChange.findFirst({
    where: { volunteerId },
    orderBy: { changedAt: "desc" },
    select: { status: true },
  });
  if (last?.status === status) return;
  await db.volunteerStatusChange.create({
    data: { volunteerId, status, changedBy: by ?? null },
  });
}
