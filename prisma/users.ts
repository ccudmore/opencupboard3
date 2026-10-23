import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import prisma from './db.js';

type NewUser = {
	email: string;
	name: string;
	password: string;
	roleNames: string[];
	image?: string | null;
};

/**
 * Creates a user with an email/password login and the given roles, in one
 * transaction. Roles must already exist (run the reference-data step first).
 */
export async function createUserWithPassword({ email, name, password, roleNames, image = null }: NewUser) {
	const passwordHash = await hashPassword(password);

	return prisma.$transaction(async (tx) => {
		const roles = await tx.role.findMany({ where: { name: { in: roleNames } } });
		const missing = roleNames.filter((n) => !roles.some((r) => r.name === n));
		if (missing.length > 0) {
			throw new Error(`Unknown role(s): ${missing.join(', ')}. Run the reference-data step first.`);
		}

		const user = await tx.user.create({
			data: { id: randomUUID(), email: email.toLowerCase(), name, emailVerified: true, image }
		});

		// Better Auth stores an email/password login as a "credential" account
		// whose accountId is the user's id.
		await tx.account.create({
			data: {
				id: randomUUID(),
				userId: user.id,
				accountId: user.id,
				providerId: 'credential',
				password: passwordHash
			}
		});

		await tx.userRole.createMany({
			data: roles.map((r) => ({ userId: user.id, roleId: r.id }))
		});

		return user;
	});
}