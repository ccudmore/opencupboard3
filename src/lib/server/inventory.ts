import { z } from 'zod';
import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';

/** Food inventory: items in categories, each stored at a site, in a room, on a shelf, in a box. */

export type Fail = { ok: false; status: number; message: string };
export type Result<T = object> = ({ ok: true } & T) | Fail;
const fail = (status: number, message: string): Fail => ({ ok: false, status, message });

export const MAX_ITEMS_SHOWN = 500;

/** Categories offered to a brand new inventory. */
export const COMMON_CATEGORIES = [
	'Meat',
	'Dairy',
	'Canned goods',
	'Pasta',
	'Rice and grains',
	'Cereal',
	'Baking supplies',
	'Produce',
	'Bread and bakery',
	'Frozen foods',
	'Snacks',
	'Beverages',
	'Condiments and sauces',
	'Baby food',
	'Personal care'
];

// ---------------------------------------------------------------- categories

const categoryName = z.string().trim().min(1, 'Enter a category name').max(60, 'Use at most 60 characters');

export async function listCategories() {
	const rows = await prisma.inventoryCategory.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { items: true } } } });
	return rows.map((c) => ({ id: c.id, name: c.name, itemCount: c._count.items }));
}

/** Names are unique ignoring upper and lower case, so "Dairy" and "dairy" can't both exist. */
async function nameTaken(name: string, exceptId?: string) {
	const found = await prisma.inventoryCategory.findFirst({
		where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
		select: { id: true }
	});
	return found !== null;
}

export async function createCategory(rawName: string, userId?: string): Promise<Result<{ id: string }>> {
	const parsed = categoryName.safeParse(rawName);
	if (!parsed.success) return fail(400, parsed.error.issues[0].message);
	if (await nameTaken(parsed.data)) return fail(409, 'There is already a category with that name.');
	const c = await prisma.inventoryCategory.create({ data: { name: parsed.data, createdBy: userId } });
	return { ok: true, id: c.id };
}

export async function renameCategory(id: string, rawName: string): Promise<Result> {
	const parsed = categoryName.safeParse(rawName);
	if (!parsed.success) return fail(400, parsed.error.issues[0].message);
	if (await nameTaken(parsed.data, id)) return fail(409, 'There is already a category with that name.');
	const { count } = await prisma.inventoryCategory.updateMany({ where: { id }, data: { name: parsed.data } });
	return count === 0 ? fail(404, 'That category no longer exists.') : { ok: true };
}

/** A category with items in it can't be deleted: move or delete the items first. */
export async function deleteCategory(id: string): Promise<Result> {
	const items = await prisma.inventoryItem.count({ where: { categoryId: id } });
	if (items > 0) {
		return fail(409, `${items} ${items === 1 ? 'item is' : 'items are'} in this category. Move or delete ${items === 1 ? 'it' : 'them'} first.`);
	}
	try {
		await prisma.inventoryCategory.deleteMany({ where: { id } });
	} catch (err) {
		// P2003: an item was added a moment ago
		if ((err as { code?: string })?.code === 'P2003') return fail(409, 'Items were just added to this category.');
		throw err;
	}
	return { ok: true };
}

/** Adds the common categories, but only to an inventory that has none yet. */
export async function addCommonCategories(userId?: string): Promise<Result<{ added: number }>> {
	if ((await prisma.inventoryCategory.count()) > 0) return fail(409, 'This inventory already has categories.');
	const { count } = await prisma.inventoryCategory.createMany({
		data: COMMON_CATEGORIES.map((name) => ({ name, createdBy: userId })),
		skipDuplicates: true
	});
	return { ok: true, added: count };
}

// ---------------------------------------------------------------- items

const optionalLabel = z
	.string()
	.trim()
	.max(30, 'Use at most 30 characters')
	.optional()
	.transform((v) => v || null);

