import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { hasPermission, requirePermission } from "$lib/utils";
import { maxUploadBytes, ALLOWED_EXTENSIONS } from "$lib/server/documentTypes";
import {
  MAX_RECEIPTS,
  MAX_ROWS,
  addReceipt,
  createExpense,
  decide,
  deleteReceipt,
  listAll,
  listMine,
  validDateParam,
  type Fail,
} from "$lib/server/expenses";

const bad = (r: Fail) => fail(r.status, { message: r.message });

export const load: PageServerLoad = async ({ locals, url }) => {
  const permissions = locals?.user?.permissions;
  requirePermission(permissions, url, ["submit-expenses", "manage-expenses"]);

  const canSubmit = !!hasPermission(permissions, ["submit-expenses"]);
  const canManage = !!hasPermission(permissions, ["manage-expenses"]);

  // Managers see pending expenses unless they switch it off (?pending=0)
  const pendingOnly = url.searchParams.get("pending") !== "0";
  const from = validDateParam(url.searchParams.get("from"));
  const to = validDateParam(url.searchParams.get("to"));

  const [mine, all] = await Promise.all([
    canSubmit && locals.user ? listMine(locals.user.id) : Promise.resolve([]),
    canManage ? listAll({ pendingOnly, from, to }) : Promise.resolve(null),
  ]);

  return {
    canSubmit,
    canManage,
    mine,
    all,
    filters: { pendingOnly, from, to },
    limits: {
      maxReceipts: MAX_RECEIPTS,
      maxRows: MAX_ROWS,
      maxMb: Math.round(maxUploadBytes() / 1024 / 1024),
      accept: ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(","),
    },
  };
};

export const actions: Actions = {
  /** Creates a pending expense. The receipts follow, one request each (addReceipt). */
  submit: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, ["submit-expenses"]);
    if (!locals.user) return fail(401, { message: "Please sign in again." });
    const r = await createExpense(locals.user.id, await request.formData());
    return r.ok ? { id: r.id } : bad(r);
  },

  addReceipt: async ({ request, locals, url }) => {
    const permissions = locals?.user?.permissions;
    requirePermission(permissions, url, ["submit-expenses", "manage-expenses"]);
    if (!locals.user) return fail(401, { message: "Please sign in again." });
    const data = await request.formData();
    const r = await addReceipt(
      String(data.get("expenseId") ?? ""),
      locals.user.id,
      !!hasPermission(permissions, ["manage-expenses"]),
      data.get("file"),
    );
    return r.ok ? { id: r.id } : bad(r);
  },

  deleteReceipt: async ({ request, locals, url }) => {
    const permissions = locals?.user?.permissions;
    requirePermission(permissions, url, ["submit-expenses", "manage-expenses"]);
    if (!locals.user) return fail(401, { message: "Please sign in again." });
    const r = await deleteReceipt(
      String((await request.formData()).get("receiptId") ?? ""),
      locals.user.id,
      !!hasPermission(permissions, ["manage-expenses"]),
    );
    return r.ok ? { success: true } : bad(r);
  },

  /** A manager's decision: pending, approved, rejected, or reimbursed (with date and method). */
  decide: async ({ request, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, ["manage-expenses"]);
    if (!locals.user) return fail(401, { message: "Please sign in again." });
    const data = await request.formData();
    const r = await decide(
      String(data.get("expenseId") ?? ""),
      locals.user.id,
      data,
    );
    return r.ok ? { success: true } : bad(r);
  },
};
