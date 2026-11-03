import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';
import { sendAccountLink } from '$lib/server/accountLinks';
import { isMailConfigured } from '$lib/server/email/mailer';

/**
 * Every volunteer is a user. The user holds the login, the email address and the roles; the
 * volunteer profile (name, phone, skills, assignments) hangs off it. Managers of volunteers
 * never set passwords: they send an invitation or a reset email, and the person chooses their own.
 *
 * People with the manage-volunteers permission can only touch what belongs to volunteers: the
 * Volunteer role, and the status and email of accounts that have no other role. Anything more is
 * done by whoever manages users (Admin > Users).
 */
export const VOLUNTEER_ROLE = 'Volunteer';

export type Fail = { ok: false; status: number; message: string };
export type Result<T = object> = ({ ok: true } & T) | Fail;
const fail = (status: number, message: string): Fail => ({ ok: false, status, message });

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.'));
const nameSchema = z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.');

type Tx = Prisma.TransactionClient;

async function giveVolunteerRole(tx: Pick<Tx, 'role' | 'userRole'>, userId: string) {
	const role = await tx.role.findFirst({ where: { name: VOLUNTEER_ROLE }, select: { id: true } });
	if (!role) return; // not seeded yet; roles can still be set in Admin
	await tx.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, create: { userId, roleId: role.id }, update: {} });
}

/** True when the Volunteer role is the only role this user has (or they have none). */
export async function hasOnlyVolunteerRole(userId: string, tx: Pick<Tx, 'userRole'> = prisma) {
	const others = await tx.userRole.count({ where: { userId, role: { name: { not: VOLUNTEER_ROLE } } } });
	return others === 0;
}

export type EmailLookup =
	| { kind: 'none' }
	| { kind: 'volunteer'; volunteerId: string; name: string; archived: boolean }
	| { kind: 'user'; userId: string; name: string; inactive: boolean };

/** What exists for an email address: nothing, a volunteer already, or a user who isn't a volunteer yet. */
export async function lookupEmail(rawEmail: string): Promise<Result<{ found: EmailLookup; email: string }>> {
	const parsed = emailSchema.safeParse(rawEmail);
	if (!parsed.success) return fail(400, parsed.error.issues[0].message);
	const user = await prisma.user.findFirst({
		where: { email: { equals: parsed.data, mode: 'insensitive' } },
		select: { id: true, name: true, status: true, volunteer: { select: { id: true, firstName: true, lastName: true, status: true } } }
	});
	if (!user) return { ok: true, email: parsed.data, found: { kind: 'none' } };
	if (user.volunteer) {
		const v = user.volunteer;
		return { ok: true, email: parsed.data, found: { kind: 'volunteer', volunteerId: v.id, name: `${v.firstName} ${v.lastName}`.trim(), archived: v.status === 'ARCHIVED' } };
	}
	return { ok: true, email: parsed.data, found: { kind: 'user', userId: user.id, name: user.name, inactive: user.status === 'INACTIVE' } };
}

const profileNames = z.object({ firstName: nameSchema, lastName: nameSchema });

/**
 * Adds a volunteer. If nobody has the email, a new user is created (with no password) together with
 * the profile and the Volunteer role, and an invitation is emailed when asked. If a user with that
 * email exists but isn't a volunteer, they are made one: no second user is ever created.
 */
export async function addVolunteer(
	input: { email: string; firstName: string; lastName: string; sendInvite: boolean },
	actorId: string | undefined
): Promise<Result<{ volunteerId: string; invite: 'sent' | 'not-asked' | 'failed'; inviteMessage?: string }>> {
	const email = emailSchema.safeParse(input.email);
	if (!email.success) return fail(400, email.error.issues[0].message);
	const names = profileNames.safeParse(input);
	if (!names.success) return fail(400, names.error.issues[0].message);
	const { firstName, lastName } = names.data;
	const displayName = `${firstName} ${lastName}`;

	let volunteerId = '';
	let userId = '';
	let createdUser = false;
	try {
		await prisma.$transaction(
			async (tx) => {
				const existing = await tx.user.findFirst({
					where: { email: { equals: email.data, mode: 'insensitive' } },
					select: { id: true, volunteer: { select: { id: true } } }
				});
				if (existing?.volunteer) throw new Error('ALREADY_VOLUNTEER');
				if (existing) {
					userId = existing.id;
				} else {
					userId = randomUUID();
					createdUser = true;
					await tx.user.create({ data: { id: userId, name: displayName, email: email.data, emailVerified: true } });
				}
				await giveVolunteerRole(tx, userId);
				volunteerId = (await tx.volunteer.create({ data: { userId, firstName, lastName, createdBy: actorId ?? 'system' }, select: { id: true } })).id;
			},
			{ isolationLevel: 'Serializable' }
		);
	} catch (err) {
		return mapError(err);
	}

	// An existing account may already have a password; the invitation is only for new accounts
	if (!input.sendInvite || !createdUser) return { ok: true, volunteerId, invite: 'not-asked' };
	const sent = await sendAccountLink(userId, 'invite');
	return sent.ok ? { ok: true, volunteerId, invite: 'sent' } : { ok: true, volunteerId, invite: 'failed', inviteMessage: sent.message };
}

