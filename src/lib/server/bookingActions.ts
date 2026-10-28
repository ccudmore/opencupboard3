import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import prisma from '$lib/prisma';
import { AppointmentBookingStatus, DatedRequestStatus, EventStatus } from '$prisma/enums';
import { calculateNextServiceDate } from '$lib/utils';
import { bookingInclude, getHouseholdBookings } from '$lib/server/queries/booking';
import { buildEmail, sendBookingEmail } from '$lib/server/email/bookingEmail';

/** Matches the type used by the "Special Requests" tab on the household page. */
const SPECIAL_REQUEST_TYPE = 'Special';
const MAX_REQUEST_LENGTH = 1000;

class BookingError extends Error {
	/** e.g. 'taken': someone else got the appointment first */
	code?: string;
	constructor(message: string, code?: string) {
		super(message);
		this.code = code;
	}
}

function formToObject(formData: FormData): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of formData.entries()) if (typeof value === 'string') out[key] = value;
	return out;
}

function handleError(err: unknown) {
	if (err instanceof BookingError) return fail(409, { message: err.message, code: err.code });
	// P2034: two people changed the same rows at once
	if ((err as { code?: string })?.code === 'P2034') {
		return fail(409, { message: 'Someone else changed this at the same time. Please try again.' });
	}
	console.error(err);
	return fail(500, { message: 'Something went wrong. Please try again.' });
}

/** The parts of a DatedRequest the browser needs to keep the Special Requests tab in step. */
function requestForClient(r: { id: string; householdId: string; requestText: string | null; status: DatedRequestStatus | null; type: string | null; createdAt: Date; createdBy: string | null } | null) {
	return r
		? { id: r.id, householdId: r.householdId, requestText: r.requestText, status: r.status, type: r.type, createdAt: r.createdAt, createdBy: r.createdBy }
		: null;
}

// ---------------------------------------------------------------- create

const createSchema = z.object({
	appointmentId: z.string().trim().optional(),
	specialRequest: z.string().trim().max(MAX_REQUEST_LENGTH).optional(),
	acknowledgedEarly: z.string().optional(),
	// Unscheduled bookings only: when and where the household is expected (both optional)
	plannedStart: z.string().trim().optional(),
	plannedSiteId: z.string().trim().optional()
});

/** "" or missing = no date. Anything else must be a valid date. */
function parseDate(value: string | undefined): Date | null | 'invalid' {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? 'invalid' : d;
}

async function siteExists(id: string) {
	return (await prisma.site.findUnique({ where: { id }, select: { id: true } })) !== null;
}

export async function createBooking(householdId: string, userId: string | undefined, formData: FormData) {
	const parsed = createSchema.safeParse(formToObject(formData));
	if (!parsed.success) return fail(400, { message: 'Invalid booking request.' });
	const appointmentId = parsed.data.appointmentId || undefined; // empty string = "unscheduled"
	const specialRequest = parsed.data.specialRequest || undefined;

	// A planned date and place only apply to unscheduled bookings
	const planned = appointmentId ? null : parseDate(parsed.data.plannedStart);
	if (planned === 'invalid') return fail(400, { message: 'Invalid date.' });
	const plannedSiteId = appointmentId ? undefined : parsed.data.plannedSiteId || undefined;

	try {
		if (plannedSiteId && !(await siteExists(plannedSiteId))) {
			return fail(400, { message: 'That location does not exist.' });
		}

		// The day this booking is for: the service date, or the planned date
		let target: Date | null = planned;
		if (appointmentId) {
			const appt = await prisma.appointment.findUnique({
				where: { id: appointmentId },
				include: { event: true }
			});
			if (!appt || appt.event.status !== EventStatus.ACTIVE || appt.startTime <= new Date()) {
				return fail(409, { message: 'That appointment is no longer available.' });
			}
			target = appt.event.startTime;
		}

		// Booking a date before the household is eligible needs an explicit acknowledgement
		if (target) {
			const eligibleDate = calculateNextServiceDate(await getHouseholdBookings(householdId));
			if (eligibleDate && target < eligibleDate && parsed.data.acknowledgedEarly !== 'true') {
				return fail(409, {
					code: 'not-eligible',
					message: 'This date is before the household is eligible.',
					eligibleDate
				});
			}
		}

		const booking = await prisma.$transaction(
			async (tx) => {
				if (appointmentId) {
					const taken = await tx.appointmentBookings.count({
						where: { appointmentId, status: AppointmentBookingStatus.ACTIVE }
					});
					if (taken > 0) throw new BookingError('That appointment was just booked by someone else.', 'taken');
				}

				return tx.appointmentBookings.create({
					data: {
						status: AppointmentBookingStatus.ACTIVE,
						createdBy: userId,
						household: { connect: { id: householdId } },
						...(appointmentId ? { appointment: { connect: { id: appointmentId } } } : {}),
						...(planned instanceof Date ? { plannedStart: planned } : {}),
						...(plannedSiteId ? { plannedSite: { connect: { id: plannedSiteId } } } : {}),
						...(specialRequest
							? {
									datedRequest: {
										create: {
											household: { connect: { id: householdId } },
											type: SPECIAL_REQUEST_TYPE,
											requestText: specialRequest,
											status: DatedRequestStatus.ACTIVE,
											createdBy: userId
										}
									}
								}
							: {})
					},
					include: bookingInclude
				});
			},
			{ isolationLevel: 'Serializable' }
		);

		return { bookingId: booking.id, datedRequest: requestForClient(booking.datedRequest) };
	} catch (err) {
		return handleError(err);
	}
}

// ---------------------------------------------------------------- update

