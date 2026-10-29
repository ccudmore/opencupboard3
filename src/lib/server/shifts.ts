import { Prisma } from '$prisma/client';
import { EventStatus, VolunteerAssignmentsStatus } from '$prisma/enums';
import prisma from '$lib/prisma';
import { env as privateEnv } from '$env/dynamic/private';
import { rolesFor } from '$lib/volunteerRoles';
import { notifyPermission, notifyVolunteer } from '$lib/server/notifications';

/**
 * Shift signups. An event can say how many volunteers it needs in each role (EventVolunteerNeed).
 * A volunteer with that skill signs up, which creates a PENDING assignment; someone with
 * manage-volunteers approves it (ACTIVE) and is then offered the confirmation email.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; status: number; message: string };
const fail = (status: number, message: string): { ok: false; status: number; message: string } => ({ ok: false, status, message });

/** Assignments in these states hold a spot. */
const HOLDS_SPOT: VolunteerAssignmentsStatus[] = ['PENDING', 'ACTIVE', 'COMPLETE'];

export const MAX_NEED = 50;

// ---------------------------------------------------------------- notifications

/**
 * Tells the right people about something that happened to a volunteer's assignment.
 * 'signup' goes to the people who approve signups; the rest go to the volunteer (if they have a login).
 */
export async function notifyAssignment(assignmentId: string, kind: 'signup' | 'approved' | 'declined' | 'added' | 'removed') {
	const a = await prisma.volunteerAssignments.findUnique({
		where: { id: assignmentId },
		include: {
			event: { select: { title: true, type: true, startTime: true } },
			volunteer: { select: { id: true, firstName: true, lastName: true } }
		}
	});
	if (!a) return;

	const when = new Intl.DateTimeFormat('en-CA', { dateStyle: 'full', timeStyle: 'short', timeZone: privateEnv.TIMEZONE || 'America/Toronto' }).format(a.event.startTime);
	const what = `${a.event.title ?? a.event.type}${a.eventRole ? ` as ${a.eventRole}` : ''}`;
	const name = `${a.volunteer.firstName} ${a.volunteer.lastName}`.trim();

	if (kind === 'signup') {
		await notifyPermission('manage-volunteers', {
			subject: `${name} signed up for ${what}`,
			body: `${name} signed up for ${what} on ${when}. It is waiting for your approval.`,
			link: '/volunteers/shifts'
		});
		return;
	}
	const text = {
		approved: { subject: `Your signup was approved: ${what}`, body: `You are confirmed for ${what} on ${when}.` },
		declined: { subject: `Your signup was not accepted: ${what}`, body: `Your signup for ${what} on ${when} was not accepted. Please contact your volunteer coordinator if you have questions.` },
		added: { subject: `You were added to ${what}`, body: `You have been added to ${what} on ${when}.` },
		removed: { subject: `You were removed from ${what}`, body: `You have been removed from ${what} on ${when}. Please contact your volunteer coordinator if you have questions.` }
	}[kind];
	await notifyVolunteer(a.volunteer.id, { ...text, link: '/volunteer' });
}

// ---------------------------------------------------------------- what volunteers see

/** Upcoming shift spots this volunteer could sign up for. */
export async function openShiftsFor(volunteer: { id: string; skills: string[] }) {
	if (volunteer.skills.length === 0) return [];

	const events = await prisma.event.findMany({
		where: {
			status: EventStatus.ACTIVE,
			startTime: { gt: new Date() },
			needs: { some: { role: { in: volunteer.skills }, count: { gt: 0 } } }
		},
		include: {
			location: { select: { name: true } },
			needs: { where: { role: { in: volunteer.skills }, count: { gt: 0 } } },
			volunteers: { select: { volunteerId: true, eventRole: true, status: true } }
		},
		orderBy: { startTime: 'asc' },
		take: 100
	});

	const out = [];
	for (const e of events) {
		// Already on this event (not cancelled)? Then there is nothing to sign up for.
		const mine = e.volunteers.find((a) => a.volunteerId === volunteer.id && a.status !== 'CANCELLED');
		if (mine) continue;

		const spots = e.needs
			.map((n) => {
				const taken = e.volunteers.filter((a) => a.eventRole === n.role && HOLDS_SPOT.includes(a.status)).length;
				return { role: n.role, required: n.count, remaining: n.count - taken };
			})
			.filter((s) => s.remaining > 0);
		if (spots.length === 0) continue;

		out.push({
			id: e.id,
			title: e.title ?? e.type,
			type: e.type,
			note: e.note,
			startTime: e.startTime,
			endTime: e.endTime,
			location: e.location.name,
			spots
		});
	}
	return out;
}

