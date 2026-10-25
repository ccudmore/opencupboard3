import type { Prisma } from '$prisma/client';
import type { bookingInclude, getAvailableServices } from '$lib/server/queries/booking';

// Type-only imports from $lib/server are erased at build time, the same way
// $lib/types/household.ts does it.

export type BookingRow = Prisma.AppointmentBookingsGetPayload<{ include: typeof bookingInclude }>;

export type AvailableService = Awaited<ReturnType<typeof getAvailableServices>>[number];
export type AvailableAppointment = AvailableService['appointments'][number];
