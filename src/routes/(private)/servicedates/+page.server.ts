import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import prisma from '$lib/prisma';
import { requirePermission } from '$lib/utils';
import { isMailConfigured } from '$lib/server/email/mailer';
import { getSites } from '$lib/server/queries/booking';
import { createBooking, previewEmail as previewBookingEmail, sendEmail as sendBookingEmail } from '$lib/server/bookingActions';
import { previewAssignmentEmail, sendAssignmentMessage } from '$lib/server/assignmentActions';
import { setNeeds } from '$lib/server/shifts';
import {
	loadServiceDates,
	createServiceDate,
	updateServiceDate,
	setServiceDateStatus,
	addAppointments,
	deleteAppointment,
	searchEligibleClients,
	suggestAlternatives,
	cancelBooking,
	searchVolunteersForRole,
	addVolunteerToService,
	removeVolunteerFromService,
	duplicateServiceDate,
	type Fail
} from '$lib/server/serviceDates';

// Service dates: who may do what. Actions run without the page's load, so each one checks again.
const APPOINTMENTS = ['manage-appointments'];
const VOLUNTEERS = ['manage-appointments', 'manage-volunteers'];

const timeZone = () => privateEnv.TIMEZONE || 'America/Toronto';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
	const showPast = url.searchParams.has('past');
	const { services, markedDates, roles } = await loadServiceDates(showPast, timeZone());
	return {
		services,
		markedDates,
		roles,
		sites: await getSites(),
		showPast,
		focus: url.searchParams.get('focus') ?? '',
		timeZone: timeZone(),
		emailEnabled: isMailConfigured(),
		canManageVolunteers: (locals.user?.permissions ?? []).some((p) => VOLUNTEERS.includes(p))
	};
};

const fields = (data: FormData) => Object.fromEntries([...data.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
const bad = (r: Fail) => fail(r.status, { message: r.message, code: r.code, ...(r.data ?? {}) });

export const actions: Actions = {
	// ------------------------------------------------ service dates
	createServiceDate: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const r = await createServiceDate(fields(await request.formData()), timeZone(), locals.user?.id);
		return r.ok ? { id: r.id } : bad(r);
	},

	updateServiceDate: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const f = fields(await request.formData());
		const r = await updateServiceDate(f.eventId ?? '', f, timeZone());
		return r.ok ? { success: true } : bad(r);
	},

	setStatus: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const f = fields(await request.formData());
		if (f.status !== 'ACTIVE' && f.status !== 'CANCELLED') return fail(400, { message: 'Invalid request.' });
		const r = await setServiceDateStatus(f.eventId ?? '', f.status);
		return r.ok ? { success: true } : bad(r);
	},

	duplicate: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const f = fields(await request.formData());
		const r = await duplicateServiceDate(f.eventId ?? '', f, timeZone(), locals.user?.id);
		return r.ok ? { id: r.id } : bad(r);
	},

	// ------------------------------------------------ appointments
	addAppointments: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const f = fields(await request.formData());
		const r = await addAppointments(f.eventId ?? '', f, timeZone(), locals.user?.id);
		return r.ok ? { added: r.added } : bad(r);
	},

	deleteAppointment: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const r = await deleteAppointment(fields(await request.formData()).appointmentId ?? '');
		return r.ok ? { success: true } : bad(r);
	},

	// ------------------------------------------------ booking clients
	searchClients: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const f = fields(await request.formData());
		const r = await searchEligibleClients(f.appointmentId ?? '', f.q ?? '');
		return r.ok ? { clients: r.clients, tooShort: r.tooShort } : bad(r);
	},

	/** Books the household into the appointment. If it was just taken, says so and suggests other times. */
	book: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const f = fields(await request.formData());
		const appointmentId = f.appointmentId ?? '';
		const householdId = f.householdId ?? '';
		if (!appointmentId || !householdId) return fail(400, { message: 'Choose a client.' });

		const household = await prisma.household.findUnique({ where: { id: householdId }, select: { status: true } });
		if (!household || household.status !== 'ACTIVE') return fail(409, { message: 'That household is not active.' });

		const body = new FormData();
		body.set('appointmentId', appointmentId); // no acknowledgement: only eligible households may be booked here
		const result = await createBooking(householdId, locals.user?.id, body);

		const failure = result as { status?: number; data?: { code?: string; message?: string } };
		if (failure.status && failure.data) {
			const code = failure.data.code;
			if (code === 'taken' || failure.data.message?.includes('no longer available')) {
				return fail(409, {
					message: failure.data.message ?? 'That time is no longer available.',
					code: 'taken',
					suggestions: await suggestAlternatives(appointmentId)
				});
			}
			return fail(failure.status, { message: failure.data.message ?? 'Could not book.', code });
		}
		return result;
	},

	cancelBooking: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const r = await cancelBooking(fields(await request.formData()).bookingId ?? '');
		return r.ok ? { success: true } : bad(r);
	},

	// ------------------------------------------------ volunteers
	setNeeds: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, VOLUNTEERS);
		const f = fields(await request.formData());
		let counts: Record<string, number>;
		try {
			counts = JSON.parse(f.counts ?? '{}');
		} catch {
			return fail(400, { message: 'Invalid request.' });
		}
		const r = await setNeeds(f.eventId ?? '', counts);
		return r.ok ? { success: true } : bad(r);
	},

	searchVolunteers: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, VOLUNTEERS);
		const f = fields(await request.formData());
		const r = await searchVolunteersForRole(f.eventId ?? '', f.role ?? '', f.q ?? '');
		return r.ok ? { volunteers: r.volunteers } : bad(r);
	},

	addVolunteer: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, VOLUNTEERS);
		const f = fields(await request.formData());
		const r = await addVolunteerToService(f.eventId ?? '', f.volunteerId ?? '', f.role ?? '', locals.user?.id);
		return r.ok ? { assignmentId: r.assignmentId } : bad(r);
	},

	removeVolunteer: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, VOLUNTEERS);
		const r = await removeVolunteerFromService(fields(await request.formData()).assignmentId ?? '');
		return r.ok ? { success: true } : bad(r);
	},

	// ------------------------------------------------ email (the usual prompts)
	previewBookingEmail: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const data = await request.formData();
		const booking = await prisma.appointmentBookings.findUnique({ where: { id: String(data.get('bookingId') ?? '') }, select: { householdId: true } });
		if (!booking) return fail(404, { message: 'Booking not found.' });
		return previewBookingEmail(booking.householdId, data);
	},

	sendBookingEmail: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, APPOINTMENTS);
		const data = await request.formData();
		const booking = await prisma.appointmentBookings.findUnique({ where: { id: String(data.get('bookingId') ?? '') }, select: { householdId: true } });
		if (!booking) return fail(404, { message: 'Booking not found.' });
		return sendBookingEmail(booking.householdId, locals.user?.id, data);
	},

	previewVolunteerEmail: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, VOLUNTEERS);
		const data = await request.formData();
		const a = await prisma.volunteerAssignments.findUnique({ where: { id: String(data.get('assignmentId') ?? '') }, select: { volunteerId: true } });
		if (!a) return fail(404, { message: 'Assignment not found.' });
		return previewAssignmentEmail(a.volunteerId, data);
	},

	sendVolunteerEmail: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, VOLUNTEERS);
		const data = await request.formData();
		const a = await prisma.volunteerAssignments.findUnique({ where: { id: String(data.get('assignmentId') ?? '') }, select: { volunteerId: true } });
		if (!a) return fail(404, { message: 'Assignment not found.' });
		return sendAssignmentMessage(a.volunteerId, locals.user?.id, data);
	}
};
