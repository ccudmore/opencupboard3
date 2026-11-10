import { z } from "zod";
import prisma from "$lib/prisma";
import type { Prisma } from "$prisma/client";

/** Food inventory: items in categories, each stored at a site, in a room, on a shelf, in a box. */

export type Fail = { ok: false; status: number; message: string };
export type Result<T = object> = ({ ok: true } & T) | Fail;
const fail = (status: number, message: string): Fail => ({
  ok: false,
  status,
  message,
});

export const MAX_ITEMS_SHOWN = 500;

/** Categories offered to a brand new inventory. */
export const COMMON_CATEGORIES = [
  "Meat",
  "Dairy",
  "Canned goods",
  "Pasta",
  "Rice and grains",
  "Cereal",
  "Baking supplies",
  "Produce",
  "Bread and bakery",
  "Frozen foods",
  "Snacks",
  "Beverages",
  "Condiments and sauces",
  "Baby food",
  "Personal care",
];

// ---------------------------------------------------------------- categories

/** Categories can be nested this many levels deep (Meat > Beef > Ground). */
export const MAX_DEPTH = 4;

const categoryName = z
  .string()
  .trim()
  .min(1, "Enter a category name")
  .max(60, "Use at most 60 characters");

export type CategoryNode = {
  id: string;
  name: string;
  parentId: string | null;
  depth: number; // 0 for a top-level category
  path: string; // "Meat > Beef"
  itemCount: number; // items directly in this category
  totalCount: number; // items in this category and everything inside it
  childCount: number;
};

type Flat = {
  id: string;
  name: string;
  parentId: string | null;
  _count: { items: number };
};

/** Every category as a tree flattened in display order: each one followed by what is inside it. */
export async function listCategories(): Promise<CategoryNode[]> {
  const rows: Flat[] = await prisma.inventoryCategory.findMany({
    select: {
      id: true,
      name: true,
      parentId: true,
      _count: { select: { items: true } },
    },
  });
  return buildTree(rows);
}

function buildTree(rows: Flat[]): CategoryNode[] {
  const byParent = new Map<string | null, Flat[]>();
  const ids = new Set(rows.map((r) => r.id));
  for (const r of rows) {
    // A parent that somehow isn't there is treated as top level, so nothing is ever hidden
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  for (const list of byParent.values())
    list.sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );

  const out: CategoryNode[] = [];
  const visit = (
    parent: string | null,
    depth: number,
    trail: string[],
    seen: Set<string>,
  ): number => {
    let sum = 0;
    for (const r of byParent.get(parent) ?? []) {
      if (seen.has(r.id)) continue; // a loop in bad data can't hang the page
      const node: CategoryNode = {
        id: r.id,
        name: r.name,
        parentId: parent,
        depth,
        path: [...trail, r.name].join(" > "),
        itemCount: r._count.items,
        totalCount: 0,
        childCount: byParent.get(r.id)?.length ?? 0,
      };
      out.push(node);
      const inside = visit(
        r.id,
        depth + 1,
        [...trail, r.name],
        new Set([...seen, r.id]),
      );
      node.totalCount = r._count.items + inside;
      sum += node.totalCount;
    }
    return sum;
  };
  visit(null, 0, [], new Set());
  return out;
}

/** The id of a category and of every category inside it. */
export function withDescendants(
  categories: CategoryNode[],
  id: string,
): string[] {
  const out = [id];
  for (const c of categories)
    if (c.parentId && out.includes(c.parentId) && !out.includes(c.id))
      out.push(c.id);
  // categories come in tree order (parents first), so one pass finds all levels
  return out;
}

function depthOf(categories: CategoryNode[], parentId: string | null) {
  if (!parentId) return 0;
  const parent = categories.find((c) => c.id === parentId);
  return parent ? parent.depth + 1 : 0;
}

/** How many levels the category at `id` has inside it, counting itself (1 when it has no children). */
function heightOf(categories: CategoryNode[], id: string) {
  const mine = categories.find((c) => c.id === id);
  if (!mine) return 1;
  const inside = withDescendants(categories, id).map(
    (i) => categories.find((c) => c.id === i)?.depth ?? 0,
  );
  return Math.max(...inside) - mine.depth + 1;
}

