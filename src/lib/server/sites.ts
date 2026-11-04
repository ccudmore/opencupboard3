import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import prisma from '$lib/prisma';

// Add, edit and delete sites for the Admin pages. The caller has already checked the `admin` permission.

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const optional = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const POSTAL_REGEX = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/;
const postal = z
	.string()
	.transform((v) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
	.refine((v) => v === '' || POSTAL_REGEX.test(v), 'Enter a valid postal code (e.g. A1A 1A1)')
	.transform((v) => (v ? `${v.slice(0, 3)} ${v.slice(3)}` : null));

const siteFields = {
	name: z.string().trim().min(1, 'Enter a name for the site').max(100),
	unitNumber: optional(30),
	street: optional(200),
	city: optional(100),
	postalCode: postal,
	province: z.string().trim().min(1, 'Enter a province').max(100),
	country: z.string().trim().min(1, 'Enter a country').max(100)
};
const createSchema = z.object(siteFields);
const updateSchema = z.object({ siteId: z.string().min(1), ...siteFields });

const read = (fd: FormData) => ({
	name: text(fd, 'name'),
	unitNumber: text(fd, 'unitNumber'),
	street: text(fd, 'street'),
	city: text(fd, 'city'),
	postalCode: text(fd, 'postalCode'),
	province: text(fd, 'province'),
	country: text(fd, 'country')
});

function handleError(err: unknown) {
	if ((err as { code?: string })?.code === 'P2002') return fail(409, { message: 'A site with that name already exists.' });
	console.error(err);
	return fail(500, { message: 'Something went wrong. Please try again.' });
}

/** Every site, with how many things use it. */
export function listSites() {
	return prisma.site.findMany({
		orderBy: { name: 'asc' },
		include: { _count: { select: { events: true, appointments: true, inventoryItems: true } } }
	});
}

export async function createSite(actorId: string | undefined, formData: FormData) {
	const parsed = createSchema.safeParse(read(formData));
	if (!parsed.success) return fail(400, { message: parsed.error.issues[0].message });
	try {
		const site = await prisma.site.create({ data: { ...parsed.data, createdBy: actorId } });
		return { siteId: site.id };
	} catch (err) {
		return handleError(err);
	}
}

export async function updateSite(formData: FormData) {
	const parsed = updateSchema.safeParse({ siteId: text(formData, 'siteId'), ...read(formData) });
	if (!parsed.success) return fail(400, { message: parsed.error.issues[0].message });
	const { siteId, ...data } = parsed.data;
	try {
		await prisma.site.update({ where: { id: siteId }, data });
		return { siteId };
	} catch (err) {
		if ((err as { code?: string })?.code === 'P2025') return fail(404, { message: 'That site no longer exists.' });
		return handleError(err);
	}
}

/** Deletes a site that nothing uses. A site with events, appointments or stock can't be removed. */
export async function deleteSite(formData: FormData) {
	const siteId = text(formData, 'siteId');
	if (!siteId) return fail(400, { message: 'Invalid request.' });
	try {
		const site = await prisma.site.findUnique({
			where: { id: siteId },
			include: { _count: { select: { events: true, appointments: true, inventoryItems: true } } }
		});
		if (!site) return fail(404, { message: 'That site no longer exists.' });
		const { events, appointments, inventoryItems } = site._count;
		if (events + appointments + inventoryItems > 0) {
			return fail(409, {
				message: `${site.name} is in use (${events} events, ${appointments} appointments, ${inventoryItems} inventory items), so it can't be deleted.`
			});
		}
		await prisma.site.delete({ where: { id: siteId } });
		return { deleted: true };
	} catch (err) {
		// a row that arrived after the check, blocked by the database
		if ((err as { code?: string })?.code === 'P2003') return fail(409, { message: "That site is in use, so it can't be deleted." });
		return handleError(err);
	}
}
