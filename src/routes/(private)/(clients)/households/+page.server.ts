import type { PageServerLoad } from './$types';
import { searchGuests, parseGuestSearchParams } from '$lib/server/queries/guests';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';

export const load: PageServerLoad = async ({ url }) => {
  return searchGuests(parseGuestSearchParams(url.searchParams));
};

export const actions: Actions = {
  createHousehold: async ({ request, locals }) => {
    // if (!locals.user) return fail(401, { message: 'Not signed in.' }); // wire to Better Auth craig

    console.log('Creating new household...');
    const data = await request.formData();
    console.log(data);
    const name = String(data.get('name') ?? '').trim();
    const address = String(data.get('address') ?? '').trim();

    const errors: { name?: string; address?: string } = {};
    if (!name) errors.name = 'Household name is required.';
    if (!address) errors.address = 'Address is required.';
    if (errors.name || errors.address) return fail(400, { errors });

    try {
//      const household = await prisma.household.create({ data: { name, address } });
//      return { household };
return null;
    } catch (e) {
      console.error(e);
      return fail(500, { message: 'Could not save the household. Please try again.' });
    }
  }
};