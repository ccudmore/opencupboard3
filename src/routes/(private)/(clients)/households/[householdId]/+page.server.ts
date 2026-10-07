import type { Actions, PageServerLoad } from "./$types"
import prisma from '$lib/prisma';
import { error, fail } from "@sveltejs/kit"
import { superValidate, message } from "sveltekit-superforms/server";
import { zod4 } from 'sveltekit-superforms/adapters';
import { householdSchema } from '$lib/formschemas/household';

export const load: PageServerLoad = async ({params, locals }) => {
  	const household = await prisma.household.findUnique({
		where: {
			id: params.householdId,
			},
			include: { members: true, datedRequests: true },
//			include: { members: true, appointmentBookings: {include: {appointment: true}}, datedRequests: true },
  	});
  	if (!household) {
		throw error(404, "Household not found")
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	const form = await superValidate(household, zod4(householdSchema));
  	return { form , household}

}

export const actions: Actions = {
	updateHousehold: async ( { request, locals} ) => {

		const formData = await superValidate(request, zod4(householdSchema));
		if (!formData.valid) return fail(400, { formData });

		const {id,members,datedRequests,appointmentBookings,...householdWithoutIds} = formData.data
		try {
			await prisma.household.update({
				where: {
					id: id,
				},
				data: {...householdWithoutIds,
					datedRequests :{
          				deleteMany: {
            				householdId: id,
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
            				householdMembershipId: id,
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
	deleteHousehold: async (event) => {
		const id = event.params.householdId
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
}