import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { requirePermission } from "$lib/utils";
import { getSites } from "$lib/server/queries/booking";
import {
  listCategories,
  listItems,
  listRooms,
  createCategory,
  updateCategory,
  withDescendants,
  deleteCategory,
  addCommonCategories,
  createItem,
  updateItem,
  deleteItem,
  MAX_ITEMS_SHOWN,
  type Fail,
} from "$lib/server/inventory";

// The (inventory) layout requires manage-inventory, but actions run without it, so each one checks again.
const PERMISSION = ["manage-inventory"];

export const load: PageServerLoad = async ({ locals, url }) => {
  requirePermission(locals?.user?.permissions, url, PERMISSION);

  const categoryId = url.searchParams.get("category") ?? "";
  const siteId = url.searchParams.get("site") ?? "";
  const q = url.searchParams.get("q") ?? "";

  const [categories, sites, rooms] = await Promise.all([
    listCategories(),
    getSites(),
    listRooms(),
  ]);
  const selected = categories.some((c) => c.id === categoryId)
    ? categoryId
    : "";
  // Choosing a category shows what is in it and in everything nested inside it
  const list = await listItems(
    {
      categoryIds: selected ? withDescendants(categories, selected) : [],
      siteId,
      q,
    },
    categories,
  );

  return {
    categories,
    sites,
    rooms,
    items: list.items,
    total: list.total,
    limit: MAX_ITEMS_SHOWN,
    allItemCount: categories.reduce((n, c) => n + c.itemCount, 0),
    categoryId: selected,
    siteId,
    q,
  };
};

const fields = (data: FormData) =>
  Object.fromEntries(
    [...data.entries()].filter(([, v]) => typeof v === "string"),
  ) as Record<string, string>;
const bad = (r: Fail) => fail(r.status, { message: r.message });

export const actions: Actions = {
  createItem: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, PERMISSION);
    const r = await createItem(
      fields(await request.formData()),
      locals.user?.id,
    );
    return r.ok ? { id: r.id } : bad(r);
  },

  updateItem: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, PERMISSION);
    const f = fields(await request.formData());
    const r = await updateItem(f.id ?? "", f);
    return r.ok ? { success: true } : bad(r);
  },

  deleteItem: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, PERMISSION);
    const r = await deleteItem(fields(await request.formData()).id ?? "");
    return r.ok ? { success: true } : bad(r);
  },

  createCategory: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, PERMISSION);
    const f = fields(await request.formData());
    const r = await createCategory(f.name ?? "", f.parentId, locals.user?.id);
    return r.ok ? { id: r.id } : bad(r);
  },

  updateCategory: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, PERMISSION);
    const f = fields(await request.formData());
    const r = await updateCategory(f.id ?? "", f.name ?? "", f.parentId);
    return r.ok ? { success: true } : bad(r);
  },

  deleteCategory: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, PERMISSION);
    const r = await deleteCategory(fields(await request.formData()).id ?? "");
    return r.ok ? { success: true } : bad(r);
  },

  addCommonCategories: async ({ locals, url }) => {
    requirePermission(locals?.user?.permissions, url, PERMISSION);
    const r = await addCommonCategories(locals.user?.id);
    return r.ok ? { added: r.added } : bad(r);
  },
};
