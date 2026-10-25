import { randomUUID } from 'node:crypto';
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { hashPassword } from 'better-auth/crypto';
import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';
import { RoleStatus, UserStatus } from '$prisma/enums';

// The user and role actions for the Admin pages. The caller has already checked the
// `admin` permission. Each action returns a plain object on success or fail(...) with a message.

/** The permission that unlocks the Admin pages. */
export const ADMIN_PERMISSION = 'admin';

const MIN_PASSWORD = 8; // matches Better Auth's minPasswordLength in auth.ts
const MAX_PASSWORD = 128;

class AdminError extends Error {}

type Tx = Prisma.TransactionClient;

function handleError(err: unknown) {
	if (err instanceof AdminError) return fail(409, { message: err.message });
	if ((err as { code?: string })?.code === 'P2002') return fail(409, { message: 'That name or email is already in use.' });
	console.error(err);
	return fail(500, { message: 'Something went wrong. Please try again.' });
}

/**
 * Active users who hold the admin permission through an active role.
 * Checked after every change that could remove one, inside the same transaction, so the change
 * is undone if it would leave nobody able to open the Admin pages.
 */
async function assertAnAdminRemains(tx: Tx) {
	const count = await tx.user.count({
		where: {
			status: UserStatus.ACTIVE,
			roles: { some: { role: { status: RoleStatus.ACTIVE, permissions: { some: { permissionId: ADMIN_PERMISSION } } } } }
		}
	});
	if (count === 0) throw new AdminError('That would leave no active administrator, so it was not saved.');
}

const idList = (formData: FormData, key: string) => [...new Set(formData.getAll(key).filter((v): v is string => typeof v === 'string' && v !== ''))];
const text = (formData: FormData, key: string) => {
	const v = formData.get(key);
	return typeof v === 'string' ? v : '';
};

const passwordSchema = z
	.string()
	.min(MIN_PASSWORD, `The password must be at least ${MIN_PASSWORD} characters.`)
	.max(MAX_PASSWORD, `The password can be at most ${MAX_PASSWORD} characters.`);

// ---------------------------------------------------------------- users

const newUserSchema = z.object({
	name: z.string().trim().min(1, 'Enter a name.').max(100),
	email: z.email('Enter a valid email.').transform((e) => e.trim().toLowerCase()),
	password: z.string().optional()
});

/** Adds a user. With a password they can sign in with email and password; without one, only with Google or Microsoft. */
export async function createUser(formData: FormData) {
	const parsed = newUserSchema.safeParse({ name: text(formData, 'name'), email: text(formData, 'email'), password: text(formData, 'password') });
	if (!parsed.success) return fail(400, { message: parsed.error.issues[0].message });
	const { name, email } = parsed.data;
	const password = parsed.data.password || undefined;
	if (password) {
		const checked = passwordSchema.safeParse(password);
		if (!checked.success) return fail(400, { message: checked.error.issues[0].message });
	}
	const roleIds = idList(formData, 'roleIds');

	try {
		const passwordHash = password ? await hashPassword(password) : null;

		const user = await prisma.$transaction(async (tx) => {
			if (roleIds.length > 0 && (await tx.role.count({ where: { id: { in: roleIds } } })) !== roleIds.length) {
				throw new AdminError('One of the chosen roles no longer exists.');
			}
			const created = await tx.user.create({ data: { id: randomUUID(), name, email, emailVerified: true } });
			if (passwordHash) {
				// Better Auth stores an email/password login as a "credential" account whose accountId is the user's id
				await tx.account.create({
					data: { id: randomUUID(), userId: created.id, accountId: created.id, providerId: 'credential', password: passwordHash }
				});
			}
			if (roleIds.length > 0) await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: created.id, roleId })) });
			return created;
		});
		return { userId: user.id };
	} catch (err) {
		if ((err as { code?: string })?.code === 'P2002') return fail(409, { message: 'A user with that email already exists.' });
		return handleError(err);
	}
}

const statusSchema = z.object({ userId: z.string().min(1), status: z.enum(UserStatus) });

export async function setUserStatus(actorId: string | undefined, formData: FormData) {
	const parsed = statusSchema.safeParse({ userId: text(formData, 'userId'), status: text(formData, 'status') });
	if (!parsed.success) return fail(400, { message: 'Invalid request.' });
	const { userId, status } = parsed.data;
	if (userId === actorId && status === UserStatus.INACTIVE) return fail(400, { message: "You can't deactivate your own account." });

	try {
		await prisma.$transaction(async (tx) => {
			await tx.user.update({ where: { id: userId }, data: { status } });
			// An inactive user is signed out everywhere straight away
			if (status === UserStatus.INACTIVE) await tx.session.deleteMany({ where: { userId } });
			await assertAnAdminRemains(tx);
		});
		return { ok: true };
	} catch (err) {
		if ((err as { code?: string })?.code === 'P2025') return fail(404, { message: 'That user no longer exists.' });
		return handleError(err);
	}
}

