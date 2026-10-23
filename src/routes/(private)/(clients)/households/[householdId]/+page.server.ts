import type { Actions, PageServerLoad } from "./$types"
import prisma from '$lib/prisma';
import { error, fail } from "@sveltejs/kit"
import { superValidate, message } from "sveltekit-superforms/server";
import { zod4 } from 'sveltekit-superforms/adapters';
import { householdSchema } from '$lib/formschemas/household';
import type { HouseholdWithRelations, } from "$lib/types/household";
import { householdInclude } from '$lib/server/household';
import { requirePermission } from '$lib/utils';

export const load: PageServerLoad = async ({params, locals, url }) => {
	requirePermission(locals?.user?.permissions, url, ['manage-households']);
  	const householdAll: HouseholdWithRelations | null = await prisma.household.findUnique({
		where: {
			id: params.householdId,
		},
		include: householdInclude
  	});
  	if (!householdAll) {
		throw error(404, "Household not found")
	}
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore

	const {bookings, ...household} = householdAll;
	const form = await superValidate(household, zod4(householdSchema));
  	return { form , bookings} // craig - maybe bookings is in its own form?
}

export const actions: Actions = {
	updateHousehold: async ( { request, locals, url, params} ) => {
		requirePermission(locals?.user?.permissions, url, ['manage-households']);

		const formData = await superValidate(request, zod4(householdSchema));
		if (!formData.valid) return fail(400, { formData });
		const {id,members,datedRequests,appointmentBookings,uniqueId,createdAt,createdBy,...householdWithoutIds} = formData.data
		try {
			await prisma.household.update({
				where: {
					id: params.householdId,
				},
				data: {...householdWithoutIds,
					datedRequests :{
          				deleteMany: {
            				householdId: params.householdId,
            				NOT: datedRequests.filter(update =>("id" in update)&&(update != null))?.map(({id}) => ({id}))
          				},
          				upsert: datedRequests.map((update)=>({
            				where: {id: ("id" in update)?update.id:"false" },
			            	create: {createdBy: locals.user?.id, ...update},
							update: update
         				}))
					},
					members: {
          				deleteMany: {
            				householdMembershipId: params.householdId,
            				NOT: members.filter(update =>("id" in update)&&(update != null))?.map(({id}) => ({id}))
          				},
          				upsert: members.map((update)=>({
            				where: {id: ("id" in update)?update.id:"false" },
							create: {createdBy: locals.user?.id,...update, },
            				update: update
         				 }))
       				 }
      			},
      			include: {members:true, datedRequests: true}
			})
		} catch (err) {
			console.error(err)
			return fail(500, { message: "Could not update household" })
		}
		return { formData }
	},
	/*
	deleteHousehold: async ( { request, params, locals, url} ) => {
		const user = requirePermission(locals, url, ['manage-households']);
		const id = params.householdId
		
		if (!id) {
			return fail(400, { message: "Invalid request" })
		}
		try {
			await prisma.household.delete({
				where: {
					id: id,
				},
			})
		} catch (err) {
			console.error(err)
			return fail(500, {
				message: "Something went wrong deleting your household",
			})
		}
	},
	*/
}