/** Names are unique among categories with the same parent, ignoring upper and lower case. */
async function nameTaken(
  name: string,
  parentId: string | null,
  exceptId?: string,
) {
  const found = await prisma.inventoryCategory.findFirst({
    where: {
      parentId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}

const cleanParent = (v: string | null | undefined) => (v ? v : null);

export async function createCategory(
  rawName: string,
  rawParentId?: string | null,
  userId?: string,
): Promise<Result<{ id: string }>> {
  const parsed = categoryName.safeParse(rawName);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const parentId = cleanParent(rawParentId);
  if (parentId) {
    const all = await listCategories();
    if (!all.some((c) => c.id === parentId))
      return fail(400, "That parent category does not exist.");
    if (depthOf(all, parentId) >= MAX_DEPTH)
      return fail(
        400,
        `Categories can only be nested ${MAX_DEPTH} levels deep.`,
      );
  }
  if (await nameTaken(parsed.data, parentId))
    return fail(
      409,
      "There is already a category with that name in the same place.",
    );
  const c = await prisma.inventoryCategory.create({
    data: { name: parsed.data, parentId, createdBy: userId },
  });
  return { ok: true, id: c.id };
}

/** Renames a category and/or moves it under another one (or to the top level). */
export async function updateCategory(
  id: string,
  rawName: string,
  rawParentId?: string | null,
): Promise<Result> {
  const parsed = categoryName.safeParse(rawName);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const parentId = cleanParent(rawParentId);

  const all = await listCategories();
  if (!all.some((c) => c.id === id))
    return fail(404, "That category no longer exists.");
  if (parentId) {
    if (!all.some((c) => c.id === parentId))
      return fail(400, "That parent category does not exist.");
    if (withDescendants(all, id).includes(parentId))
      return fail(400, "A category cannot be moved inside itself.");
    if (depthOf(all, parentId) + heightOf(all, id) > MAX_DEPTH)
      return fail(
        400,
        `Categories can only be nested ${MAX_DEPTH} levels deep.`,
      );
  }
  if (await nameTaken(parsed.data, parentId, id))
    return fail(
      409,
      "There is already a category with that name in the same place.",
    );
  const { count } = await prisma.inventoryCategory.updateMany({
    where: { id },
    data: { name: parsed.data, parentId },
  });
  return count === 0
    ? fail(404, "That category no longer exists.")
    : { ok: true };
}

/** A category with items or sub-categories in it can't be deleted. */
export async function deleteCategory(id: string): Promise<Result> {
  const [items, children] = await Promise.all([
    prisma.inventoryItem.count({ where: { categoryId: id } }),
    prisma.inventoryCategory.count({ where: { parentId: id } }),
  ]);
  if (children > 0)
    return fail(
      409,
      `This category has ${children} ${children === 1 ? "category" : "categories"} inside it. Move or delete ${children === 1 ? "it" : "them"} first.`,
    );
  if (items > 0) {
    return fail(
      409,
      `${items} ${items === 1 ? "item is" : "items are"} in this category. Move or delete ${items === 1 ? "it" : "them"} first.`,
    );
  }
  try {
    await prisma.inventoryCategory.deleteMany({ where: { id } });
  } catch (err) {
    // P2003: an item or category was added a moment ago
    if ((err as { code?: string })?.code === "P2003")
      return fail(409, "Something was just added to this category.");
    throw err;
  }
  return { ok: true };
}

/** Adds the common categories, but only to an inventory that has none yet. */
export async function addCommonCategories(
  userId?: string,
): Promise<Result<{ added: number }>> {
  if ((await prisma.inventoryCategory.count()) > 0)
    return fail(409, "This inventory already has categories.");
  const { count } = await prisma.inventoryCategory.createMany({
    data: COMMON_CATEGORIES.map((name) => ({ name, createdBy: userId })),
    skipDuplicates: true,
  });
  return { ok: true, added: count };
}

// ---------------------------------------------------------------- items

const optionalLabel = z
  .string()
  .trim()
  .max(30, "Use at most 30 characters")
  .optional()
  .transform((v) => v || null);

export const itemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the item name")
    .max(120, "Use at most 120 characters"),
  categoryId: z.string().min(1, "Choose a category"),
  siteId: z.string().min(1, "Choose a site"),
  room: z
    .string()
    .trim()
    .min(1, "Enter the room")
    .max(60, "Use at most 60 characters"),
  shelfNumber: optionalLabel,
  boxNumber: optionalLabel,
  quantity: z.coerce
    .number()
    .int("Use a whole number")
    .min(0, "Quantity cannot be negative")
    .max(1_000_000),
  notes: z
    .string()
    .trim()
    .max(500, "Use at most 500 characters")
    .optional()
    .transform((v) => v || null),
});

export type ItemFilters = {
  categoryIds?: string[];
  siteId?: string;
  q?: string;
};

export async function listItems(
  { categoryIds, siteId, q }: ItemFilters,
  categories: CategoryNode[] = [],
) {
  const term = (q ?? "").trim();
  const where: Prisma.InventoryItemWhereInput = {
    ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
    ...(siteId ? { siteId } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { room: { contains: term, mode: "insensitive" } },
            { shelfNumber: { contains: term, mode: "insensitive" } },
            { boxNumber: { contains: term, mode: "insensitive" } },
            { notes: { contains: term, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: MAX_ITEMS_SHOWN,
      include: { site: { select: { name: true } } },
    }),
    prisma.inventoryItem.count({ where }),
  ]);
  return {
    total,
    items: items
      .map((i) => ({
        id: i.id,
        name: i.name,
        categoryId: i.categoryId,
        categoryName: categories.find((c) => c.id === i.categoryId)?.path ?? "",
        siteId: i.siteId,
        siteName: i.site.name,
        room: i.room,
        shelfNumber: i.shelfNumber ?? "",
        boxNumber: i.boxNumber ?? "",
        quantity: i.quantity,
        notes: i.notes ?? "",
      }))
      .sort(
        (a, b) =>
          a.categoryName.localeCompare(b.categoryName) ||
          a.name.localeCompare(b.name),
      ),
  };
}

/** Rooms already in use, to suggest while typing a new one. */
export async function listRooms() {
  const rows = await prisma.inventoryItem.findMany({
    distinct: ["room"],
    select: { room: true },
    orderBy: { room: "asc" },
    take: 200,
  });
  return rows.map((r) => r.room);
}

async function checkReferences(
  categoryId: string,
  siteId: string,
): Promise<Fail | null> {
  const [category, site] = await Promise.all([
    prisma.inventoryCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    }),
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
  ]);
  if (!category) return fail(400, "That category does not exist.");
  if (!site) return fail(400, "That site does not exist.");
  return null;
}

export async function createItem(
  fields: Record<string, string>,
  userId?: string,
): Promise<Result<{ id: string }>> {
  const parsed = itemSchema.safeParse(fields);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const bad = await checkReferences(parsed.data.categoryId, parsed.data.siteId);
  if (bad) return bad;
  const item = await prisma.inventoryItem.create({
    data: { ...parsed.data, createdBy: userId },
  });
  return { ok: true, id: item.id };
}

export async function updateItem(
  id: string,
  fields: Record<string, string>,
): Promise<Result> {
  const parsed = itemSchema.safeParse(fields);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const bad = await checkReferences(parsed.data.categoryId, parsed.data.siteId);
  if (bad) return bad;
  const { count } = await prisma.inventoryItem.updateMany({
    where: { id },
    data: parsed.data,
  });
  return count === 0 ? fail(404, "That item no longer exists.") : { ok: true };
}

export async function deleteItem(id: string): Promise<Result> {
  await prisma.inventoryItem.deleteMany({ where: { id } }); // already gone is fine
  return { ok: true };
}
