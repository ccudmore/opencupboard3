import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { requirePermission } from '$lib/utils';
import { isMailConfigured } from '$lib/server/email/mailer';
import { shiftBoard, setNeeds, approveSignup, declineSignup } from '$lib/server/shifts';
import { previewAssignmentEmail, sendAssignmentMessage } from '$lib/server/assignmentActions';
import prisma from '$lib/prisma';

// Shift staffing for managers. The (volunteers) layout already requires manage-volunteers, but actions
// run without the layout, so each one checks again.
const PERMISSION = ['manage-volunteers'];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals?.user?.permissions, url, PERMISSION);
	return {
		board: await shiftBoard(),
		emailEnabled: isMailConfigured(),
		timeZone: privateEnv.TIMEZONE || 'America/Toronto'
	};
};

/** The email actions take an assignment id; the volunteer comes from the assignment. */
async function volunteerOf(assignmentId: string) {
	return (await prisma.volunteerAssignments.findUnique({ where: { id: assignmentId }, select: { volunteerId: true } }))?.volunteerId;
}

export const actions: Actions = {
	/** Sets the number of volunteers needed per role for one event. */
	setNeeds: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, PERMISSION);
		const data = await request.formData();
		const eventId = String(data.get('eventId') ?? '');
		let counts: Record<string, number> = {};
		try {
			counts = JSON.parse(String(data.get('counts') ?? '{}'));
		} catch {
			return fail(400, { message: 'Invalid request.' });
		}
		if (!eventId || typeof counts !== 'object' || counts === null) return fail(400, { message: 'Invalid request.' });
		const r = await setNeeds(eventId, counts);
		return r.ok ? { success: true } : fail(r.status, { message: r.message });
	},

	approve: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, PERMISSION);
		const assignmentId = String((await request.formData()).get('assignmentId') ?? '');
		const r = await approveSignup(assignmentId);
		return r.ok ? { success: true, assignmentId } : fail(r.status, { message: r.message });
	},

	decline: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, PERMISSION);
		const assignmentId = String((await request.formData()).get('assignmentId') ?? '');
		const r = await declineSignup(assignmentId);
		return r.ok ? { success: true } : fail(r.status, { message: r.message });
	},

	previewEmail: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, PERMISSION);
		const data = await request.formData();
		const volunteerId = await volunteerOf(String(data.get('assignmentId') ?? ''));
		if (!volunteerId) return fail(404, { message: 'Signup not found.' });
		return previewAssignmentEmail(volunteerId, data);
	},

	sendEmail: async ({ request, locals, url }) => {
		requirePermission(locals?.user?.permissions, url, PERMISSION);
		const data = await request.formData();
		const volunteerId = await volunteerOf(String(data.get('assignmentId') ?? ''));
		if (!volunteerId) return fail(404, { message: 'Signup not found.' });
		return sendAssignmentMessage(volunteerId, locals.user?.id, data);
	}
};
