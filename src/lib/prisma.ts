import { PrismaClient } from "#prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { DATABASE_URL } from "$app/env/private";
if (!DATABASE_URL) throw new Error('DATABASE_URL must be set')

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma;