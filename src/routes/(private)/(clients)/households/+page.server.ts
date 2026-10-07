import type { PageServerLoad } from './$types';
import { searchHousehold, parseHouseholdSearchParams } from '$lib/server/queries/household';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import prisma from '$lib/prisma';
import { superValidate, setError, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { newHouseholdSchema } from '$lib/formschemas/household';
import { redirect } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ url }) => {
	const result = await searchHousehold(parseHouseholdSearchParams(url.searchParams));
	const form = await superValidate(zod4(newHouseholdSchema));

	return { ...result, form };
};

function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export const actions: Actions = {
  createHousehold: async ({ request, locals }) => {
    const form = await superValidate(request, zod4(newHouseholdSchema));
		if (!form.valid) return fail(400, { form });

    let uniqueFound: boolean = false;
    let candidate: string = ""
    do {
      candidate=generateRandomString(4)
        const count = await prisma.household.count( {
          where: {
            uniqueId: {equals: candidate}
          }
        } )
      uniqueFound = (count == 0)
    } while(!uniqueFound)

    let newHosuehold = null
    try {
  	  const { firstName, lastName, email, phone, ...householdWithoutMembers } = form.data;
		  const household = {...householdWithoutMembers, uniqueId: candidate, createdBy: locals.user.name,
        members: {create: {
          firstName: firstName,
          lastName: lastName,
          fullName: firstName + ' ' + lastName,
          email: email,
          phone: phone,
          createdBy: locals.user.name,
          relationship: 'Primary'}
        }
      }
      newHosuehold = await prisma.household.create({
                                data: household })
    } catch (err) {
      console.error(err)
      return message(form, 'Could not save the household. Please try again.', { status: 500 });
    }
    throw redirect(303, '/households/'+newHosuehold.id)
  },
};