import type { Prisma } from '$prisma/client';

export const householdInclude = {
  members: true,
  bookings: { include: { appointment: true } },
  datedRequests: true,
} satisfies Prisma.HouseholdInclude;