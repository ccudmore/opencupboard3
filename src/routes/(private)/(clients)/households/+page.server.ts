import type { Prisma } from "$prisma/client"
import prisma from '$lib/prisma';
import type { PageServerLoad } from './$types';
import { searchGuests, parseGuestSearchParams } from '$lib/server/queries/guests';

const PAGE_SIZE = 10;



export const load: PageServerLoad = async ({ url }) => {
  return searchGuests(parseGuestSearchParams(url.searchParams));
  /*
	const q = url.searchParams.get('q')?.trim() ?? '';
  	const s = url.searchParams.get('s');
  	const activeOnly = s === 'active';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const searchFilter: Prisma.GuestWhereInput = q
		? {
			OR: [
				{ firstName: { contains: q, mode: 'insensitive' } },
				{ lastName: { contains: q, mode: 'insensitive' } },
				{ phone: { contains: q } },
				{ memberOf: {street: {contains: q, mode: 'insensitive' } } },
            	{ memberOf: {city: {contains: q, mode: 'insensitive' } } },
            	{ memberOf: {postalCode: {contains: q, mode: 'insensitive' } } },
            	{ email: {contains: q, mode: 'insensitive' } },
	            { fullName: {contains: q, mode: 'insensitive' } },
			]
		}
		: {};

	const statusFilter: Prisma.GuestWhereInput = activeOnly
    	? { memberOf: { status: 'Active' } }
    	: {};

	const primaryUserFilter: Prisma.GuestWhereInput = activeOnly
    	? { relationship: 'Primary' }
    	: {};


	const where: Prisma.GuestWhereInput = {
    	AND: [searchFilter, statusFilter, primaryUserFilter]
  	};

	const [guests, total] = await Promise.all([
		prisma.guest.findMany({
			where,
			orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
			skip: (page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
			include: {memberOf: true}
		}),
		prisma.guest.count({ where })
	]);

	return { guests, total, page, pageSize: PAGE_SIZE, q };
	*/
};