/** A volunteer signs up. Creates (or revives a cancelled) PENDING assignment. */
export async function signUp(volunteerId: string, eventId: string, role: string, userId: string): Promise<Result<{ assignmentId: string }>> {
	try {
		const result = await prisma.$transaction(
			async (tx): Promise<Result<{ assignmentId: string }>> => {
				const volunteer = await tx.volunteer.findUnique({ where: { id: volunteerId }, select: { skills: true } });
				if (!volunteer) return fail(404, 'Volunteer not found.');
				if (!volunteer.skills.includes(role)) return fail(403, `You don't have the ${role} skill. Ask a volunteer coordinator.`);

				const event = await tx.event.findUnique({
					where: { id: eventId },
					include: { needs: { where: { role } }, volunteers: true }
				});
				if (!event || event.status !== EventStatus.ACTIVE || event.startTime <= new Date()) {
					return fail(409, 'That shift is no longer available.');
				}
				const need = event.needs[0];
				if (!need || need.count <= 0) return fail(409, 'That shift has no spots for that role.');

				const existing = event.volunteers.find((a) => a.volunteerId === volunteerId);
				if (existing && existing.status !== 'CANCELLED') return fail(409, 'You are already signed up for this shift.');

				const taken = event.volunteers.filter((a) => a.eventRole === role && HOLDS_SPOT.includes(a.status)).length;
				if (taken >= need.count) return fail(409, 'Sorry, all the spots for that role were just taken.');

				if (existing) {
					await tx.volunteerAssignments.update({
						where: { id: existing.id },
						data: { status: 'PENDING', eventRole: role, createdBy: userId }
					});
					return { ok: true, assignmentId: existing.id };
				}
				const created = await tx.volunteerAssignments.create({
					data: { volunteerId, eventId, eventRole: role, status: 'PENDING', createdBy: userId }
				});
				return { ok: true, assignmentId: created.id };
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
		);
		if (result.ok) await notifyAssignment(result.assignmentId, 'signup'); // tell the approvers
		return result;
	} catch (err) {
		return mapError(err);
	}
}

/** A volunteer withdraws a signup that hasn't been approved yet. */
export async function withdrawSignup(volunteerId: string, assignmentId: string): Promise<Result> {
	const { count } = await prisma.volunteerAssignments.updateMany({
		where: { id: assignmentId, volunteerId, status: 'PENDING' },
		data: { status: 'CANCELLED' }
	});
	return count === 0 ? fail(409, 'That signup can no longer be withdrawn here. Contact your coordinator.') : { ok: true };
}

// ---------------------------------------------------------------- what managers do

/** Approves a pending signup. Returns the volunteer, so the caller can offer the confirmation email. */
export async function approveSignup(assignmentId: string): Promise<Result<{ volunteerId: string }>> {
	const a = await prisma.volunteerAssignments.findUnique({ where: { id: assignmentId }, select: { volunteerId: true } });
	if (!a) return fail(404, 'Signup not found.');
	const { count } = await prisma.volunteerAssignments.updateMany({
		where: { id: assignmentId, status: 'PENDING' },
		data: { status: 'ACTIVE' }
	});
	if (count === 0) return fail(409, 'That signup was already handled.');
	await notifyAssignment(assignmentId, 'approved');
	return { ok: true, volunteerId: a.volunteerId };
}

/** Declines a pending signup. The spot opens up again. */
export async function declineSignup(assignmentId: string): Promise<Result> {
	const { count } = await prisma.volunteerAssignments.updateMany({
		where: { id: assignmentId, status: 'PENDING' },
		data: { status: 'CANCELLED' }
	});
	if (count === 0) return fail(409, 'That signup was already handled.');
	await notifyAssignment(assignmentId, 'declined');
	return { ok: true };
}

/** Sets how many volunteers an event needs in each role. A count of 0 (or missing) removes the need. */
export async function setNeeds(eventId: string, counts: Record<string, number>): Promise<Result> {
	const event = await prisma.event.findUnique({ where: { id: eventId }, select: { type: true } });
	if (!event) return fail(404, 'Event not found.');

	const allowed = rolesFor(event.type);
	const entries: { role: string; count: number }[] = [];
	for (const [role, raw] of Object.entries(counts)) {
		if (!allowed.includes(role)) return fail(400, `${role} is not a role for ${event.type} events.`);
		const count = Math.floor(Number(raw));
		if (!Number.isFinite(count) || count < 0 || count > MAX_NEED) return fail(400, `Use a number from 0 to ${MAX_NEED}.`);
		entries.push({ role, count });
	}

	await prisma.$transaction([
		prisma.eventVolunteerNeed.deleteMany({ where: { eventId, role: { in: entries.map((e) => e.role) } } }),
		prisma.eventVolunteerNeed.createMany({ data: entries.filter((e) => e.count > 0).map((e) => ({ eventId, ...e })) })
	]);
	return { ok: true };
}

/** Upcoming events with roles, with their needs and who has signed up. */
export async function shiftBoard() {
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);

	const events = await prisma.event.findMany({
		where: { status: EventStatus.ACTIVE, startTime: { gte: startOfToday } },
		include: {
			location: { select: { name: true } },
			needs: true,
			volunteers: {
				where: { status: { in: HOLDS_SPOT } },
				include: { volunteer: { select: { id: true, firstName: true, lastName: true, skills: true } } }
			}
		},
		orderBy: { startTime: 'asc' },
		take: 150
	});

	return events
		.filter((e) => rolesFor(e.type).length > 0)
		.map((e) => ({
			id: e.id,
			title: e.title ?? e.type,
			type: e.type,
			startTime: e.startTime,
			endTime: e.endTime,
			location: e.location.name,
			roles: rolesFor(e.type).map((role) => ({
				role,
				required: e.needs.find((n) => n.role === role)?.count ?? 0,
				filled: e.volunteers.filter((a) => a.eventRole === role && a.status !== 'PENDING').length,
				pending: e.volunteers.filter((a) => a.eventRole === role && a.status === 'PENDING').length
			})),
			pending: e.volunteers
				.filter((a) => a.status === 'PENDING')
				.map((a) => ({
					id: a.id,
					role: a.eventRole,
					volunteer: `${a.volunteer.firstName} ${a.volunteer.lastName}`.trim(),
					volunteerId: a.volunteer.id,
					hasSkill: a.volunteer.skills.includes(a.eventRole)
				}))
		}));
}

function mapError(err: unknown): { ok: false; status: number; message: string } {
	// 40001 / P2034: two signups collided; the loser can simply try again
	if ((err as { code?: string })?.code === 'P2034') return fail(409, 'That shift just changed. Please try again.');
	if ((err as { code?: string })?.code === 'P2002') return fail(409, 'You are already signed up for this shift.');
	console.error(err);
	return fail(500, 'Something went wrong. Please try again.');
}
