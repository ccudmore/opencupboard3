import { z } from 'zod';
import prisma from '$lib/prisma';

import {
	AppointmentBookingStatus,
	ClientRelationship,
	EventStatus,
	HouseholdStatus,
	VolunteerAssignmentsStatus
} from '$prisma/enums';
import { calculateNextServiceDate } from '$lib/utils';
import { rolesFor } from '$lib/volunteerRoles';
import { zonedParts, zonedToDate } from '$lib/timezone';
import { notifyAssignment } from '$lib/server/shifts';

/** Managing service dates: the event, its appointments, who is booked and which volunteers help. */

export const SERVICE_TYPE = 'Service Date';
export const MAX_APPOINTMENTS_AT_ONCE = 100;

export type Fail = { ok: false; status: number; message: string; code?: string; data?: Record<string, unknown> };
export type Result<T = object> = ({ ok: true } & T) | Fail;
const fail = (status: number, message: string, code?: string, data?: Record<string, unknown>): Fail => ({
	ok: false,
	status,
	message,
	code,
	data
});

const HOLDS_SPOT: VolunteerAssignmentsStatus[] = ['PENDING', 'ACTIVE', 'COMPLETE'];

const primaryNames = (members: { firstName: string; lastName: string }[]) =>
	members.map((m) => `${m.firstName} ${m.lastName}`.trim()).join(' & ');

// ---------------------------------------------------------------- reading

/** Service dates for the page: upcoming ones, plus earlier ones when showPast is set. */
export async function loadServiceDates(showPast: boolean, timeZone: string) {
	const startOfToday = zonedToDate(zonedParts(new Date(), timeZone).date, '00:00', timeZone) ?? new Date();

	const events = await prisma.event.findMany({
		where: { type: SERVICE_TYPE, ...(showPast ? {} : { startTime: { gte: startOfToday } }) },
		orderBy: { startTime: 'asc' },
		take: 400,
		include: {
			location: { select: { id: true, name: true } },
			needs: true,
			appointments: {
				orderBy: { startTime: 'asc' },
				include: {
					bookings: {
						where: { status: AppointmentBookingStatus.ACTIVE },
						include: {
							household: {
								select: {
									id: true,
									members: {
										where: { relationship: ClientRelationship.PRIMARY },
										select: { firstName: true, lastName: true },
										orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
									}
								}
							}
						}
					}
				}
			},
			volunteers: {
				where: { status: { not: VolunteerAssignmentsStatus.CANCELLED } },
				include: { volunteer: { select: { id: true, firstName: true, lastName: true } } }
			}
		}
	});

	const now = new Date();
	const roles = rolesFor(SERVICE_TYPE);

	const services = events.map((e) => {
		const local = zonedParts(e.startTime, timeZone);
		const appointments = e.appointments.map((a) => {
			const b = a.bookings[0];
			return {
				id: a.id,
				startTime: a.startTime,
				endTime: a.endTime,
				past: a.startTime <= now,
				booking: b ? { id: b.id, householdId: b.householdId, name: primaryNames(b.household.members) || 'Unnamed household' } : null
			};
		});
		const booked = appointments.filter((a) => a.booking).length;
		return {
			id: e.id,
			title: e.title ?? SERVICE_TYPE,
			note: e.note ?? '',
			status: e.status,
			startTime: e.startTime,
			endTime: e.endTime,
			date: local.date,
			startClock: local.time,
			endClock: zonedParts(e.endTime, timeZone).time,
			past: e.endTime < now,
			siteId: e.location.id,
			siteName: e.location.name,
			appointments,
			counts: { total: appointments.length, booked, open: appointments.length - booked },
			roles: roles.map((role) => ({
				role,
				required: e.needs.find((n) => n.role === role)?.count ?? 0,
				filled: e.volunteers.filter((v) => v.eventRole === role && HOLDS_SPOT.includes(v.status)).length
			})),
			volunteers: e.volunteers.map((v) => ({
				assignmentId: v.id,
				volunteerId: v.volunteerId,
				name: `${v.volunteer.firstName} ${v.volunteer.lastName}`.trim(),
				role: v.eventRole,
				status: v.status
			}))
		};
	});

	// Every day that has a service date, for the date picker (a light query: past ones too)
	const all = await prisma.event.findMany({
		where: { type: SERVICE_TYPE, status: EventStatus.ACTIVE },
		select: { startTime: true }
	});
	const markedDates = [...new Set(all.map((e) => zonedParts(e.startTime, timeZone).date))];

	return { services, markedDates, roles };
}

// ---------------------------------------------------------------- service dates

const detailsSchema = z.object({
	title: z.string().trim().max(120).default(''),
	date: z.string(),
	startClock: z.string(),
	endClock: z.string(),
	siteId: z.string().min(1, 'Choose a site'),
	note: z.string().trim().max(2000).default('')
});

