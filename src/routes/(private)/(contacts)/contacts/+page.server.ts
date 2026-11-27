import type { Actions, PageServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import {
  CONTACTS_PERMISSION,
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from "#lib/server/contacts.ts";

export const load: PageServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, [CONTACTS_PERMISSION]);
  return { contacts: await listContacts() };
};

// Called with fetch from +page.svelte. Each one checks the permission itself.
export const actions: Actions = {
  createContact: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, [CONTACTS_PERMISSION]);
    return createContact(locals.user?.id, await request.formData());
  },
  updateContact: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, [CONTACTS_PERMISSION]);
    return updateContact(await request.formData());
  },
  deleteContact: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, [CONTACTS_PERMISSION]);
    return deleteContact(await request.formData());
  },
};