/** Keeps the user's display name in step with the profile's first and last name. */
export async function syncUserName(volunteerId: string) {
	const v = await prisma.volunteer.findUnique({ where: { id: volunteerId }, select: { userId: true, firstName: true, lastName: true } });
	if (v) await prisma.user.update({ where: { id: v.userId }, data: { name: `${v.firstName} ${v.lastName}`.trim() } });
}

/** Changes the login email. Only for accounts that are just a volunteer's; anything else is done in Admin > Users. */
export async function changeEmail(volunteerId: string, rawEmail: string): Promise<Result> {
	const email = emailSchema.safeParse(rawEmail);
	if (!email.success) return fail(400, email.error.issues[0].message);
	const v = await prisma.volunteer.findUnique({ where: { id: volunteerId }, select: { userId: true } });
	if (!v) return fail(404, 'This volunteer no longer exists.');
	if (!(await hasOnlyVolunteerRole(v.userId))) return fail(403, 'This person has other roles, so their email is changed in Admin > Users.');
	const taken = await prisma.user.findFirst({ where: { email: { equals: email.data, mode: 'insensitive' }, id: { not: v.userId } }, select: { id: true } });
	if (taken) return fail(409, 'Another account already uses that email address.');
	try {
		await prisma.user.update({ where: { id: v.userId }, data: { email: email.data } });
	} catch (err) {
		return mapError(err);
	}
	return { ok: true };
}

/**
 * Archives a volunteer: they disappear from pickers and lists, and their pending sign-ups for
 * upcoming shifts are cancelled. Their login is switched off only when it is just a volunteer
 * login: someone who also has other roles keeps signing in.
 */
export async function archiveVolunteer(volunteerId: string): Promise<Result<{ loginDisabled: boolean }>> {
	let loginDisabled = false;
	try {
		await prisma.$transaction(async (tx) => {
			const v = await tx.volunteer.findUnique({ where: { id: volunteerId }, select: { userId: true } });
			if (!v) throw new Error('NO_VOLUNTEER');
			await tx.volunteer.update({ where: { id: volunteerId }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
			await tx.volunteerAssignments.updateMany({
				where: { volunteerId, status: 'PENDING', event: { startTime: { gt: new Date() } } },
				data: { status: 'CANCELLED' }
			});
			if (await hasOnlyVolunteerRole(v.userId, tx)) {
				await tx.user.update({ where: { id: v.userId }, data: { status: 'INACTIVE' } });
				await tx.session.deleteMany({ where: { userId: v.userId } });
				loginDisabled = true;
			}
		});
	} catch (err) {
		return mapError(err);
	}
	return { ok: true, loginDisabled };
}

export async function unarchiveVolunteer(volunteerId: string): Promise<Result> {
	try {
		await prisma.$transaction(async (tx) => {
			const v = await tx.volunteer.findUnique({ where: { id: volunteerId }, select: { userId: true } });
			if (!v) throw new Error('NO_VOLUNTEER');
			await tx.volunteer.update({ where: { id: volunteerId }, data: { status: 'ACTIVE', archivedAt: null } });
			// Only a volunteer-only login was switched off by archiving, so only that one is switched back on
			if (await hasOnlyVolunteerRole(v.userId, tx)) await tx.user.update({ where: { id: v.userId }, data: { status: 'ACTIVE' } });
		});
	} catch (err) {
		return mapError(err);
	}
	return { ok: true };
}

/**
 * Deletes a volunteer profile and their assignments and documents. The Volunteer role is taken
 * off; the login is switched off if nothing else is left on it. The user itself is kept.
 */
export async function deleteVolunteer(volunteerId: string): Promise<Result> {
	try {
		await prisma.$transaction(async (tx) => {
			const v = await tx.volunteer.findUnique({ where: { id: volunteerId }, select: { userId: true } });
			if (!v) return; // already gone
			await tx.volunteerAssignments.deleteMany({ where: { volunteerId } });
			await tx.volunteer.delete({ where: { id: volunteerId } });
			await tx.userRole.deleteMany({ where: { userId: v.userId, role: { name: VOLUNTEER_ROLE } } });
			if ((await tx.userRole.count({ where: { userId: v.userId } })) === 0) {
				await tx.user.update({ where: { id: v.userId }, data: { status: 'INACTIVE' } });
				await tx.session.deleteMany({ where: { userId: v.userId } });
			}
		});
	} catch (err) {
		return mapError(err);
	}
	return { ok: true };
}

/** What the volunteer page shows about the login. */
export async function accountInfo(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, name: true, email: true, status: true, accounts: { where: { providerId: 'credential' }, select: { id: true } } }
	});
	if (!user) return null;
	return {
		id: user.id,
		email: user.email,
		active: user.status === 'ACTIVE',
		hasPassword: user.accounts.length > 0,
		onlyVolunteer: await hasOnlyVolunteerRole(userId),
		emailEnabled: isMailConfigured()
	};
}

function mapError(err: unknown): Fail {
	const msg = (err as Error)?.message;
	if (msg === 'NO_VOLUNTEER') return fail(404, 'This volunteer no longer exists.');
	if (msg === 'ALREADY_VOLUNTEER') return fail(409, 'That person is already a volunteer.');
	const code = (err as { code?: string })?.code;
	if (code === 'P2002') return fail(409, 'That email address or person is already in use.');
	if (code === 'P2034') return fail(409, 'Someone else changed this at the same time. Please try again.');
	console.error(err);
	return fail(500, 'Could not save. Please try again.');
}
