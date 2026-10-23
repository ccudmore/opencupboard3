import prisma from './db.js';
import { createUserWithPassword } from './users.js';

// Creates the first administrator. Run once after the first deploy:
//   BOOTSTRAP_ADMIN_EMAIL=you@example.org BOOTSTRAP_ADMIN_PASSWORD='...' \
//     tsx prisma/bootstrap-admin.ts
//
// It does nothing if an administrator already exists, so it is safe to re-run.

const ADMIN_ROLE = 'Administrator';
const MIN_PASSWORD_LENGTH = 12;

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

async function main() {
	const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
	const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
	const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Administrator';

	if (!email || !email.includes('@')) {
		fail('Set BOOTSTRAP_ADMIN_EMAIL to a valid email address.');
	}

	const role = await prisma.role.findUnique({ where: { name: ADMIN_ROLE } });
	if (!role) {
		fail(`Role "${ADMIN_ROLE}" does not exist. Run the reference-data step first.`);
	}

	const adminCount = await prisma.userRole.count({ where: { roleId: role.id } });
	if (adminCount > 0) {
		console.log('An administrator already exists. Nothing to do.');
		return;
	}

	// If this person already has an account (for example from signing in with
	// Google), just give that account the Administrator role.
	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		await prisma.userRole.create({ data: { userId: existing.id, roleId: role.id } });
		console.log(`Granted ${ADMIN_ROLE} to existing user ${email}.`);
		return;
	}

	if (!password || password.length < MIN_PASSWORD_LENGTH) {
		fail(`Set BOOTSTRAP_ADMIN_PASSWORD to at least ${MIN_PASSWORD_LENGTH} characters.`);
	}

	await createUserWithPassword({ email, name, password, roleNames: [ADMIN_ROLE] });
	console.log(`Created administrator ${email}. Log in and change the password right away.`);
}

main()
	.catch((e) => {
		console.error('Bootstrap failed:', e);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());