import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// Shared database client for the scripts in this folder (seed, reference data,
// bootstrap admin). The app itself uses src/lib/prisma.ts.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

export default prisma;