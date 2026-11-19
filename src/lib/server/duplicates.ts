import prisma from '$lib/prisma';
import { householdStatusLabels } from '$lib/labels';

// Looks for records that are probably the same household or volunteer as one about to be added.
// This only ever warns: the person adding decides whether it really is a different one.

/** Lower case, accents and punctuation gone, single spaces: "123  Main St." and "123 main st" compare equal. */
const plain = (s?: string | null) =>
	(s ?? '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

// Street types and directions, so "Main Street" and "Main St" are the same street
const WORDS: Record<string, string> = {
	street: 'st', avenue: 'ave', road: 'rd', drive: 'dr', boulevard: 'blvd', crescent: 'cres', court: 'ct', lane: 'ln', place: 'pl',
	circle: 'cir', terrace: 'terr', way: 'way', north: 'n', south: 's', east: 'e', west: 'w', apartment: 'apt', suite: 'unit', unit: 'unit'
};
const street = (s?: string | null) =>
	plain(s)
		.split(' ')
		.map((w) => WORDS[w] ?? w)
		.join(' ');
/** "#4", "Apt 4" and "4" are all unit 4. */
const unit = (s?: string | null) => plain(s).replace(/^(apt|unit|suite|no|number)\s+/, '');

export type HouseholdMatch = { id: string; uniqueId: string | null; name: string; address: string; status: string };

/** Households already at this street address (and unit, if there is one). Archived ones are included, so they can be reopened. */
export async function findHouseholdsAtAddress(a: { street?: string | null; unitNumber?: string | null; postalCode?: string | null }): Promise<HouseholdMatch[]> {
	const wanted = street(a.street);
	if (!wanted) return [];
	const wantedUnit = unit(a.unitNumber);
	const wantedPostal = plain(a.postalCode).replace(/ /g, '');

	// the database narrows by the house number, then the careful comparison is done here
	const first = (a.street ?? '').trim().split(/\s+/)[0];
	const candidates = await prisma.household.findMany({
		where: { street: { startsWith: first, mode: 'insensitive' } },
		select: {
			id: true, uniqueId: true, status: true, unitNumber: true, street: true, street2: true, city: true, postalCode: true,
			members: { select: { firstName: true, lastName: true, relationship: true }, orderBy: { createdAt: 'asc' }, take: 4 }
		}
	});

	return candidates
		.filter((h) => {
			if (street(h.street) !== wanted) return false;
			if (unit(h.unitNumber) !== wantedUnit) return false;
			// the same street name can exist in two places: when both have a postal code, they must agree
			const theirs = plain(h.postalCode).replace(/ /g, '');
			return !wantedPostal || !theirs || wantedPostal === theirs;
		})
		.map((h) => {
			const primary = h.members.find((m) => m.relationship === 'PRIMARY') ?? h.members[0];
			return {
				id: h.id,
				uniqueId: h.uniqueId,
				name: primary ? `${primary.firstName} ${primary.lastName}`.trim() : 'No members yet',
				address: [h.unitNumber ? `Unit ${h.unitNumber}` : '', h.street, h.street2, h.city, h.postalCode].filter(Boolean).join(', '),
				status: householdStatusLabels[h.status as keyof typeof householdStatusLabels] ?? h.status
			};
		});
}

export type VolunteerMatch = { id: string; name: string; email: string; status: string };

/** Volunteers with the same first and last name. (The same email is dealt with separately, since it is the login.) */
export async function findVolunteersByName(firstName: string, lastName: string): Promise<VolunteerMatch[]> {
	const f = plain(firstName);
	const l = plain(lastName);
	if (!f || !l) return [];
	const rows = await prisma.volunteer.findMany({
		where: { firstName: { equals: firstName.trim(), mode: 'insensitive' }, lastName: { equals: lastName.trim(), mode: 'insensitive' } },
		select: { id: true, firstName: true, lastName: true, status: true, user: { select: { email: true } } },
		take: 5
	});
	return rows.map((v) => ({
		id: v.id,
		name: `${v.firstName} ${v.lastName}`,
		email: v.user.email,
		status: v.status === 'ARCHIVED' ? 'Archived' : 'Active'
	}));
}
