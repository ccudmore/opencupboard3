import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import prisma from '$lib/prisma';
import { EventStatus, VolunteerAssignmentsStatus } from '$prisma/enums';
import { rolesFor } from '$lib/volunteerRoles';
import { buildAssignmentEmail, sendAssignmentEmail } from '$lib/server/email/volunteerEmail';

// Everything here belongs to one volunteer's page; the caller has already checked manage-volunteers.

class AssignmentError extends Error {}

function formToObject(formData: FormData): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of formData.entries()) if (typeof value === 'string') out[key] = value;
	return out;
}

function handleError(err: unknown) {
	if (err instanceof AssignmentError) return fail(409, { message: err.message });
	// P2002: the volunteer is already on that event
	if ((err as { code?: string })?.code === 'P2002') {
		return fail(409, { message: 'This volunteer is already assigned to that event. Edit the existing assignment instead.' });
	}
	console.error(err);
	return fail(500, { message: 'Something went wrong. Please try again.' });
}

/** The role must be one of the roles for that kind of event. Kinds with no roles take no role. */
function checkRole(eventType: string, role: string): string | null {
	const allowed = rolesFor(eventType);
	if (allowed.length === 0) return role === '' ? null : `${eventType} events have no roles.`;
	return allowed.includes(role) ? null : 'Choose a role for this event.';
}

// ---------------------------------------------------------------- add

const createSchema = z.object({ eventId: z.string().min(1), role: z.string().trim().max(100).default('') });

export async function createAssignment(volunteerId: string, userId: string | undefined, formData: FormData) {
	const parsed = createSchema.safeParse(formToObject(formData));
	if (!parsed.success) return fail(400, { message: 'Choose an event.' });
	const { eventId, role } = parsed.data;

	try {
		const [volunteer, event] = await Promise.all([
			prisma.volunteer.findUnique({ where: { id: volunteerId }, select: { id: true } }),
			prisma.event.findUnique({ where: { id: eventId }, select: { id: true, type: true, status: true } })
		]);
		if (!volunteer) return fail(404, { message: 'This volunteer no longer exists.' });
		if (!event || event.status !== EventStatus.ACTIVE) return fail(409, { message: 'That event is not available.' });

		const roleProblem = checkRole(event.type, role);
		if (roleProblem) return fail(400, { message: roleProblem });

		const assignment = await prisma.volunteerAssignments.create({
			data: { volunteerId, eventId, eventRole: role, status: VolunteerAssignmentsStatus.ACTIVE, createdBy: userId }
		});
		return { assignmentId: assignment.id };
	} catch (err) {
		return handleError(err);
	}
}

// ---------------------------------------------------------------- edit

const updateSchema = z.object({
	assignmentId: z.string().min(1),
	status: z.enum(VolunteerAssignmentsStatus),
	role: z.string().trim().max(100).default('')
});

export async function updateAssignment(volunteerId: string, formData: FormData) {
	const parsed = updateSchema.safeParse(formToObject(formData));
	if (!parsed.success) return fail(400, { message: 'Invalid request.' });
	const { assignmentId, status, role } = parsed.data;

	try {
		const assignment = await prisma.volunteerAssignments.findFirst({
			where: { id: assignmentId, volunteerId },
			include: { event: { select: { type: true } } }
		});
		if (!assignment) return fail(404, { message: 'Assignment not found.' });

		// A role saved earlier that is no longer in the list can stay as it is, but can't be chosen again
		if (role !== assignment.eventRole) {
			const roleProblem = checkRole(assignment.event.type, role);
			if (roleProblem) return fail(400, { message: roleProblem });
		}

		await prisma.volunteerAssignments.update({ where: { id: assignment.id }, data: { status, eventRole: role } });
		return { ok: true };
	} catch (err) {
		return handleError(err);
	}
}

// ---------------------------------------------------------------- remove

export async function deleteAssignment(volunteerId: string, formData: FormData) {
	const assignmentId = formToObject(formData).assignmentId;
	if (!assignmentId) return fail(400, { message: 'Invalid request.' });

	try {
		const { count } = await prisma.volunteerAssignments.deleteMany({ where: { id: assignmentId, volunteerId } });
		if (count === 0) return fail(404, { message: 'Assignment not found.' });
		return { ok: true };
	} catch (err) {
		return handleError(err);
	}
}

// ---------------------------------------------------------------- email

const kindSchema = z.enum(['confirmation', 'reminder', 'cancellation']);

/** Returns the recipients and the text that would be sent. Nothing is sent. */
export async function previewAssignmentEmail(volunteerId: string, formData: FormData) {
	const fields = formToObject(formData);
	const kind = kindSchema.safeParse(fields.kind);
	if (!fields.assignmentId || !kind.success) return fail(400, { message: 'Invalid request.' });

	const result = await buildAssignmentEmail(volunteerId, fields.assignmentId, kind.data);
	if (!result.ok) return fail(result.status, { message: result.message });
	return { to: result.draft.to, subject: result.draft.subject, body: result.draft.body };
}

const sendSchema = z.object({
	kind: kindSchema,
	assignmentId: z.string().min(1),
	subject: z.string().max(200).optional(),
	body: z.string().max(10_000).optional()
});

export async function sendAssignmentMessage(volunteerId: string, userId: string | undefined, formData: FormData) {
	const parsed = sendSchema.safeParse(formToObject(formData));
	if (!parsed.success) return fail(400, { message: 'Invalid request.' });

	const result = await sendAssignmentEmail({ volunteerId, userId, ...parsed.data });
	if (!result.ok) return fail(result.status, { message: result.message });
	return { to: result.to };
}
