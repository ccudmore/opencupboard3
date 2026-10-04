import { PrismaClient, Prisma } from "./src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

const DEFAULT_ADMIN_PASSWORD = "password"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

type SeedUser = {
  data: { name: string; email: string; image: string };
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
	data: { name: string; email: string; image: string },
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
  { name: 'View dashboard', description: '', protectedRoutes: ['/dashboard']},
]

const roleData: SeedRole[] = [
{roleName: 'Administrator', permissionNames: ['Log in', 'Manage guests', 'Manage system configuration', 'Manage volunteers', 'Manage inventory', 'Manage donors', 'View dashboard']},
{roleName: 'User', permissionNames: ['Log in']},
{roleName: 'Guest Manager', permissionNames: ['Log in', 'Manage guests']},
{roleName: 'Volunteer Manager', permissionNames: ['Log in', 'Manage volunteers']},
{roleName: 'Donor Manager', permissionNames: ['Log in', 'Manage donors']},
{roleName: 'Inventory Manager', permissionNames: ['Log in', 'Manage inventory']},
];

const seedUsers: SeedUser[] = [
  { data: { name: "Alice", email: "alice@prisma.io", image: ''}, roleNames: ["Administrator"], },
  { data: { name: "CraigC", email: "craig@cudmore.ca", image: 'https://lh3.googleusercontent.com/a/ACg8ocI7EteRgKFDjpb5KHFiJVE1gDAlX-JB68IhU_7D7sHuDQ_TEQ=s96-c', }, roleNames: ["Administrator", "User", "Guest Manager"], },
  { data: { name: "CraigC2", email: "craig.cudmore@gmail.com", image: ''}, roleNames: ["User"], },
  { data: { name: "LindaC", email: "linda@cudmore.ca", image: ''}, roleNames: ["User", "Guest Manager"], },
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
            {firstName: 'Linda2', lastName: 'Cudmore', fullName: 'Linda2 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda2@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda3', lastName: 'Cudmore', fullName: 'Linda3 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda3@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda4', lastName: 'Cudmore', fullName: 'Linda4 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda4@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda5', lastName: 'Cudmore', fullName: 'Linda5 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda5@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda6', lastName: 'Cudmore', fullName: 'Linda6 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda6@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda7', lastName: 'Cudmore', fullName: 'Linda7 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda7@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda8', lastName: 'Cudmore', fullName: 'Linda8 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda8@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda9', lastName: 'Cudmore', fullName: 'Linda9 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda9@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda10', lastName: 'Cudmore', fullName: 'Linda10 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda10@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda11', lastName: 'Cudmore', fullName: 'Linda11 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda11@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda12', lastName: 'Cudmore', fullName: 'Linda12 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda12@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda13', lastName: 'Cudmore', fullName: 'Linda13 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda13@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda14', lastName: 'Cudmore', fullName: 'Linda14 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda14@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda15', lastName: 'Cudmore', fullName: 'Linda15 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda15@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda16', lastName: 'Cudmore', fullName: 'Linda16 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda16@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda17', lastName: 'Cudmore', fullName: 'Linda17 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda17@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda18', lastName: 'Cudmore', fullName: 'Linda18 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda18@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda19', lastName: 'Cudmore', fullName: 'Linda19 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda19@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda20', lastName: 'Cudmore', fullName: 'Linda20 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda20@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda21', lastName: 'Cudmore', fullName: 'Linda21 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda21@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda22', lastName: 'Cudmore', fullName: 'Linda22 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda22@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda23', lastName: 'Cudmore', fullName: 'Linda23 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda23@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda24', lastName: 'Cudmore', fullName: 'Linda24 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda24@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda25', lastName: 'Cudmore', fullName: 'Linda25 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda25@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda26', lastName: 'Cudmore', fullName: 'Linda26 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda26@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda27', lastName: 'Cudmore', fullName: 'Linda27 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda27@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda28', lastName: 'Cudmore', fullName: 'Linda28 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda28@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda29', lastName: 'Cudmore', fullName: 'Linda29 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda29@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda30', lastName: 'Cudmore', fullName: 'Linda30 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda30@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda31', lastName: 'Cudmore', fullName: 'Linda31 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda31@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda32', lastName: 'Cudmore', fullName: 'Linda32 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda32@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda33', lastName: 'Cudmore', fullName: 'Linda33 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda33@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda34', lastName: 'Cudmore', fullName: 'Linda34 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda34@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
            {firstName: 'Linda35', lastName: 'Cudmore', fullName: 'Linda35 Cudmore', idChecked: 'health card', birthYear: 1967, email: 'linda35@cudmore.ca', phone: '123-4567', relationship: 'Secondary', createdBy: 'Seed'},
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