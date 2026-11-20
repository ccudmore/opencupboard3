//import { PrismaClient } from "../../prisma/src/generated/prisma/client";
import { PrismaClient } from "$prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { DATABASE_URL } from "$app/env/private";
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma;
