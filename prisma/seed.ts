import { PrismaClient, Prisma } from "./src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import bcrypt from 'bcryptjs'
import { hashPassword } from "better-auth/crypto";

const DEFAULT_ADMIN_PASSWORD = "password"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

type SeedUser = {
  data: { name: string; email: string; };
  roleNames: string[];
};

type SeedRole = {
  roleName: string;
  permissionNames: string[];
};

async function createRoleWithNewPermissions(roleName: string, permissionNames: string[]) {
	return prisma.role.create({
		data: {
			name: roleName,
			permissions: {
				create: permissionNames.map((name) => ({
					permission: {
						connectOrCreate: {
							where: { name },
							create: { name }
						}
					}
				}))
			}
		}
	});
}

async function createUserWithRoles(
	data: { name: string; email: string; },
	roleNames: string[]
) {
	const user = await prisma.user.create({
		data: {
			...data,
      id: data.email,
      emailVerified: true,
			roles: {
				create: roleNames.map((name) => ({
					role: { connect: { name } }
				}))
			}
		},
		include: { roles: { include: { role: true } } }
	});
  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  await prisma.account.create({
    data: {
        id: randomUUID(),
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
    },
  });

  return user
}

const permissionData: Prisma.PermissionCreateInput[] = [
  { name: 'Log in', protectedRoutes: ['/']},
  { name: 'Manage guests', description: '', protectedRoutes: ['/guests']},
  { name: 'Manage system configuration', description: '', protectedRoutes: ['/admin']},
  { name: 'Manage volunteers', description: '', protectedRoutes: ['/volunteers']},
  { name: 'Manage inventory', description: '', protectedRoutes: ['/inventory']},
  { name: 'Manage donors', description: '', protectedRoutes: ['/donors']},
]

const roleData: SeedRole[] = [
{roleName: 'Administrator', permissionNames: ['Log in', 'Manage guests', 'Manage system configuration', 'Manage volunteers', 'Manage inventory', 'Manage donors']},
{roleName: 'User', permissionNames: ['Log in']},
{roleName: 'Guest Manager', permissionNames: ['Log in', 'Manage guests']},
{roleName: 'Volunteer Manager', permissionNames: ['Log in', 'Manage volunteers']},
{roleName: 'Donor Manager', permissionNames: ['Log in', 'Manage donors']},
{roleName: 'Inventory Manager', permissionNames: ['Log in', 'Manage inventory']},
];

const seedUsers: SeedUser[] = [
  { data: { name: "Alice", email: "alice@prisma.io", }, roleNames: ["Administrator"], },
  { data: { name: "CraigC", email: "craig@cudmore.ca", }, roleNames: ["Administrator"], },
  { data: { name: "CraigC2", email: "craig.cudmore@gmail.com", }, roleNames: ["User"], },
  { data: { name: "LindaC", email: "linda@cudmore.ca", }, roleNames: ["User", "Guest Manager"], },
];


const householdData: Prisma.HouseholdCreateInput[] = [
  {
    uniqueId: 'ABCD', status: 'Active', dietaryRestrictions: ['Halal', 'Lactose Free'], pets: 'a dog', notes: 'note1, note2',preferredServiceTypes: ['pickup', 'delivery'], preferredTimeOfDay: ['wednesday afternoons', 'friday mornings'], howHeard: 'Google', street: '741 Rolling River Cres', postalCode: 'K1V1M2', province: 'Ontario', country: 'Canada', createdBy: 'CraigC', city: 'Ottawa',
        datedRequests: {
          createMany: {data: [
            {status: 'Active', requestText: 'for rain', createdBy: 'CraigC' , type: 'Prayer'},
            {status: 'Closed', requestText: 'for health', createdBy: 'CraigC', type: 'Prayer'},
          ]}
        },
        members: {
          createMany: { data: [
            {firstName: 'Craig', lastName: 'Cudmore', fullName: 'Craig Cudmore', idChecked: 'drivers license', birthYear: 1966, email: 'craig@cudmore.ca', phone: '555-1212', relationship: 'Primary', createdBy: 'Seed'},
            {firstName: 'Linda', lastName: 'Cudmore', fullName: 'Linda Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda@cudmore.ca', phone: '123-4567', relationship: 'Primary', createdBy: 'Seed'},
          ]}
        }
      }
];

const volunteerData: Prisma.VolunteerCreateInput[] = [
  {firstName: 'Craig', lastName: 'Volunteer', fullName: 'Craig Volunteer'},
  {firstName: 'Linda', lastName: 'Volunteer', fullName: 'Linda Volunteer'}
];

const siteData: Prisma.SiteCreateInput[] = [
  {street: '3740 Spratt Rd', city: 'Gloucester',name: 'St FX'},
  {street: '3740 Spratt Rd', city: 'Gloucester',name: 'The Gathering'},
  {street: '3740 Spratt Rd', city: 'Gloucester',name: 'Brierleys YIG'},
];

