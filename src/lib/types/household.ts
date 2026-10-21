import type { Prisma } from '$prisma/client';
import type { householdInclude } from "$lib/server/household";

export type HouseholdWithRelations = Prisma.HouseholdGetPayload<{
  include: typeof householdInclude;
}>;

export type BookingWithAppointment = Prisma.AppointmentBookingsGetPayload<{
  include: { appointment: true };
}>;

export type HouseholdMember = HouseholdWithRelations["members"][number];