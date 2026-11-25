import type { Actions, PageServerLoad } from "./$types";
import prisma from "#lib/prisma.ts";
import { error, fail } from "@sveltejs/kit";
import { superValidate, message } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { householdSchema } from "#lib/formschemas/household.ts";
import type { HouseholdWithRelations } from "#lib/types/household.ts";
import { householdInclude } from "#lib/server/household.ts";
import { requirePermission, calculateNextServiceDate } from "#lib/utils.ts";
import {
  getHouseholdBookings,
  getAvailableServices,
  getSites,
} from "#lib/server/queries/booking.ts";
import { noteHouseholdStatus } from "#lib/server/statusHistory.ts";
import { geocodeHouseholdLater } from "#lib/server/geocode.ts";
import { isMailConfigured } from "#lib/server/email/mailer.ts";
import {
  createBooking,
  updateBooking,
  deleteBooking,
  previewEmail,
  sendEmail,
} from "#lib/server/bookingActions.ts";

export const load: PageServerLoad = async ({ params, locals, url }) => {
  requirePermission(locals?.user?.permissions, url, ["manage-households"]);
  const householdAll: HouseholdWithRelations | null =
    await prisma.household.findUnique({
      where: {
        id: params.householdId,
      },
      include: householdInclude,
    });
  if (!householdAll) {
    throw error(404, "Household not found");
  }

  // The household form does not carry bookings; they have their own queries below
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bookings: _bookings, ...household } = householdAll;
  const form = await superValidate(household, zod4(householdSchema));

  const [bookings, services, sites] = await Promise.all([
    getHouseholdBookings(params.householdId),
    getAvailableServices(),
    getSites(),
  ]);

  // "created by" is stored as the user's id; show the name instead
  const creatorIds = [
    household.createdBy,
    ...household.members.map((m) => m.createdBy),
    ...household.datedRequests.map((d) => d.createdBy),
  ].filter((id): id is string => !!id);
  const creators = creatorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: [...new Set(creatorIds)] } },
        select: { id: true, name: true },
      })
    : [];
  const userNames: Record<string, string> = Object.fromEntries(
    creators.map((u) => [u.id, u.name]),
  );

  return {
    form,
    userNames, // user id -> name, for the "created by" lines
    bookings, // newest first, including "unscheduled" ones
    services, // future service dates with open appointments
    sites, // locations for unscheduled bookings
    eligibleDate: calculateNextServiceDate(bookings), // null = eligible now
    emailEnabled: isMailConfigured(),
  };
};

export const actions: Actions = {
  updateHousehold: async ({ request, locals, url, params }) => {
    requirePermission(locals?.user?.permissions, url, ["manage-households"]);

    const formData = await superValidate(request, zod4(householdSchema));
    if (!formData.valid) return fail(400, { formData });
    const {
      id,
      members,
      datedRequests,
      appointmentBookings,
      uniqueId,
      createdAt,
      createdBy,
      ...householdWithoutIds
    } = formData.data;
    try {
      await prisma.household.update({
        where: {
          id: params.householdId,
        },
        data: {
          ...householdWithoutIds,
          datedRequests: {
            deleteMany: {
              householdId: params.householdId,
              NOT: datedRequests
                .filter((update) => "id" in update && update != null)
                ?.map(({ id }) => ({ id })),
            },
            upsert: datedRequests.map((update) => ({
              where: { id: "id" in update ? update.id : "false" },
              create: { createdBy: locals.user?.id, ...update },
              update: update,
            })),
          },
          members: {
            deleteMany: {
              householdMembershipId: params.householdId,
              NOT: members
                .filter((update) => "id" in update && update != null)
                ?.map(({ id }) => ({ id })),
            },
            upsert: members.map((update) => ({
              where: { id: "id" in update ? update.id : "false" },
              create: { createdBy: locals.user?.id, ...update },
              update: update,
            })),
          },
        },
        include: { members: true, datedRequests: true },
      });
    } catch (err) {
      console.error(err);
      return fail(500, { message: "Could not update household" });
    }
    await noteHouseholdStatus(
      prisma,
      params.householdId,
      formData.data.status,
      locals.user?.id,
    );
    geocodeHouseholdLater(params.householdId); // only looks up again if the address changed
    return { formData };
  },

  // ---- Bookings (called with fetch from Bookings.svelte) ----
  // Everything below needs the manage-households permission.

  createBooking: async ({ request, locals, url, params }) => {
    requirePermission(locals?.user?.permissions, url, ["manage-households"]);
    return createBooking(
      params.householdId,
      locals.user?.id,
      await request.formData(),
    );
  },

  updateBooking: async ({ request, locals, url, params }) => {
    requirePermission(locals?.user?.permissions, url, ["manage-households"]);
    return updateBooking(
      params.householdId,
      locals.user?.id,
      await request.formData(),
    );
  },

  deleteBooking: async ({ request, locals, url, params }) => {
    requirePermission(locals?.user?.permissions, url, ["manage-households"]);
    return deleteBooking(params.householdId, await request.formData());
  },

  previewEmail: async ({ request, locals, url, params }) => {
    requirePermission(locals?.user?.permissions, url, ["manage-households"]);
    return previewEmail(params.householdId, await request.formData());
  },

  sendEmail: async ({ request, locals, url, params }) => {
    requirePermission(locals?.user?.permissions, url, ["manage-households"]);
    return sendEmail(
      params.householdId,
      locals.user?.id,
      await request.formData(),
    );
  },
};