export const itemSchema = z.object({
	name: z.string().trim().min(1, 'Enter the item name').max(120, 'Use at most 120 characters'),
	categoryId: z.string().min(1, 'Choose a category'),
	siteId: z.string().min(1, 'Choose a site'),
	room: z.string().trim().min(1, 'Enter the room').max(60, 'Use at most 60 characters'),
	shelfNumber: optionalLabel,
	boxNumber: optionalLabel,
	quantity: z.coerce.number().int('Use a whole number').min(0, 'Quantity cannot be negative').max(1_000_000),
	notes: z
		.string()
		.trim()
		.max(500, 'Use at most 500 characters')
		.optional()
		.transform((v) => v || null)
});

export type ItemFilters = { categoryId?: string; siteId?: string; q?: string };

export async function listItems({ categoryId, siteId, q }: ItemFilters) {
	const term = (q ?? '').trim();
	const where: Prisma.InventoryItemWhereInput = {
		...(categoryId ? { categoryId } : {}),
		...(siteId ? { siteId } : {}),
		...(term
			? {
					OR: [
						{ name: { contains: term, mode: 'insensitive' } },
						{ room: { contains: term, mode: 'insensitive' } },
						{ shelfNumber: { contains: term, mode: 'insensitive' } },
						{ boxNumber: { contains: term, mode: 'insensitive' } },
						{ notes: { contains: term, mode: 'insensitive' } }
					]
				}
			: {})
	};
	const [items, total] = await Promise.all([
		prisma.inventoryItem.findMany({
			where,
			orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
			take: MAX_ITEMS_SHOWN,
			include: { category: { select: { name: true } }, site: { select: { name: true } } }
		}),
		prisma.inventoryItem.count({ where })
	]);
	return {
		total,
		items: items.map((i) => ({
			id: i.id,
			name: i.name,
			categoryId: i.categoryId,
			categoryName: i.category.name,
			siteId: i.siteId,
			siteName: i.site.name,
			room: i.room,
			shelfNumber: i.shelfNumber ?? '',
			boxNumber: i.boxNumber ?? '',
			quantity: i.quantity,
			notes: i.notes ?? ''
		}))
	};
}

/** Rooms already in use, to suggest while typing a new one. */
export async function listRooms() {
	const rows = await prisma.inventoryItem.findMany({ distinct: ['room'], select: { room: true }, orderBy: { room: 'asc' }, take: 200 });
	return rows.map((r) => r.room);
}

async function checkReferences(categoryId: string, siteId: string): Promise<Fail | null> {
	const [category, site] = await Promise.all([
		prisma.inventoryCategory.findUnique({ where: { id: categoryId }, select: { id: true } }),
		prisma.site.findUnique({ where: { id: siteId }, select: { id: true } })
	]);
	if (!category) return fail(400, 'That category does not exist.');
	if (!site) return fail(400, 'That site does not exist.');
	return null;
}

export async function createItem(fields: Record<string, string>, userId?: string): Promise<Result<{ id: string }>> {
	const parsed = itemSchema.safeParse(fields);
	if (!parsed.success) return fail(400, parsed.error.issues[0].message);
	const bad = await checkReferences(parsed.data.categoryId, parsed.data.siteId);
	if (bad) return bad;
	const item = await prisma.inventoryItem.create({ data: { ...parsed.data, createdBy: userId } });
	return { ok: true, id: item.id };
}

export async function updateItem(id: string, fields: Record<string, string>): Promise<Result> {
	const parsed = itemSchema.safeParse(fields);
	if (!parsed.success) return fail(400, parsed.error.issues[0].message);
	const bad = await checkReferences(parsed.data.categoryId, parsed.data.siteId);
	if (bad) return bad;
	const { count } = await prisma.inventoryItem.updateMany({ where: { id }, data: parsed.data });
	return count === 0 ? fail(404, 'That item no longer exists.') : { ok: true };
}

export async function deleteItem(id: string): Promise<Result> {
	await prisma.inventoryItem.deleteMany({ where: { id } }); // already gone is fine
	return { ok: true };
}
