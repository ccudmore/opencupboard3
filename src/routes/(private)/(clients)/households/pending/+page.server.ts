import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import prisma from '$lib/prisma';
import { requirePermission } from '$lib/utils';
import { AppointmentBookingStatus, ClientRelationship, HouseholdStatus } from '$prisma/enums';
import { isMailConfigured } from '$lib/server/email/mailer';
import { sendApprovalEmail } from '$lib/server/email/householdEmail';
import { previewEmail, sendEmail } from '$lib/server/bookingActions';

// Requests that came from the public booking page, waiting for a household manager.
// The layout already needs manage-households; the actions check it again.
const MANAGE = ['manage-households'];

const primary = { where: { relationship: ClientRelationship.PRIMARY }, orderBy: { createdAt: 'asc' as const } };

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals?.user?.permissions, url, MANAGE);

	const [bookings, households] = await Promise.all([
		prisma.appointmentBookings.findMany({
			where: { status: AppointmentBookingStatus.PENDING },
			orderBy: { createdAt: 'asc' },
			include: {
				household: { include: { members: primary } },
				appointment: { include: { event: { include: { location: true } } } }
			}
		}),
		prisma.household.findMany({
			where: { status: HouseholdStatus.PENDING },
			orderBy: { createdAt: 'asc' },
			include: { members: primary }
		})
	]);

	const person = (m?: { firstName: string; lastName: string; email: string | null; phone: string | null }) => ({
		name: m ? `${m.firstName} ${m.lastName}`.trim() : 'Unnamed household',
		email: m?.email ?? '',
		phone: m?.phone ?? ''
	});

	return {
		timeZone: privateEnv.TIMEZONE || 'America/Toronto',
		emailEnabled: isMailConfigured(),
		bookings: bookings.map((b) => ({
			id: b.id,
			householdId: b.householdId,
			householdStatus: b.household.status,
			uniqueId: b.household.uniqueId ?? '',
			...person(b.household.members[0]),
			requestedAt: b.createdAt,
			start: b.appointment?.startTime ?? b.plannedStart ?? null,
			place: b.appointment?.event.location?.name ?? b.appointment?.event.locationText ?? ''
		})),
		households: households.map((h) => ({
			id: h.id,
			uniqueId: h.uniqueId ?? '',
			...person(h.members[0]),
			address: [h.unitNumber ? `${h.unitNumber}-` : '', h.street ?? '', h.city ? `, ${h.city}` : '', h.postalCode ? ` ${h.postalCode}` : ''].join('').trim(),
			adults: h.adultCount,
			children: h.childCount,
			dietary: h.dietaryRestrictions,
			notes: h.notes ?? '',
			requestedAt: h.createdAt
		}))
	};
};

const idOf = async (request: Request, field: string) => String((await request.formData()).get(field) ?? '');

export const actions: Actions = {
	/** Pending -> Active. The page then offers the confirmation letter. */
	confirmBooking: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, MANAGE);
		const bookingId = await idOf(request, 'bookingId');
		try {
			return await prisma.$transaction(
				async (tx) => {
					const b = await tx.appointmentBookings.findUnique({ where: { id: bookingId }, include: { household: true } });
					if (!b || b.status !== AppointmentBookingStatus.PENDING) return fail(409, { message: 'That request was already handled.' });
					if (b.household.status !== HouseholdStatus.ACTIVE) return fail(409, { message: 'Approve the household first.' });
					if (b.appointmentId) {
						const other = await tx.appointmentBookings.count({
							where: { appointmentId: b.appointmentId, status: AppointmentBookingStatus.ACTIVE, id: { not: b.id } }
						});
						if (other > 0) return fail(409, { message: 'That appointment is already booked by someone else.' });
					}
					await tx.appointmentBookings.update({ where: { id: b.id }, data: { status: AppointmentBookingStatus.ACTIVE } });
					return { bookingId: b.id };
				},
				{ isolationLevel: 'Serializable' }
			);
		} catch (err) {
			console.error(err);
			return fail(500, { message: 'Could not confirm it. Please try again.' });
		}
	},

	/** Pending -> Cancelled (the appointment opens up again). */
	declineBooking: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, MANAGE);
		const bookingId = await idOf(request, 'bookingId');
		const { count } = await prisma.appointmentBookings.updateMany({
			where: { id: bookingId, status: AppointmentBookingStatus.PENDING },
			data: { status: AppointmentBookingStatus.CANCELLED }
		});
		return count === 0 ? fail(409, { message: 'That request was already handled.' }) : { bookingId };
	},

	/** A new household becomes Active, and is emailed its ID when it gave an address. */
	approveHousehold: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, MANAGE);
		const householdId = await idOf(request, 'householdId');
		const { count } = await prisma.household.updateMany({
			where: { id: householdId, status: HouseholdStatus.PENDING },
			data: { status: HouseholdStatus.ACTIVE }
		});
		if (count === 0) return fail(409, { message: 'That household was already handled.' });
		return { householdId, emailed: await sendApprovalEmail(householdId) };
	},

	/** Archived, so it is kept on record but can't book. */
	rejectHousehold: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, MANAGE);
		const householdId = await idOf(request, 'householdId');
		const { count } = await prisma.household.updateMany({
			where: { id: householdId, status: HouseholdStatus.PENDING },
			data: { status: HouseholdStatus.ARCHIVED }
		});
		return count === 0 ? fail(409, { message: 'That household was already handled.' }) : { householdId };
	},

	// the usual email prompts
	previewEmail: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, MANAGE);
		const data = await request.formData();
		const b = await prisma.appointmentBookings.findUnique({ where: { id: String(data.get('bookingId') ?? '') }, select: { householdId: true } });
		if (!b) return fail(404, { message: 'Booking not found.' });
		return previewEmail(b.householdId, data);
	},

	sendEmail: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, MANAGE);
		const data = await request.formData();
		const b = await prisma.appointmentBookings.findUnique({ where: { id: String(data.get('bookingId') ?? '') }, select: { householdId: true } });
		if (!b) return fail(404, { message: 'Booking not found.' });
		return sendEmail(b.householdId, locals.user?.id, data);
	}
};