const updateSchema = z.object({
	bookingId: z.string().min(1),
	status: z.enum(AppointmentBookingStatus),
	specialRequest: z.string().trim().max(MAX_REQUEST_LENGTH).optional(),
	// Unscheduled bookings only. Present but empty = clear it; absent = leave it alone.
	plannedStart: z.string().trim().optional(),
	plannedSiteId: z.string().trim().optional()
});

export async function updateBooking(householdId: string, userId: string | undefined, formData: FormData) {
	const parsed = updateSchema.safeParse(formToObject(formData));
	if (!parsed.success) return fail(400, { message: 'Invalid request.' });
	const { bookingId, status } = parsed.data;
	const specialRequest = parsed.data.specialRequest || '';

	const planned = parseDate(parsed.data.plannedStart);
	if (planned === 'invalid') return fail(400, { message: 'Invalid date.' });
	const plannedSiteId = parsed.data.plannedSiteId || null;

	try {
		if (plannedSiteId && !(await siteExists(plannedSiteId))) {
			return fail(400, { message: 'That location does not exist.' });
		}

		const result = await prisma.$transaction(
			async (tx) => {
				const booking = await tx.appointmentBookings.findFirst({
					where: { id: bookingId, householdId },
					include: { datedRequest: true }
				});
				if (!booking) throw new BookingError('Booking not found.');

				// Re-activating a booking must not double-book the appointment
				if (status === AppointmentBookingStatus.ACTIVE && booking.appointmentId && booking.status !== AppointmentBookingStatus.ACTIVE) {
					const taken = await tx.appointmentBookings.count({
						where: { appointmentId: booking.appointmentId, status: AppointmentBookingStatus.ACTIVE, id: { not: booking.id } }
					});
					if (taken > 0) throw new BookingError('That appointment is already booked by someone else.');
				}

				let removedRequestId: string | null = null;
				let datedRequest = booking.datedRequest;

				if (specialRequest && datedRequest) {
					datedRequest = await tx.datedRequest.update({ where: { id: datedRequest.id }, data: { requestText: specialRequest } });
				} else if (!specialRequest && datedRequest) {
					await tx.datedRequest.delete({ where: { id: datedRequest.id } }); // the booking's link is cleared (onDelete: SetNull)
					removedRequestId = datedRequest.id;
					datedRequest = null;
				}

				const isUnscheduled = !booking.appointmentId;
				const updated = await tx.appointmentBookings.update({
					where: { id: booking.id },
					data: {
						status,
						// Only unscheduled bookings have a planned time and place
						...(isUnscheduled && parsed.data.plannedStart !== undefined ? { plannedStart: planned } : {}),
						...(isUnscheduled && parsed.data.plannedSiteId !== undefined
							? { plannedSite: plannedSiteId ? { connect: { id: plannedSiteId } } : { disconnect: true } }
							: {}),
						...(specialRequest && !booking.datedRequest
							? {
									datedRequest: {
										create: {
											household: { connect: { id: householdId } },
											type: SPECIAL_REQUEST_TYPE,
											requestText: specialRequest,
											status: DatedRequestStatus.ACTIVE,
											createdBy: userId
										}
									}
								}
							: {})
					},
					include: { datedRequest: true }
				});

				return { removedRequestId, datedRequest: updated.datedRequest ?? datedRequest };
			},
			{ isolationLevel: 'Serializable' }
		);

		return { datedRequest: requestForClient(result.datedRequest), removedRequestId: result.removedRequestId };
	} catch (err) {
		return handleError(err);
	}
}

// ---------------------------------------------------------------- delete

export async function deleteBooking(householdId: string, formData: FormData) {
	const bookingId = formToObject(formData).bookingId;
	if (!bookingId) return fail(400, { message: 'Invalid request.' });

	try {
		const removedRequestId = await prisma.$transaction(async (tx) => {
			const booking = await tx.appointmentBookings.findFirst({
				where: { id: bookingId, householdId },
				select: { id: true, datedRequestId: true }
			});
			if (!booking) throw new BookingError('Booking not found.');

			await tx.appointmentBookings.delete({ where: { id: booking.id } });
			// The special request was made for this booking, so it goes with it
			if (booking.datedRequestId) await tx.datedRequest.delete({ where: { id: booking.datedRequestId } });
			return booking.datedRequestId;
		});
		return { removedRequestId };
	} catch (err) {
		return handleError(err);
	}
}

// ---------------------------------------------------------------- email

const kindSchema = z.enum(['confirmation', 'reminder', 'cancellation']);

/** Returns the recipients and the text that would be sent. Nothing is sent. */
export async function previewEmail(householdId: string, formData: FormData) {
	const fields = formToObject(formData);
	const kind = kindSchema.safeParse(fields.kind);
	if (!fields.bookingId || !kind.success) return fail(400, { message: 'Invalid request.' });

	const result = await buildEmail(householdId, fields.bookingId, kind.data);
	if (!result.ok) return fail(result.status, { message: result.message });
	return { to: result.draft.to, subject: result.draft.subject, body: result.draft.body };
}

const sendSchema = z.object({
	kind: kindSchema,
	bookingId: z.string().min(1),
	subject: z.string().max(200).optional(),
	body: z.string().max(10_000).optional()
});

export async function sendEmail(householdId: string, userId: string | undefined, formData: FormData) {
	const parsed = sendSchema.safeParse(formToObject(formData));
	if (!parsed.success) return fail(400, { message: 'Invalid request.' });

	const result = await sendBookingEmail({ householdId, userId, ...parsed.data });
	if (!result.ok) return fail(result.status, { message: result.message });
	return { to: result.to };
}
