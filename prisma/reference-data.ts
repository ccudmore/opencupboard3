import prisma from './db.js';

// Reference data = the permissions and roles the application code depends on.
// It is safe to run on every deploy: everything is an upsert, so running it
// twice changes nothing.

export type PermissionSeed = { id: string; name: string; description: string };
export type RoleSeed = { name: string; permissionIds: string[] };

// Every id used in requirePermission(...) must be listed here.
export const permissions: PermissionSeed[] = [
	{ id: 'login', name: 'Log in', description: 'Log into the service' },
	{ id: 'manage-households', name: 'Manage clients', description: 'Manage households' },
	{ id: 'manage-appointments', name: 'Manage appointments', description: 'Manage appointments and bookings' },
	{ id: 'manage-configuration', name: 'Manage system configuration', description: 'Manage system configuration' },
	{ id: 'admin', name: 'Administration', description: 'Manage users, roles and their permissions' },
	{ id: 'manage-volunteers', name: 'Manage volunteers', description: 'Manage volunteers' },
	{ id: 'manage-inventory', name: 'Manage inventory', description: 'Manage inventory' },
	{ id: 'manage-donors', name: 'Manage donors', description: 'Manage donors' },
	{ id: 'view-dashboard', name: 'View dashboard', description: 'View dashboard' },
	{ id: 'access-volunteer', name: 'Volunteer', description: 'Volunteer' }
];

const ADMINISTRATOR = 'Administrator';

export const roles: RoleSeed[] = [
	// Administrators always get every permission, including ones added later.
	{ name: ADMINISTRATOR, permissionIds: permissions.map((p) => p.id) },
	{ name: 'User', permissionIds: ['login'] },
	{ name: 'Client Manager', permissionIds: ['login', 'manage-households', 'manage-appointments'] },
	{ name: 'Volunteer Manager', permissionIds: ['login', 'manage-volunteers'] },
	{ name: 'Volunteer', permissionIds: ['login', 'access-volunteer'] },
	{ name: 'Donor Manager', permissionIds: ['login', 'manage-donors'] },
	{ name: 'Inventory Manager', permissionIds: ['login', 'manage-inventory'] }
];

/** Makes the database match the lists above. The lists are the source of truth. */
export async function seedReferenceData() {
	await prisma.$transaction(async (tx) => {
		for (const p of permissions) {
			await tx.permission.upsert({
				where: { id: p.id },
				update: { name: p.name, description: p.description },
				create: p
			});
		}

		for (const r of roles) {
			const existing = await tx.role.findUnique({ where: { name: r.name } });
			const role = existing ?? (await tx.role.create({ data: { name: r.name } }));

			// Roles are edited on the Admin > Roles tab, so a role that already exists keeps the
			// permissions it has. Only a new role gets the permissions listed above, and the
			// Administrator role also gets any permission added later.
			if (!existing || r.name === ADMINISTRATOR) {
				await tx.rolePermission.createMany({
					data: r.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
					skipDuplicates: true
				});
			}
		}
	});
}