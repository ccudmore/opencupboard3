import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { requirePermission } from "$lib/utils";
import { isMailConfigured } from "$lib/server/email/mailer";
import { addVolunteer, lookupEmail } from "$lib/server/volunteerAccounts";

const PERMISSION = ["manage-volunteers"];

export const load: PageServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, PERMISSION);
  return { emailEnabled: isMailConfigured() };
};

const text = (data: FormData, key: string) => String(data.get(key) ?? "");

export const actions: Actions = {
  /** Step 1: what exists for this email? Nothing, a volunteer, or a user who could become one. */
  lookup: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, PERMISSION);
    const r = await lookupEmail(text(await request.formData(), "email"));
    return r.ok
      ? { found: r.found, email: r.email }
      : fail(r.status, { message: r.message });
  },

  /** Step 2: adds the volunteer (creating the user if the email is new). */
  add: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, PERMISSION);
    const data = await request.formData();
    const r = await addVolunteer(
      {
        email: text(data, "email"),
        firstName: text(data, "firstName"),
        lastName: text(data, "lastName"),
        sendInvite: text(data, "sendInvite") === "true",
      },
      locals.user?.id,
    );
    return r.ok
      ? {
          volunteerId: r.volunteerId,
          invite: r.invite,
          inviteMessage: r.inviteMessage ?? "",
        }
      : fail(r.status, { message: r.message });
  },
};