function readDetails(fields: Record<string, string>, timeZone: string): Result<{ title: string; start: Date; end: Date; siteId: string; note: string | null }> {
	const parsed = detailsSchema.safeParse(fields);
	if (!parsed.success) return fail(400, parsed.error.issues[0].message);
	const d = parsed.data;
	const start = zonedToDate(d.date, d.startClock, timeZone);
	const end = zonedToDate(d.date, d.endClock, timeZone);
	if (!start) return fail(400, 'Enter a valid date and start time.');
	if (!end) return fail(400, 'Enter a valid end time.');
	if (end <= start) return fail(400, 'The end time must be after the start time.');
	return { ok: true, title: d.title || SERVICE_TYPE, start, end, siteId: d.siteId, note: d.note || null };
}

async function siteExists(id: string) {
	return (await prisma.site.findUnique({ where: { id }, select: { id: true } })) !== null;
}

export async function createServiceDate(fields: Record<string, string>, timeZone: string, userId: string | undefined): Promise<Result<{ id: string }>> {
	const d = readDetails(fields, timeZone);
	if (!d.ok) return d;
	if (!(await siteExists(d.siteId))) return fail(400, 'That site does not exist.');

	const event = await prisma.event.create({
		data: { type: SERVICE_TYPE, title: d.title, startTime: d.start, endTime: d.end, note: d.note, status: EventStatus.ACTIVE, locationId: d.siteId, createdBy: userId }
	});
	return { ok: true, id: event.id };
}

export async function updateServiceDate(eventId: string, fields: Record<string, string>, timeZone: string): Promise<Result> {
	const d = readDetails(fields, timeZone);
	if (!d.ok) return d;
	if (!(await siteExists(d.siteId))) return fail(400, 'That site does not exist.');

	const event = await prisma.event.findFirst({ where: { id: eventId, type: SERVICE_TYPE }, select: { id: true } });
	if (!event) return fail(404, 'That service date no longer exists.');

	await prisma.$transaction([
		prisma.event.update({ where: { id: eventId }, data: { title: d.title, startTime: d.start, endTime: d.end, note: d.note, locationId: d.siteId } }),
		// Appointments are held at the service date's site
		prisma.appointment.updateMany({ where: { eventId }, data: { siteId: d.siteId } })
	]);
	return { ok: true };
}

export async function setServiceDateStatus(eventId: string, status: 'ACTIVE' | 'CANCELLED'): Promise<Result> {
	const { count } = await prisma.event.updateMany({ where: { id: eventId, type: SERVICE_TYPE }, data: { status } });
	return count === 0 ? fail(404, 'That service date no longer exists.') : { ok: true };
}

// ---------------------------------------------------------------- appointments

const addSchema = z.object({
	startClock: z.string(),
	count: z.coerce.number().int().min(1, 'Add at least one appointment').max(MAX_APPOINTMENTS_AT_ONCE, `Add up to ${MAX_APPOINTMENTS_AT_ONCE} at a time`),
	lengthMinutes: z.coerce.number().int().min(1, 'Each appointment must be at least 1 minute').max(480),
	everyMinutes: z.coerce.number().int().min(1, 'Space them at least 1 minute apart').max(480)
});

/**
 * Adds appointments to a service date: `count` of them, each `lengthMinutes` long, starting at
 * `startClock` and a new one every `everyMinutes`. One appointment is count = 1.
 */
export async function addAppointments(eventId: string, fields: Record<string, string>, timeZone: string, userId: string | undefined): Promise<Result<{ added: number }>> {
	const parsed = addSchema.safeParse(fields);
	if (!parsed.success) return fail(400, parsed.error.issues[0].message);
	const { startClock, count, lengthMinutes, everyMinutes } = parsed.data;

	const event = await prisma.event.findFirst({ where: { id: eventId, type: SERVICE_TYPE }, include: { appointments: { select: { startTime: true } } } });
	if (!event) return fail(404, 'That service date no longer exists.');

	const date = zonedParts(event.startTime, timeZone).date;
	const first = zonedToDate(date, startClock, timeZone);
	if (!first) return fail(400, 'Enter a valid start time.');

	const slots = Array.from({ length: count }, (_, i) => {
		const start = new Date(first.getTime() + i * everyMinutes * 60000);
		return { start, end: new Date(start.getTime() + lengthMinutes * 60000) };
	});

	const fmt = (d: Date) => zonedParts(d, timeZone).time;
	if (slots[0].start < event.startTime) return fail(400, `The first appointment can't start before the service date starts (${fmt(event.startTime)}).`);
	const last = slots[slots.length - 1];
	if (last.end > event.endTime) {
		return fail(400, `That doesn't fit: the last appointment would end at ${fmt(last.end)}, but the service date ends at ${fmt(event.endTime)}.`);
	}
	const existing = new Set(event.appointments.map((a) => a.startTime.getTime()));
	const clash = slots.find((s) => existing.has(s.start.getTime()));
	if (clash) return fail(409, `There is already an appointment at ${fmt(clash.start)}.`);

	await prisma.appointment.createMany({
		data: slots.map((s) => ({ eventId, siteId: event.locationId, startTime: s.start, endTime: s.end, createdBy: userId }))
	});
	return { ok: true, added: slots.length };
}