/** Makes the user's roles exactly the chosen ones. */
export async function setUserRoles(formData: FormData) {
	const userId = text(formData, 'userId');
	if (!userId) return fail(400, { message: 'Invalid request.' });
	const roleIds = idList(formData, 'roleIds');

	try {
		await prisma.$transaction(async (tx) => {
			if (!(await tx.user.findUnique({ where: { id: userId }, select: { id: true } }))) throw new AdminError('That user no longer exists.');
			if (roleIds.length > 0 && (await tx.role.count({ where: { id: { in: roleIds } } })) !== roleIds.length) {
				throw new AdminError('One of the chosen roles no longer exists.');
			}
			await tx.userRole.deleteMany({ where: { userId, roleId: { notIn: roleIds } } });
			await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })), skipDuplicates: true });
			await assertAnAdminRemains(tx);
		});
		return { ok: true };
	} catch (err) {
		return handleError(err);
	}
}

/** Sets a new password. The user's other sessions are ended, so anyone using the old password is signed out. */
export async function setUserPassword(actorId: string | undefined, currentSessionId: string | undefined, formData: FormData) {
	const userId = text(formData, 'userId');
	const password = text(formData, 'password');
	if (!userId) return fail(400, { message: 'Invalid request.' });
	if (password !== text(formData, 'confirm')) return fail(400, { message: 'The two passwords do not match.' });
	const checked = passwordSchema.safeParse(password);
	if (!checked.success) return fail(400, { message: checked.error.issues[0].message });

	try {
		const passwordHash = await hashPassword(password);
		await prisma.$transaction(async (tx) => {
			if (!(await tx.user.findUnique({ where: { id: userId }, select: { id: true } }))) throw new AdminError('That user no longer exists.');

			const credential = await tx.account.findFirst({ where: { userId, providerId: 'credential' }, select: { id: true } });
			if (credential) await tx.account.update({ where: { id: credential.id }, data: { password: passwordHash } });
			else {
				// a user who so far signed in only with Google or Microsoft
				await tx.account.create({
					data: { id: randomUUID(), userId, accountId: userId, providerId: 'credential', password: passwordHash }
				});
			}
			await tx.session.deleteMany({
				where: { userId, ...(userId === actorId && currentSessionId ? { id: { not: currentSessionId } } : {}) }
			});
		});
		return { ok: true };
	} catch (err) {
		return handleError(err);
	}
}

// ---------------------------------------------------------------- roles

const roleFields = {
	description: z.string().trim().max(200).optional()
};

const newRoleSchema = z.object({ name: z.string().trim().min(1, 'Enter a role name.').max(60), ...roleFields });

async function checkPermissionIds(tx: Tx, permissionIds: string[]) {
	if (permissionIds.length > 0 && (await tx.permission.count({ where: { id: { in: permissionIds } } })) !== permissionIds.length) {
		throw new AdminError('One of the chosen permissions no longer exists.');
	}
}

/** Adds a role, with the chosen permissions. */
export async function createRole(actorId: string | undefined, formData: FormData) {
	const parsed = newRoleSchema.safeParse({ name: text(formData, 'name'), description: text(formData, 'description') });
	if (!parsed.success) return fail(400, { message: parsed.error.issues[0].message });
	const permissionIds = idList(formData, 'permissionIds');

	try {
		const role = await prisma.$transaction(async (tx) => {
			await checkPermissionIds(tx, permissionIds);
			return tx.role.create({
				data: {
					name: parsed.data.name,
					description: parsed.data.description || null,
					createdBy: actorId,
					permissions: { create: permissionIds.map((permissionId) => ({ permissionId, createdBy: actorId })) }
				}
			});
		});
		return { roleId: role.id };
	} catch (err) {
		if ((err as { code?: string })?.code === 'P2002') return fail(409, { message: 'A role with that name already exists.' });
		return handleError(err);
	}
}

const updateRoleSchema = z.object({ roleId: z.string().min(1), status: z.enum(RoleStatus), ...roleFields });

/** Saves a role's description, status and permissions together. A role's name can't be changed. */
export async function updateRole(actorId: string | undefined, formData: FormData) {
	const parsed = updateRoleSchema.safeParse({
		roleId: text(formData, 'roleId'),
		status: text(formData, 'status'),
		description: text(formData, 'description')
	});
	if (!parsed.success) return fail(400, { message: 'Invalid request.' });
	const { roleId, status } = parsed.data;
	const permissionIds = idList(formData, 'permissionIds');

	try {
		await prisma.$transaction(async (tx) => {
			if (!(await tx.role.findUnique({ where: { id: roleId }, select: { id: true } }))) throw new AdminError('That role no longer exists.');
			await checkPermissionIds(tx, permissionIds);

			await tx.role.update({ where: { id: roleId }, data: { status, description: parsed.data.description || null } });
			await tx.rolePermission.deleteMany({ where: { roleId, permissionId: { notIn: permissionIds } } });
			await tx.rolePermission.createMany({
				data: permissionIds.map((permissionId) => ({ roleId, permissionId, createdBy: actorId })),
				skipDuplicates: true
			});
			await assertAnAdminRemains(tx);
		});
		return { ok: true };
	} catch (err) {
		return handleError(err);
	}
}
