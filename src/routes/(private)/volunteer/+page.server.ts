import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { EventStatus } from '$prisma/enums';
import prisma from '$lib/prisma';
import { requirePermission } from '$lib/utils';
import { openShiftsFor, signUp, withdrawSignup } from '$lib/server/shifts';

const PAST_LIMIT = 10;

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals?.user?.permissions, url, ['access-volunteer']);

	// The volunteer record tied to this login (see Volunteer.userId)
	const volunteer = await prisma.volunteer.findUnique({
		where: { userId: locals.user!.id },
		select: { id: true, firstName: true, lastName: true, skills: true }
	});

	const timeZone = privateEnv.TIMEZONE || 'America/Toronto';
	if (!volunteer) {
		return { volunteer: null, upcoming: [], past: [], openShifts: [], timeZone, userName: locals.user!.name };
	}

	const now = new Date();
	const rows = (
		await prisma.volunteerAssignments.findMany({
			where: {
				volunteerId: volunteer.id,
				status: { not: 'CANCELLED' },
				event: { status: EventStatus.ACTIVE }
			},
			include: { event: { include: { location: { select: { name: true } } } } }
		})
	).map((a) => ({
		id: a.id,
		title: a.event.title ?? a.event.type,
		type: a.event.type,
		role: a.eventRole,
		status: a.status,
		note: a.event.note,
		startTime: a.event.startTime,
		endTime: a.event.endTime,
		location: a.event.location.name
	}));

	const upcoming = rows.filter((r) => r.endTime >= now).sort((a, b) => +a.startTime - +b.startTime);
	const past = rows
		.filter((r) => r.endTime < now)
		.sort((a, b) => +b.startTime - +a.startTime)
		.slice(0, PAST_LIMIT);

	const openShifts = await openShiftsFor(volunteer);

	return { volunteer, upcoming, past, openShifts, timeZone, userName: locals.user!.name };
};

/** The volunteer record tied to the signed-in login. */
async function myVolunteerId(userId: string) {
	return (await prisma.volunteer.findUnique({ where: { userId }, select: { id: true } }))?.id ?? null;
}

export const actions: Actions = {
	/** Signs the volunteer up for a shift spot. It stays pending until a coordinator approves it. */
	signUp: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['access-volunteer']);
		const data = await request.formData();
		const eventId = String(data.get('eventId') ?? '');
		const role = String(data.get('role') ?? '');
		const volunteerId = await myVolunteerId(locals.user!.id);
		if (!volunteerId) return fail(403, { message: 'Your login is not connected to a volunteer record.' });
		if (!eventId || !role) return fail(400, { message: 'Choose a shift.' });

		const r = await signUp(volunteerId, eventId, role, locals.user!.id);
		return r.ok ? { success: true } : fail(r.status, { message: r.message });
	},

	/** Withdraws a signup that hasn't been approved. */
	withdraw: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, ['access-volunteer']);
		const assignmentId = String((await request.formData()).get('assignmentId') ?? '');
		const volunteerId = await myVolunteerId(locals.user!.id);
		if (!volunteerId || !assignmentId) return fail(400, { message: 'Invalid request.' });

		const r = await withdrawSignup(volunteerId, assignmentId);
		return r.ok ? { success: true } : fail(r.status, { message: r.message });
	}
};
