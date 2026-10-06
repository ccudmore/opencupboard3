import type { Actions, PageServerLoad } from "./$types"
import prisma from '$lib/prisma';
import { error, fail } from "@sveltejs/kit"
import { superValidate, message } from "sveltekit-superforms/server";
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod'
import { householdSchema } from '$lib/formschemas/household';

/*
const householdSchema = z.strictObject({
	id: z.string().nonempty().optional(),
	street: z.string().nonempty(),
	street2: z.string().optional().nullable(),
	city: z.string().nonempty(),
	province: z.string().default('Ontario'),
	country: z.string().default('Canada'),
	postalCode: z.string().toUpperCase().regex(/^[ABCEGHJ-NPRSTVXYabceghj-nprstvxy]\d[ABCEGHJ-NPRSTV-Zabcegh-nprstv-z][ -]?\d[ABCEGHJ-NPRSTV-Zabceghj-nprstv-z]\d$/),
	status: z.string().default('Active'),
	dietaryRestrictions: z.string().array(),
	pets: z.string().optional(),
	howHeard: z.string().optional(),
	notes: z.string().optional(),
	preferredServiceTypes: z.string().array(),
	preferredTimeOfDay: z.string().array(),
	languagesSpoken: z.string().array(),
	uniqueId: z.string().optional().nullable(),
	createdAt: z.date().optional(),
	createdBy: z.string().optional(),
	appointmentBookings: z.object({
		id: z.string().optional(),
		householdId: z.string(),
		appointmentId: z.string(),
		status: z.string(),
		createdAt: z.date(),
		createdBy: z.string().nullable(),
		notificationSent: z.date().nullish().default(null),
		reminderSent: z.date().nullish().default(null),
		appointment: z.object({
			startTime: z.date(),
			endTime: z.date(),
		}),
	}).array().default([]),
	members: z.object({
		id: z.string().optional(),
		firstName: z.string().nonempty(),
		lastName: z.string().nonempty(),
		fullName: z.string().default(''),
		relationship: z.string().optional(),
		idChecked: z.string().optional().nullable(),
		email: z.email().optional().or(z.literal('')),
		phone: z.string().optional(),
//        phone: z.string().regex(/^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/, 'invalid').optional().or(z.literal('')),
		birthYear: z.int().optional(),
		idCheckDate: z.date().optional().nullable(),
		createdAt: z.date().optional(),
		createdBy: z.string().optional(),
	}).array().default([]),
	datedRequests: z.object({
		id: z.string().optional(),
		requestText: z.string(),
		status: z.string(),
		createdAt: z.date(),
		createdBy: z.string().optional(),
		type: z.string().optional(),
	}).array().default([]),
})
*/
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
		if (!formData.valid) {
			return fail(400,{formData})
		}
		const {id,members,datedRequests,appointmentBookings,...householdWithoutIds} = formData.data
		// add in the fullname for each member
		members.forEach(item => {item.fullName = item.firstName+' '+item.lastName});
		createdBy: locals.user?.id
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
							create: {createdBy: locals.user?.id,...update},
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