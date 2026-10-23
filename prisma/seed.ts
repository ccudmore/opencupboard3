import { HouseholdStatus, type Prisma } from './src/generated/prisma/client.js';
import prisma from './db.js';
import { seedReferenceData } from './reference-data.js';
import { createUserWithPassword } from './users.js';
import { PrismaClient, ClientIdentificationType, ClientRelationship, AppointmentBoookingStatus, DatedRequestStatus, ServiceTime, DeliveryType } from "./src/generated/prisma/client.js";

// SAMPLE DATA for development and demos only. Never run this against real data.
// Production gets reference data (seed-reference.ts) and the bootstrap admin.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SAMPLE_DATA !== 'true') {
	console.error('Refusing to load sample data in production (set ALLOW_SAMPLE_DATA=true to override).');
	process.exit(1);
}

const SAMPLE_PASSWORD = process.env.SAMPLE_USER_PASSWORD ?? 'sample-password-123';
const HOUSEHOLD_ID = 'sample-household-1';

const sampleUsers = [
	{ email: 'craig@cudmore.ca', name: 'Craig Cudmore', roleNames: ['Administrator'] },
	{ email: 'admin@example.com', name: 'Sample Admin', roleNames: ['Administrator'] },
	{ email: 'clients@example.com', name: 'Sample Client Manager', roleNames: ['Client Manager'] },
	{ email: 'volunteers@example.com', name: 'Sample Volunteer Manager', roleNames: ['Volunteer Manager'] },
	{ email: 'viewer@example.com', name: 'Sample User', roleNames: ['User'] }
];

/** A date `days` from today at the given time, so sample events are never in the past. */
function at(days: number, hour: number, minute = 0): Date {
	const d = new Date();
	d.setDate(d.getDate() + days);
	d.setHours(hour, minute, 0, 0);
	return d;
}

const sites = [
	{ name: 'Sample Hall A', street: '1 Example Road', city: 'Gloucester' },
	{ name: 'Sample Hall B', street: '2 Example Road', city: 'Gloucester' }
];

const services = [
	{ id: 'sample-service-1', title: 'Day 1 morning', start: at(7, 10), end: at(7, 12) },
	{ id: 'sample-service-2', title: 'Day 1 afternoon', start: at(7, 16), end: at(7, 20) },
	{ id: 'sample-service-3', title: 'Day 2 morning', start: at(8, 10), end: at(8, 12) },
	{ id: 'sample-service-4', title: 'Day 2 afternoon', start: at(8, 16), end: at(8, 20) }
];

const household: Prisma.HouseholdCreateInput = {
	id: HOUSEHOLD_ID,
	uniqueId: 'DEMO',
	status: HouseholdStatus.ACTIVE,
	dietaryRestrictions: ['Halal', 'Lactose Free'],
	pets: 'a dog',
	notes: 'Sample household',
	preferredServiceTypes: [DeliveryType.PICKUP, DeliveryType.DELIVERY],
	preferredTimeOfDay: [ServiceTime.WEDNESDAY_MORNING, ServiceTime.FRIDAY_EVENING],
	howHeard: 'Website',
	street: '123 Example Street',
	street2: '',
	city: 'Ottawa',
	postalCode: 'K2P 1A1',
	province: 'Ontario',
	country: 'Canada',
	createdBy: 'Seed',
	datedRequests: {
		createMany: {
			data: [
				{ status: DatedRequestStatus.ACTIVE, requestText: 'Sample request', type: 'Prayer', createdBy: 'Seed' },
				{ status: DatedRequestStatus.CLOSED, requestText: 'Older sample request', type: 'Prayer', createdBy: 'Seed' }
			]
		}
	},
	members: {
		createMany: {
			data: Array.from({ length: 12 }, (_, i) => ({
				firstName: `Sample${i + 1}`,
				lastName: 'Person',
				idChecked: ClientIdentificationType.DRIVERS_LICENSE,
				birthYear: 1980 + i,
				email: `sample${i + 1}@example.com`,
				phone: '613-555-0100',
				relationship: i < 2 ? ClientRelationship.PRIMARY:ClientRelationship.OTHER,
				createdBy: 'Seed'
			}))
		}
	}
};

async function main() {
	// Roles and permissions must exist before users can be created.
	await seedReferenceData();

	for (const u of sampleUsers) {
		if (await prisma.user.findUnique({ where: { email: u.email } })) continue;
		await createUserWithPassword({ ...u, password: SAMPLE_PASSWORD });
		console.log(`Created user ${u.email} (${u.roleNames.join(', ')})`);
	}

	if (await prisma.household.findUnique({ where: { id: HOUSEHOLD_ID } })) {
		console.log('Sample data already loaded; to reload it, reset the development database.');
		return;
	}

	for (const s of sites) {
		await prisma.site.upsert({ where: { name: s.name }, update: {}, create: s });
	}

	await prisma.household.create({ data: household });
	console.log(`Created household ${HOUSEHOLD_ID}`);

	await prisma.volunteer.createMany({
		data: [
			{ firstName: 'Sample', lastName: 'Volunteer One' },
			{ firstName: 'Sample', lastName: 'Volunteer Two' }
		]
	});

	const location = { connect: { name: sites[0].name } };
	const extraEvents = [
		{ id: 'sample-sorting-1', type: 'Sorting', title: 'Inventory', start: at(9, 10), end: at(9, 12) },
		{ id: 'sample-drive-1', type: 'Food Drives & Events', title: 'Food Drive', start: at(10, 16), end: at(10, 20) }
	];

	for (const e of [...services.map((s) => ({ ...s, type: 'Service Date' })), ...extraEvents]) {
		await prisma.event.upsert({
			where: { id: e.id },
			update: {},
			create: {
				id: e.id,
				type: e.type,
				status: 'Active',
				title: e.title,
				startTime: e.start,
				endTime: e.end,
				note: 'Sample event',
				createdBy: 'Seed',
				location
			}
		});
	}

	// Five 15-minute appointment slots per service. The very first slot gets one
	// active and one cancelled booking so the appointments page has examples.
	for (const [index, s] of services.entries()) {
		for (let slot = 0; slot < 5; slot++) {
			const startTime = new Date(s.start.getTime() + slot * 15 * 60_000);
			const endTime = new Date(startTime.getTime() + 15 * 60_000);
			await prisma.appointment.create({
				data: {
					startTime,
					endTime,
					createdBy: 'Seed',
					event: { connect: { id: s.id } },
					...(index === 0 &&
						slot === 0 && {
							bookings: {
								create: [
									{ status: AppointmentBoookingStatus.ACTIVE, createdBy: 'Seed', household: { connect: { id: HOUSEHOLD_ID } } },
									{ status: AppointmentBoookingStatus.CANCELLED, createdBy: 'Seed', household: { connect: { id: HOUSEHOLD_ID } } }
								]
							}
						})
				}
			});
		}
	}
	console.log('Created sample sites, events and appointments');
}

main()
	.catch((e) => {
		console.error('Seeding error:', e);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());