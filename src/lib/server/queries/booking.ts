import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';
import { AppointmentBookingStatus, EventStatus } from '$prisma/enums';

/** Everything the bookings list needs for one booking. */
export const bookingInclude = {
	appointment: { include: { event: { include: { location: true } } } },
	plannedSite: true,
	datedRequest: true
} satisfies Prisma.AppointmentBookingsInclude;

/**
 * All bookings for a household, most recent first.
 * Bookings without an appointment ("unscheduled") sort by their planned start, or the day they were created.
 */
export async function getHouseholdBookings(householdId: string) {
	const bookings = await prisma.appointmentBookings.findMany({
		where: { householdId },
		include: bookingInclude
	});

	const sortKey = (b: (typeof bookings)[number]) => (b.appointment?.startTime ?? b.plannedStart ?? b.createdAt).getTime();
	return bookings.sort((a, b) => sortKey(b) - sortKey(a));
}

/** Locations to choose from for an unscheduled booking. */
export async function getSites() {
	return prisma.site.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

/**
 * Future service dates that still have at least one open appointment.
 * An appointment is open when it has no booking with status ACTIVE.
 */
export async function getAvailableServices() {
	const now = new Date();

	const events = await prisma.event.findMany({
		where: { type: 'Service Date', status: EventStatus.ACTIVE, endTime: { gt: now } },
		orderBy: { startTime: 'asc' },
		include: {
			location: true,
			appointments: {
				where: {
					startTime: { gt: now },
					bookings: { none: { status: AppointmentBookingStatus.ACTIVE } }
				},
				orderBy: { startTime: 'asc' }
			}
		}
	});

	return events
		.filter((e) => e.appointments.length > 0)
		.map((e) => ({
			id: e.id,
			title: e.title,
			startTime: e.startTime,
			endTime: e.endTime,
			location: { id: e.location.id, name: e.location.name, street: e.location.street, city: e.location.city },
			openCount: e.appointments.length,
			appointments: e.appointments.map((a) => ({ id: a.id, startTime: a.startTime, endTime: a.endTime }))
		}));
}
