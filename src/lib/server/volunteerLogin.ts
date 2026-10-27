import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hashPassword } from 'better-auth/crypto';
import prisma from '$lib/prisma';

/**
 * Ties a volunteer to a login (a User). One volunteer has at most one login and a login belongs to at
 * most one volunteer (Volunteer.userId is unique). Volunteers get the "Volunteer" role, which only
 * allows signing in and the volunteer pages. Other roles are managed in Admin > Users.
 */
export const VOLUNTEER_ROLE = 'Volunteer';

type Result = { ok: true } | { ok: false; status: number; message: string };
const fail = (status: number, message: string): Result => ({ ok: false, status, message });

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(128);

async function giveVolunteerRole(tx: Pick<typeof prisma, 'role' | 'userRole'>, userId: string) {
	const role = await tx.role.findFirst({ where: { name: VOLUNTEER_ROLE }, select: { id: true } });
	if (!role) return; // not seeded yet; roles can still be set in Admin
	await tx.userRole.upsert({
		where: { userId_roleId: { userId, roleId: role.id } },
		create: { userId, roleId: role.id },
		update: {}
	});
}

/** Gives an existing user (found by email) to a volunteer. */
export async function linkExistingLogin(volunteerId: string, rawEmail: string): Promise<Result> {
	const email = emailSchema.safeParse(rawEmail);
	if (!email.success) return fail(400, 'Enter a valid email address.');

	const user = await prisma.user.findFirst({
		where: { email: { equals: email.data, mode: 'insensitive' } },
		select: { id: true, volunteer: { select: { id: true, firstName: true, lastName: true } } }
	});
	if (!user) return fail(404, 'No user has that email address. Use "Create a login" instead.');
	if (user.volunteer && user.volunteer.id !== volunteerId) {
		return fail(409, `That user is already linked to ${user.volunteer.firstName} ${user.volunteer.lastName}.`);
	}

	try {
		await prisma.$transaction(async (tx) => {
			const v = await tx.volunteer.findUnique({ where: { id: volunteerId }, select: { userId: true } });
			if (!v) throw new Error('NO_VOLUNTEER');
			if (v.userId && v.userId !== user.id) throw new Error('HAS_LOGIN');
			await tx.volunteer.update({ where: { id: volunteerId }, data: { userId: user.id } });
			await giveVolunteerRole(tx, user.id);
		});
	} catch (err) {
		return mapError(err);
	}
	return { ok: true };
}

/** Creates a new user with a password, gives it the Volunteer role and links it. */
export async function createVolunteerLogin(
	volunteerId: string,
	input: { name: string; email: string; password: string }
): Promise<Result> {
	const email = emailSchema.safeParse(input.email);
	if (!email.success) return fail(400, 'Enter a valid email address.');
	const password = passwordSchema.safeParse(input.password);
	if (!password.success) return fail(400, password.error.issues[0].message);
	const name = input.name.trim();
	if (!name) return fail(400, 'Enter a name.');

	const exists = await prisma.user.findFirst({
		where: { email: { equals: email.data, mode: 'insensitive' } },
		select: { id: true }
	});
	if (exists) return fail(409, 'A user with that email already exists. Use "Link an existing user" instead.');

	const hash = await hashPassword(password.data);
	try {
		await prisma.$transaction(async (tx) => {
			const v = await tx.volunteer.findUnique({ where: { id: volunteerId }, select: { userId: true } });
			if (!v) throw new Error('NO_VOLUNTEER');
			if (v.userId) throw new Error('HAS_LOGIN');

			const id = randomUUID();
			await tx.user.create({ data: { id, name, email: email.data, emailVerified: true } });
			await tx.account.create({
				data: { id: randomUUID(), userId: id, accountId: id, providerId: 'credential', password: hash }
			});
			await tx.volunteer.update({ where: { id: volunteerId }, data: { userId: id } });
			await giveVolunteerRole(tx, id);
		});
	} catch (err) {
		return mapError(err);
	}
	return { ok: true };
}

/** Disconnects the login from the volunteer. The user and their roles are left alone. */
export async function unlinkLogin(volunteerId: string): Promise<Result> {
	await prisma.volunteer.updateMany({ where: { id: volunteerId }, data: { userId: null } });
	return { ok: true };
}

function mapError(err: unknown): Result {
	const msg = (err as Error)?.message;
	if (msg === 'NO_VOLUNTEER') return fail(404, 'This volunteer no longer exists.');
	if (msg === 'HAS_LOGIN') return fail(409, 'This volunteer already has a login.');
	if ((err as { code?: string })?.code === 'P2002') return fail(409, 'That user is already linked to a volunteer.');
	console.error(err);
	return fail(500, 'Could not save the login. Please try again.');
}
