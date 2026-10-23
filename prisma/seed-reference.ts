import prisma from './db.js';
import { seedReferenceData, permissions, roles } from './reference-data.js';

// Run on every deploy (see db-push in docker-compose.yml).
seedReferenceData()
	.then(() => {
		console.log(`Reference data up to date: ${permissions.length} permissions, ${roles.length} roles.`);
	})
	.catch((e) => {
		console.error('Reference data failed:', e);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());