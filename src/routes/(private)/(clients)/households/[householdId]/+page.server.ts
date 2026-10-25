import type { Actions, PageServerLoad } from "./$types"
import prisma from '$lib/prisma';
import { error, fail } from "@sveltejs/kit"
import { superValidate, message } from "sveltekit-superforms/server";
import { zod4 } from 'sveltekit-superforms/adapters';
import { householdSchema } from '$lib/formschemas/household';
import type { HouseholdWithRelations, } from "$lib/types/household";
import { householdInclude } from '$lib/server/household';
import { requirePermission, calculateNextServiceDate } from '$lib/utils';
import { getHouseholdBookings, getAvailableServices } from '$lib/server/queries/booking';
import { isMailConfigured } from '$lib/server/email/mailer';
import { createBooking, updateBooking, deleteBooking, previewConfirmation, sendConfirmation } from '$lib/server/bookingActions';

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

	// The household form does not carry bookings; they have their own queries below
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { bookings: _bookings, ...household } = householdAll;
	const form = await superValidate(household, zod4(householdSchema));

	const [bookings, services] = await Promise.all([
		getHouseholdBookings(params.householdId),
		getAvailableServices()
	]);

	return {
		form,
		bookings,            // newest first, including "unscheduled" ones
		services,            // future service dates with open appointments
		eligibleDate: calculateNextServiceDate(bookings), // null = eligible now
		emailEnabled: isMailConfigured()
	}
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

	// ---- Bookings (called with fetch from Bookings.svelte) ----
	// Everything below needs the manage-households permission.

	createBooking: async ({ request, locals, url, params }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-households']);
		return createBooking(params.householdId, locals.user?.id, await request.formData());
	},

	updateBooking: async ({ request, locals, url, params }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-households']);
		return updateBooking(params.householdId, locals.user?.id, await request.formData());
	},

	deleteBooking: async ({ request, locals, url, params }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-households']);
		return deleteBooking(params.householdId, await request.formData());
	},

	previewConfirmation: async ({ request, locals, url, params }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-households']);
		return previewConfirmation(params.householdId, await request.formData());
	},

	sendConfirmation: async ({ request, locals, url, params }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-households']);
		return sendConfirmation(params.householdId, locals.user?.id, await request.formData());
	},
}
