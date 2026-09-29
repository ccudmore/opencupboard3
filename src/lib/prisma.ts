//import { PrismaClient } from "../../prisma/src/generated/prisma/client";
import { PrismaClient } from "$prisma/client"
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from '$env/dynamic/private';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

export default prisma;