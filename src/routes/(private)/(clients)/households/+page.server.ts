import type { PageServerLoad } from './$types';
import { searchHousehold, parseHouseholdSearchParams } from '$lib/server/queries/household';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import prisma from '$lib/prisma';
import { superValidate, setError, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { newHouseholdSchema } from '$lib/formschemas/household';
import { redirect } from "@sveltejs/kit";
import { requirePermission } from '$lib/server/auth';
import { randomInt } from 'node:crypto';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = requirePermission(locals, url, ['manage-households']);

	const result = await searchHousehold(parseHouseholdSearchParams(url.searchParams));
	const form = await superValidate(zod4(newHouseholdSchema));

	return { ...result, form };
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
/*
function generateRandomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return result;
}
*/

function generateUniqueId(length = 4): string {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ALPHABET[randomInt(ALPHABET.length)];
  }
  return id;
}

export const actions: Actions = {
  createHousehold: async ({ request, locals, url }) => {
    const user = requirePermission(locals, url, ['manage-households']);
    
    const form = await superValidate(request, zod4(newHouseholdSchema));
		if (!form.valid) return fail(400, { form });
/*
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
*/
    let newHosuehold = null
    try {
  	  const { firstName, lastName, email, phone, ...householdWithoutMembers } = form.data;
		  const household = {...householdWithoutMembers, uniqueId: generateUniqueId(), createdBy: user.name,
        members: {create: {
          firstName: firstName,
          lastName: lastName,
          email: email,
          phone: phone,
          createdBy: user.name,
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