export async function deleteAppointment(appointmentId: string): Promise<Result> {
	const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { id: true, _count: { select: { bookings: true } } } });
	if (!appt) return { ok: true }; // already gone
	if (appt._count.bookings > 0) return fail(409, "This appointment has bookings (even cancelled ones), so it can't be removed. Cancel the booking instead.");
	await prisma.appointment.delete({ where: { id: appointmentId } });
	return { ok: true };
}

// ---------------------------------------------------------------- booking clients

/** Active households whose next service date is on or before this appointment's service date. */
export async function searchEligibleClients(appointmentId: string, term: string) {
	const q = term.trim();
	if (q.length < 2) return { ok: true as const, clients: [], tooShort: true };

	const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { event: true } });
	if (!appt) return fail(404, 'That appointment no longer exists.');
	const day = appt.event.startTime;
	const compact = q.replace(/\s+/g, '');

	const households = await prisma.household.findMany({
		where: {
			status: HouseholdStatus.ACTIVE,
			members: {
				some: {
					relationship: ClientRelationship.PRIMARY,
					OR: [
						{ firstName: { contains: q, mode: 'insensitive' } },
						{ lastName: { contains: q, mode: 'insensitive' } },
						{ email: { contains: q, mode: 'insensitive' } },
						{ phone: { contains: q, mode: 'insensitive' } },
						{ memberOf: { street: { contains: q, mode: 'insensitive' } } },
						{ memberOf: { postalCode: { contains: compact, mode: 'insensitive' } } }
					]
				}
			}
		},
		take: 60,
		include: {
			members: { where: { relationship: ClientRelationship.PRIMARY }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] },
			bookings: { include: { appointment: true } }
		}
	});

	const clients = households
		.filter((h) => {
			// Already booked on this service date?
			if (h.bookings.some((b) => b.status === AppointmentBookingStatus.ACTIVE && b.appointment?.eventId === appt.eventId)) return false;
			const eligibleDate = calculateNextServiceDate(h.bookings as Parameters<typeof calculateNextServiceDate>[0]);
			return !eligibleDate || day >= eligibleDate;
		})
		.map((h) => ({
			householdId: h.id,
			name: primaryNames(h.members) || 'Unnamed household',
			detail: [h.street, h.city].filter(Boolean).join(', ')
		}))
		.sort((a, b) => a.name.localeCompare(b.name))
		.slice(0, 15);

	return { ok: true as const, clients, tooShort: false };
}

/** The open appointments on the same service date closest in time to this one. */
export async function suggestAlternatives(appointmentId: string, limit = 3) {
	const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { eventId: true, startTime: true } });
	if (!appt) return [];
	const open = await prisma.appointment.findMany({
		where: {
			eventId: appt.eventId,
			id: { not: appointmentId },
			startTime: { gt: new Date() },
			bookings: { none: { status: AppointmentBookingStatus.ACTIVE } }
		}
	});
	return open
		.sort((a, b) => Math.abs(a.startTime.getTime() - appt.startTime.getTime()) - Math.abs(b.startTime.getTime() - appt.startTime.getTime()))
		.slice(0, limit)
		.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
		.map((a) => ({ id: a.id, startTime: a.startTime, endTime: a.endTime }));
}

/** Cancels a booking (the appointment opens up again). */
export async function cancelBooking(bookingId: string): Promise<Result> {
	const { count } = await prisma.appointmentBookings.updateMany({
		where: { id: bookingId, status: AppointmentBookingStatus.ACTIVE },
		data: { status: AppointmentBookingStatus.CANCELLED }
	});
	return count === 0 ? fail(409, 'That booking was already cancelled.') : { ok: true };
}

// ---------------------------------------------------------------- volunteers

/** Volunteers who have the skill for this role and aren't already on the service date. */
export async function searchVolunteersForRole(eventId: string, role: string, term: string) {
	if (!rolesFor(SERVICE_TYPE).includes(role)) return fail(400, 'Choose a role.');
	const q = term.trim();
	const volunteers = await prisma.volunteer.findMany({
		where: {
			skills: { has: role },
			assignments: { none: { eventId, status: { not: VolunteerAssignmentsStatus.CANCELLED } } },
			...(q && {
				OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }]
			})
		},
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
		take: 15,
		select: { id: true, firstName: true, lastName: true }
	});
	return { ok: true as const, volunteers: volunteers.map((v) => ({ id: v.id, name: `${v.firstName} ${v.lastName}`.trim() })) };
}