const eventData: Prisma.EventCreateInput[] = [
  {id: 'event-monday-morning', type: 'Service', status: 'Active', title: 'Monday morning',startTime: new Date('2026-11-10 10:00:00'), endTime: new Date('2026-11-10 12:00:00'), note: 'Note 1', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}},
  {id: 'event-monday-evening', type: 'Service', status: 'Active', title: 'Monday afternoon',startTime: new Date('2026-11-10 16:00:00'), endTime: new Date('2026-11-10 20:00:00'), note: 'Note 2', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}},
  {id: 'event-tuesday-morning', type: 'Service', status: 'Active', title: 'Tuesday morning',startTime: new Date('2026-11-11 10:00:00'), endTime: new Date('2026-11-11 12:00:00'), note: 'Note 3', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}},
  {id: 'event-tuesday-evening', type: 'Service', status: 'Active', title: 'Tuesday afternoon',startTime: new Date('2026-11-11 16:00:00'), endTime: new Date('2026-11-11 20:00:00'), note: 'Note 4', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}},
  {type: 'Sorting', status: 'Active', title: 'Restocking',startTime: new Date('2026-11-12 10:00:00'), endTime: new Date('2026-11-12 12:00:00'), note: 'Note 1', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}},
  {type: 'Food Drive', status: 'Active', title: 'Food Drive',startTime: new Date('2026-11-13 16:00:00'), endTime: new Date('2026-11-13 20:00:00'), note: 'Note 2', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}},
];

const appointmentData: Prisma.AppointmentCreateInput[] = [
  {startTime: new Date('2026-11-10 10:00:00'), endTime: new Date('2026-11-10 10:15:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-morning'}} },
  {startTime: new Date('2026-11-10 10:15:00'), endTime: new Date('2026-11-10 10:30:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-morning'}} },
  {startTime: new Date('2026-11-10 10:30:00'), endTime: new Date('2026-11-10 10:45:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-morning'}} },
  {startTime: new Date('2026-11-10 10:45:00'), endTime: new Date('2026-11-10 11:00:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-morning'}} },
  {startTime: new Date('2026-11-10 11:00:00'), endTime: new Date('2026-11-10 11:15:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-morning'}} },
  {startTime: new Date('2026-11-10 16:00:00'), endTime: new Date('2026-11-10 16:15:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-evening'}} },
  {startTime: new Date('2026-11-10 16:15:00'), endTime: new Date('2026-11-10 16:30:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-evening'}} },
  {startTime: new Date('2026-11-10 16:30:00'), endTime: new Date('2026-11-10 16:45:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-evening'}} },
  {startTime: new Date('2026-11-10 16:45:00'), endTime: new Date('2026-11-10 17:00:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-evening'}} },
  {startTime: new Date('2026-11-10 17:00:00'), endTime: new Date('2026-11-10 17:15:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-monday-evening'}} },
  {startTime: new Date('2026-11-11 10:00:00'), endTime: new Date('2026-11-11 10:15:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-morning'}} },
  {startTime: new Date('2026-11-11 10:15:00'), endTime: new Date('2026-11-11 10:30:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-morning'}} },
  {startTime: new Date('2026-11-11 10:30:00'), endTime: new Date('2026-11-11 10:45:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-morning'}} },
  {startTime: new Date('2026-11-11 10:45:00'), endTime: new Date('2026-11-11 11:00:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-morning'}} },
  {startTime: new Date('2026-11-11 11:00:00'), endTime: new Date('2026-11-11 11:15:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-morning'}} },
  {startTime: new Date('2026-11-11 16:00:00'), endTime: new Date('2026-11-11 16:15:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-evening'}} },
  {startTime: new Date('2026-11-11 16:15:00'), endTime: new Date('2026-11-11 16:30:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-evening'}} },
  {startTime: new Date('2026-11-11 16:30:00'), endTime: new Date('2026-11-11 16:45:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-evening'}} },
  {startTime: new Date('2026-11-11 16:45:00'), endTime: new Date('2026-11-11 17:00:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-evening'}} },
  {startTime: new Date('2026-11-11 17:00:00'), endTime: new Date('2026-11-11 17:15:00'), status: 'Active', createdBy: 'CraigC', location: {connect: {name: 'Brierleys YIG'}}, event: {connect: {id: 'event-tuesday-evening'}} },
]

export async function main() {

  for (const p of permissionData) {
    await prisma.permission.create({ data: p });
    console.log(`Created permission ${p.name}`);

  }
  for (const r of roleData) {
    await createRoleWithNewPermissions(r.roleName, r.permissionNames);
    console.log(`Created role ${r.roleName}`);
  }
  
   for (const { data, roleNames } of seedUsers) {
    await createUserWithRoles(data, roleNames);
    console.log(`Created user ${data.email} with roles: ${roleNames.join(", ")}`);
  }
  
  for (const hh of householdData) {
    await prisma.household.create({ data: hh });
    console.log(`Created household ${hh.id}`);
  }
  
  for (const vv of volunteerData) {
    await prisma.volunteer.create({ data: vv });
    console.log(`Created volunteer ${vv.fullName}`);
  }
  for (const ss of siteData) {
    await prisma.site.create({ data: ss });
    console.log(`Created site ${ss.name}`);
  }
  for (const ee of eventData) {
    await prisma.event.create({ data: ee });
    console.log(`Created event ${ee.title}`);
  }
  
  for (const aa of appointmentData) {
    await prisma.appointment.create({ data: aa });
    console.log(`Created appointment ${aa.startTime}`);
  }

}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });