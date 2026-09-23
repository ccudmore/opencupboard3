import { PrismaClient } from "../../prisma/src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
 import { env } from '$env/dynamic/private';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

export default prisma;


// craig do this later
// See - https://authjs.dev/getting-started/adapters/prisma
// Or https://www.prisma.io/docs/guides/authentication/better-auth/nextjs
/*
import { PrismaClient } from "../src/generated/client"
import { withAccelerate } from "@prisma/extension-accelerate"
 
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
 
export const prisma =
  globalForPrisma.prisma || new PrismaClient().$extends(withAccelerate())
 
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaimport { PrismaClient } from "../src/generated/client"
import { withAccelerate } from "@prisma/extension-accelerate"
 
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
 
export const prisma =
  globalForPrisma.prisma || new PrismaClient().$extends(withAccelerate())
 
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
*/