/** Adds a volunteer with the skill (active straight away, as when a manager adds them). */
export async function addVolunteerToService(eventId: string, volunteerId: string, role: string, userId: string | undefined): Promise<Result<{ assignmentId: string }>> {
	if (!rolesFor(SERVICE_TYPE).includes(role)) return fail(400, 'Choose a role.');

	const [event, volunteer] = await Promise.all([
		prisma.event.findFirst({ where: { id: eventId, type: SERVICE_TYPE }, select: { status: true } }),
		prisma.volunteer.findUnique({ where: { id: volunteerId }, select: { skills: true } })
	]);
	if (!event || event.status !== EventStatus.ACTIVE) return fail(409, 'That service date is not available.');
	if (!volunteer) return fail(404, 'Volunteer not found.');
	if (!volunteer.skills.includes(role)) return fail(403, `That volunteer doesn't have the ${role} skill.`);

	try {
		const existing = await prisma.volunteerAssignments.findUnique({ where: { volunteerId_eventId: { volunteerId, eventId } } });
		if (existing && existing.status !== VolunteerAssignmentsStatus.CANCELLED) return fail(409, 'That volunteer is already on this service date.');
		if (existing) {
			// They were cancelled earlier: bring the same row back
			await prisma.volunteerAssignments.update({ where: { id: existing.id }, data: { status: VolunteerAssignmentsStatus.ACTIVE, eventRole: role, createdBy: userId } });
			await notifyAssignment(existing.id, 'added');
			return { ok: true, assignmentId: existing.id };
		}
		const created = await prisma.volunteerAssignments.create({
			data: { volunteerId, eventId, eventRole: role, status: VolunteerAssignmentsStatus.ACTIVE, createdBy: userId }
		});
		await notifyAssignment(created.id, 'added');
		return { ok: true, assignmentId: created.id };
	} catch (err) {
		if ((err as { code?: string })?.code === 'P2002') return fail(409, 'That volunteer is already on this service date.');
		console.error(err);
		return fail(500, 'Something went wrong. Please try again.');
	}
}

/** Takes a volunteer off the service date (cancelled, so a cancellation email can be sent). */
export async function removeVolunteerFromService(assignmentId: string): Promise<Result> {
	const { count } = await prisma.volunteerAssignments.updateMany({
		where: { id: assignmentId, status: { not: VolunteerAssignmentsStatus.CANCELLED } },
		data: { status: VolunteerAssignmentsStatus.CANCELLED }
	});
	if (count === 0) return fail(409, 'That volunteer was already removed.');
	await notifyAssignment(assignmentId, 'removed');
	return { ok: true };
}

// ---------------------------------------------------------------- duplicate

/**
 * Copies a service date to a new date and time: its title, note, site, the number of volunteers needed
 * per role and its appointments (shifted to the new start). Bookings and volunteers are not copied.
 */
export async function duplicateServiceDate(sourceId: string, fields: Record<string, string>, timeZone: string, userId: string | undefined): Promise<Result<{ id: string }>> {
	const source = await prisma.event.findFirst({ where: { id: sourceId, type: SERVICE_TYPE }, include: { needs: true, appointments: true } });
	if (!source) return fail(404, 'That service date no longer exists.');

	const d = readDetails({ ...fields, siteId: fields.siteId || source.locationId, title: fields.title ?? '' }, timeZone);
	if (!d.ok) return d;
	if (!(await siteExists(d.siteId))) return fail(400, 'That site does not exist.');

	try {
		const id = await prisma.$transaction(async (tx) => {
			const event = await tx.event.create({
				data: {
					type: SERVICE_TYPE,
					title: d.title === SERVICE_TYPE ? (source.title ?? SERVICE_TYPE) : d.title,
					startTime: d.start,
					endTime: d.end,
					note: source.note,
					status: EventStatus.ACTIVE,
					locationId: d.siteId,
					createdBy: userId
				}
			});
			if (source.needs.length > 0) {
				await tx.eventVolunteerNeed.createMany({ data: source.needs.map((n) => ({ eventId: event.id, role: n.role, count: n.count })) });
			}
			if (source.appointments.length > 0) {
				await tx.appointment.createMany({
					data: source.appointments.map((a) => {
						const offset = a.startTime.getTime() - source.startTime.getTime();
						const length = a.endTime.getTime() - a.startTime.getTime();
						const start = new Date(d.start.getTime() + offset);
						return { eventId: event.id, siteId: d.siteId, startTime: start, endTime: new Date(start.getTime() + length), createdBy: userId };
					})
				});
			}
			return event.id;
		});
		return { ok: true, id };
	} catch (err) {
		console.error(err);
		return fail(500, 'Could not duplicate the service date. Please try again.');
	}
}

