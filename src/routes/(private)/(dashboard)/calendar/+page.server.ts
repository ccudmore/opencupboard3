import type {
	CalendarCategory,
	CalendarEvent,
	CalendarChanges,
	Volunteer,
	CalendarMode,
	EventVolunteer,
	EventGuest,
	Site
} from '$lib/components/Calendar.svelte';
import { eventPlace } from '$lib/eventLocation';
import { zonedParts } from '$lib/timezone';
import { env as privateEnv } from '$env/dynamic/private';
import type { Prisma } from '$prisma/client';
import { requirePermission, hasPermission } from '$lib/utils';
import { rolesFor } from '$lib/volunteerRoles';
import { VolunteerAssignmentsStatus } from '$prisma/enums';
import prisma from '$lib/prisma';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
//import getVoluteers from 


/**
 * Event `start`, `end` and `repeatUntil` are sent to the browser as ISO strings
 * (or 'YYYY-MM-DD' for `repeatUntil`) so they survive serialization and are parsed
 * in the viewer's own time zone.
 */



const APPOINTMENT = 'Appointment';
const SERVICE_DATE = 'Service Date';

async function getCategories(): Promise<CalendarCategory[]> {
	return [
		// Service dates are created and managed on the Service Dates page
		{ name: SERVICE_DATE, color: '#2563eb', roles: rolesFor(SERVICE_DATE), href: '/servicedates', creatable: false, addHint: 'Set up on the Service Dates page, with its volunteers and appointments' },
		{ name: 'Meeting', color: '#7c3aed', roles: rolesFor('Meeting') },
		{ name: 'Shopping', color: '#FFD580', roles: rolesFor('Shopping') },
		{ name: 'Food Drives & Events', color: '#EDC8FF', roles: rolesFor('Food Drives & Events') },
		{ name: 'Lion Hearts', color: '#90EE90', roles: rolesFor('Lion Hearts') },
		{ name: 'Inventory', color: '#16a34a', roles: rolesFor('Inventory') },
		{ name: 'COBS Bread', color: '#ea580c', roles: rolesFor('COBS Bread') },
		// The individual appointment slots of service dates; shown for reference only
		{ name: APPOINTMENT, color: '#0d9488', href: '/servicedates', creatable: false }
	];
}

const categories = await getCategories();
/** Used for volunteers who are assigned to an event without a role. */
const NO_ROLE = '';

async function getVolunteers(): Promise<Volunteer[]> {
	return prisma.volunteer.findMany({
		where: { status: 'ACTIVE' }, // archived volunteers can't be assigned
		select: { id: true, firstName: true, lastName: true },
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
	});
}

async function getSites(): Promise<Site[]> {
	return prisma.site.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

/** Read fresh for every request, so a new volunteer can be assigned straight away. */
async function volunteerIds(): Promise<Set<string>> {
	return new Set((await getVolunteers()).map((v) => v.id));
}

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** The Service Dates page opened on one service date (and its Appointments tab, for an appointment). */
function serviceDateLink(start: Date, appointments: boolean): string {
	const tz = privateEnv.TIMEZONE || 'America/Toronto';
	const date = zonedParts(start, tz).date;
	const today = zonedParts(new Date(), tz).date;
	const q = new URLSearchParams();
	if (date < today) q.set('past', '1'); // earlier service dates are only listed with this
	q.set('focus', date);
	if (appointments) q.set('tab', 'appointments');
	return `/servicedates?${q}`;
}

async function getEvents(canSeeAppointments: boolean): Promise<CalendarEvent[]> {
	const yearAgo = new Date();
	yearAgo.setFullYear(yearAgo.getFullYear() - 1);

	const [results, appointments] = await Promise.all([
		prisma.event.findMany({
			where: { startTime: { gte: yearAgo }, status: 'ACTIVE' },
			include: { volunteers: true, location: true, guests: { orderBy: { createdAt: 'asc' } } }
		}),
		!canSeeAppointments ? Promise.resolve([]) : prisma.appointment.findMany({
			where: { startTime: { gte: yearAgo }, event: { status: 'ACTIVE' } },
			include: {
				event: { include: { location: true } },
				bookings: { where: { status: { in: ['PENDING', 'ACTIVE'] } }, select: { id: true } }
			}
		})
	]);

	const events: CalendarEvent[] = results.map((v) => ({
		id: v.id,
		title: v.title ?? v.type,
		location: eventPlace(v),
		siteId: v.locationId ?? undefined,
		start: v.startTime,
		end: v.endTime,
		category: v.type,
		...(v.type === SERVICE_DATE ? { href: serviceDateLink(v.startTime, false) } : {}),
		repeating: v.repeating,
		...(v.repeating
			? {
					repeatEvery: v.repeatEvery ?? 1,
					repeatUnit: v.repeatUnit === 'day' ? ('day' as const) : ('week' as const)
				}
			: {}),
		repeatUntil: v.repeatUntil ? dateOnly(v.repeatUntil) : undefined,
		exceptions: v.exceptions.length ? v.exceptions : undefined,
		// cancelled assignments aren't shown on the calendar
		volunteers: v.volunteers
			.filter((a) => a.status !== VolunteerAssignmentsStatus.CANCELLED)
			.map((a) => (a.eventRole === NO_ROLE ? { id: a.volunteerId } : { id: a.volunteerId, role: a.eventRole })),
		guests: v.guests.map((g) => ({ name: g.name, email: g.email ?? undefined }))
	}));

	for (const a of appointments) {
		const booked = a.bookings.length > 0;
		events.push({
			id: `appointment:${a.id}`,
			title: booked ? 'Appointment (booked)' : 'Appointment (open)',
			location: eventPlace(a.event),
			start: a.startTime,
			end: a.endTime,
			category: APPOINTMENT,
			href: serviceDateLink(a.event.startTime, true),
			repeating: false,
			readonly: true
		});
	}
	return events;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals?.user?.permissions, url, ['login']);

	let mode = <CalendarMode>'readonly'; // defaults to read-only
	if (canManageEvents(locals?.user?.permissions)) {
		mode = <CalendarMode>'full';
	} else if (hasPermission(locals?.user?.permissions, ['manage-volunteers'])) {
		mode = <CalendarMode>'volunteers';
	}
	// Only people who manage households see the appointments
	const canSeeAppointments = !!hasPermission(locals?.user?.permissions, ['manage-households']);
	const [allCategories, volunteers, events, sites] = await Promise.all([getCategories(), getVolunteers(), getEvents(canSeeAppointments), getSites()]);
	const categories = canSeeAppointments ? allCategories : allCategories.filter((c) => c.name !== APPOINTMENT);
	return { categories, volunteers, events, sites, mode };
};

/** Who may add, change and delete events (the calendar's "full" mode). */
const canManageEvents = (permissions: string[] | null | undefined) =>
	!!hasPermission(permissions, ['manage-households', 'manage-inventory']);

const MANAGE = ['manage-households', 'manage-inventory'];
const MANAGE_OR_VOLUNTEERS = [...MANAGE, 'manage-volunteers'];

export const actions: Actions = {
	/** A new event. */
	add: async ({ request, url, locals }) => {
		requirePermission(locals?.user?.permissions, url, MANAGE);
		const parsed = readChanges(await request.formData(), await volunteerIds());
		if ('error' in parsed) return fail(400, { message: parsed.error });
		const c = parsed.changes;
		if (c.created.length !== 1 || c.updated.length > 0 || c.deleted.length > 0) return fail(400, { message: 'Adding expects exactly one new event.' });
		const message = await createEvents(c.created, locals.user?.id);
		return message ? fail(400, { message }) : { saved: true };
	},

	/**
	 * An edit: one event changed, possibly splitting a repeating series (so may also create one).
	 * People who may manage events save everything; volunteer managers save only the volunteers.
	 */
	update: async ({ request, url, locals }) => {
		requirePermission(locals?.user?.permissions, url, MANAGE_OR_VOLUNTEERS);
		const parsed = readChanges(await request.formData(), await volunteerIds());
		if ('error' in parsed) return fail(400, { message: parsed.error });
		const c = parsed.changes;
		if (c.updated.length < 1 || c.deleted.length > 0) return fail(400, { message: 'Updating expects changed events only.' });

		const full = canManageEvents(locals.user?.permissions);
		const message = full
			? await saveEvents(c, locals.user?.id)
			: await saveVolunteerAssignments(c.updated, locals.user?.id);
		return message ? fail(400, { message }) : { saved: true };
	},

	/** A delete: removed events, and/or a series trimmed (exception or earlier end date). */
	delete: async ({ request, url, locals }) => {
		requirePermission(locals?.user?.permissions, url, MANAGE);
		const parsed = readChanges(await request.formData(), await volunteerIds());
		if ('error' in parsed) return fail(400, { message: parsed.error });
		const c = parsed.changes;
		if (c.created.length > 0 || c.updated.length + c.deleted.length < 1) return fail(400, { message: 'Deleting expects removed or trimmed events only.' });
		const message = await saveEvents(c, locals.user?.id);
		return message ? fail(400, { message }) : { saved: true };
	}
};

/** Fields saved on the event itself (not its people). */
async function eventData(ev: CalendarEvent): Promise<Prisma.EventUncheckedCreateInput | string> {
	let locationId: string | null = null;
	let locationText: string | null = null;
	if (ev.siteId) {
		const site = await prisma.site.findUnique({ where: { id: ev.siteId }, select: { id: true } });
		if (!site) return 'That site does not exist.';
		locationId = site.id;
	} else if (ev.location) {
		locationText = ev.location.slice(0, 200);
	}
	return {
		id: ev.id,
		type: ev.category,
		title: ev.title,
		startTime: new Date(ev.start),
		endTime: new Date(ev.end),
		status: 'ACTIVE',
		locationId,
		locationText,
		repeating: ev.repeating === true,
		repeatEvery: ev.repeating ? (ev.repeatEvery ?? 1) : null,
		repeatUnit: ev.repeating ? (ev.repeatUnit ?? 'week') : null,
		repeatUntil: ev.repeatUntil ? new Date(`${dateOnlyOf(ev.repeatUntil)}T00:00:00Z`) : null,
		exceptions: ev.exceptions ?? []
	};
}

const dateOnlyOf = (v: Date | string) => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10));

/** Makes the guests of an event match the list: unchanged ones keep their email history. */
async function saveGuests(tx: Prisma.TransactionClient, eventId: string, guests: EventGuest[], userId: string | undefined) {
	const keyOf = (name: string, email?: string | null) => `${name.trim().toLowerCase()}|${(email ?? '').trim().toLowerCase()}`;
	const wanted = new Map(guests.map((g) => [keyOf(g.name, g.email), g]));
	const existing = await tx.eventGuest.findMany({ where: { eventId } });
	const have = new Set<string>();
	for (const g of existing) {
		const k = keyOf(g.name, g.email);
		if (wanted.has(k) && !have.has(k)) have.add(k);
		else await tx.eventGuest.delete({ where: { id: g.id } });
	}
	for (const [k, g] of wanted) {
		if (!have.has(k)) await tx.eventGuest.create({ data: { eventId, name: g.name, email: g.email || null, createdBy: userId } });
	}
}

/** Adds new events (category rules apply: service dates are made on their own page). */
async function createEvents(list: CalendarEvent[], userId: string | undefined): Promise<string | null> {
	for (const ev of list) {
		if (ev.category === SERVICE_DATE || ev.category === APPOINTMENT) return 'Service dates and appointments are added on the Service Dates page.';
		const data = await eventData(ev);
		if (typeof data === 'string') return data;
		try {
			await prisma.$transaction(async (tx) => {
				await tx.event.create({ data: { ...data, createdBy: userId } });
				await saveGuests(tx, ev.id!, ev.guests ?? [], userId);
			});
		} catch (err) {
			if ((err as { code?: string })?.code === 'P2002') return 'That event was already saved.';
			console.error(err);
			return 'Could not save the event.';
		}
		if (ev.volunteers) {
			const m = await saveVolunteerAssignments([ev], userId);
			if (m) return m;
		}
	}
	return null;
}

/** Saves a set of changes from the calendar: new, changed and removed events. */
async function saveEvents({ created, updated, deleted }: CalendarChanges, userId: string | undefined): Promise<string | null> {
	const toCreate = [...created];

	for (const ev of updated) {
		if (!ev.id || ev.id.startsWith('appointment:')) continue; // appointments aren't edited here
		const db = await prisma.event.findUnique({ where: { id: ev.id }, select: { id: true, type: true } });
		if (!db) {
			toCreate.push(ev); // a new occurrence split off from a series
			continue;
		}
		if (db.type === SERVICE_DATE) {
			// Service dates are managed on their own page; here only their volunteers change
			const m = await saveVolunteerAssignments([ev], userId);
			if (m) return m;
			continue;
		}
		if (ev.category === SERVICE_DATE || ev.category === APPOINTMENT) return "An event can't be changed into a service date.";
		const data = await eventData(ev);
		if (typeof data === 'string') return data;
		const { id: _id, ...fields } = data;
		await prisma.$transaction(async (tx) => {
			await tx.event.update({ where: { id: db.id }, data: fields });
			if (ev.guests) await saveGuests(tx, db.id, ev.guests, userId);
		});
		if (ev.volunteers) {
			const m = await saveVolunteerAssignments([ev], userId);
			if (m) return m;
		}
	}

	const m = await createEvents(toCreate, userId);
	if (m) return m;

	for (const id of deleted) {
		if (id.startsWith('appointment:')) continue;
		const db = await prisma.event.findUnique({ where: { id }, select: { type: true, _count: { select: { appointments: true } } } });
		if (!db) continue;
		if (db.type === SERVICE_DATE || db._count.appointments > 0) return 'Service dates are cancelled or removed on the Service Dates page.';
		await prisma.$transaction([
			prisma.volunteerAssignments.deleteMany({ where: { eventId: id } }),
			prisma.event.delete({ where: { id } })
		]);
	}
	return null;
}

/** Parses and validates the `changes` form field sent by the calendar. */
function readChanges(form: FormData, volunteerIds: Set<string>): { changes: CalendarChanges } | { error: string } {
	let raw: unknown;
	try {
		raw = JSON.parse(String(form.get('changes') ?? ''));
	} catch {
		return { error: 'Could not read the submitted changes.' };
	}
	if (!isObject(raw)) return { error: 'Could not read the submitted changes.' };
 
	const out: CalendarChanges = { created: [], updated: [], deleted: [] };
	for (const key of ['created', 'updated'] as const) {
		const list = raw[key] ?? [];
		if (!Array.isArray(list)) return { error: `"${key}" must be a list.` };
		for (const item of list) {
			const r = cleanEvent(item, volunteerIds);
			if ('error' in r) return { error: r.error };
			out[key].push(r.event);
		}
	}
	const del = raw.deleted ?? [];
	if (!Array.isArray(del) || !del.every((d) => typeof d === 'string'))
		return { error: '"deleted" must be a list of ids.' };
	out.deleted = del as string[];
	return { changes: out };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const validDate = (v: unknown) => (typeof v === 'string' || v instanceof Date) && !isNaN(+new Date(v));

/** Returns a clean copy of `raw` containing only known fields, or an error message. */
function cleanEvent(raw: unknown, volunteerIds: Set<string>): { event: CalendarEvent } | { error: string } {
	if (!isObject(raw)) return { error: 'Event must be an object.' };
	const { id, title, location, start, end, category, siteId } = raw;
 
	if (typeof id !== 'string' || !id || id.length > 64) return { error: 'Event needs an id.' };
	if (typeof title !== 'string' || !title.trim()) return { error: 'Event needs a title.' };
	if (!validDate(start) || !validDate(end)) return { error: 'Event has an invalid start or end.' };
	if (+new Date(end as string) <= +new Date(start as string))
		return { error: 'Event must end after it starts.' };
	if (typeof category !== 'string') return { error: 'Event needs a category.' };
	const cat = categories.find((c) => c.name === category);
	if (!cat) return { error: `Unknown category "${category}".` };
 
	const event: CalendarEvent = {
		id,
		title: title.trim(),
		start: start as string,
		end: end as string,
		category
	};
	if (typeof location === 'string' && location) event.location = location;
	if (typeof siteId === 'string' && siteId) event.siteId = siteId;
	if (Array.isArray(raw.guests)) {
		event.guests = [];
		for (const g of raw.guests) {
			if (!isObject(g) || typeof g.name !== 'string' || !g.name.trim()) return { error: 'Every guest needs a name.' };
			const email = typeof g.email === 'string' ? g.email.trim() : '';
			if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: `"${email}" isn't a valid email address.` };
			event.guests.push({ name: g.name.trim().slice(0, 100), ...(email ? { email: email.toLowerCase() } : {}) });
		}
	}
 
	if (raw.repeating === true) {
		event.repeating = true;
		const every = Number(raw.repeatEvery ?? 1);
		event.repeatEvery = Number.isFinite(every) && every >= 1 ? Math.floor(every) : 1;
		event.repeatUnit = raw.repeatUnit === 'day' ? 'day' : 'week';
		if (raw.repeatUntil != null && raw.repeatUntil !== '') {
			if (!validDate(raw.repeatUntil)) return { error: 'Invalid repeat end date.' };
			event.repeatUntil = raw.repeatUntil as string;
		}
		if (Array.isArray(raw.exceptions))
			event.exceptions = raw.exceptions.filter((d): d is string => typeof d === 'string');
	} else {
		event.repeating = false;
		// A repeat end date can still exist on a series that was cut short by an earlier edit.
		if (raw.repeatUntil != null && raw.repeatUntil !== '' && validDate(raw.repeatUntil))
			event.repeatUntil = raw.repeatUntil as string;
		if (Array.isArray(raw.exceptions))
			event.exceptions = raw.exceptions.filter((d): d is string => typeof d === 'string');
	}
 
	if (Array.isArray(raw.volunteers)) {
		const list: (string | EventVolunteer)[] = [];
		for (const v of raw.volunteers) {
			const vid = typeof v === 'string' ? v : isObject(v) ? v.id : undefined;
			const role = isObject(v) && typeof v.role === 'string' ? v.role : undefined;
			if (typeof vid !== 'string' || !volunteerIds.has(vid))
				return { error: `Unknown volunteer "${String(vid)}".` };
			if (role && !cat.roles?.includes(role))
				return { error: `"${role}" isn't a role for ${cat.name} events.` };
			list.push(role ? { id: vid, role } : { id: vid });
		}
		event.volunteers = list;
	}
	return { event };
}

/**
 * Makes each event's volunteers match the list sent by the calendar. Assignments that are
 * unchanged are left alone (so their status and history stay), the rest are removed or added.
 * Returns an error message, or null when everything was saved.
 */
async function saveVolunteerAssignments(events: CalendarEvent[], userId: string | undefined): Promise<string | null> {
	for (const ev of events) {
		if (!ev.id || !ev.volunteers) continue; // nothing about volunteers changed

		const dbEvent = await prisma.event.findUnique({ where: { id: ev.id }, select: { id: true, type: true } });
		if (!dbEvent) continue; // not an event from the database

		// The roles allowed come from the saved event's category, not from what the browser says
		const allowedRoles = rolesFor(dbEvent.type);
		const wanted = new Map<string, string>(); // volunteerId -> role
		for (const v of ev.volunteers) {
			const id = typeof v === 'string' ? v : v.id;
			const role = typeof v === 'string' ? NO_ROLE : (v.role ?? NO_ROLE);
			if (role !== NO_ROLE && !allowedRoles.includes(role)) return `"${role}" isn't a role for ${dbEvent.type} events.`;
			wanted.set(id, role);
		}

		await prisma.$transaction(async (tx) => {
			const existing = await tx.volunteerAssignments.findMany({ where: { eventId: dbEvent.id } });

			// Volunteers who are no longer on the list are removed, and role changes are saved on the
			// same assignment (its status and the emails already sent are kept). Cancelled assignments
			// aren't shown on the calendar, so they are left alone unless the volunteer is added again.
			for (const a of existing) {
				if (a.status === VolunteerAssignmentsStatus.CANCELLED) continue;
				const role = wanted.get(a.volunteerId);
				if (role === undefined) await tx.volunteerAssignments.delete({ where: { id: a.id } });
				else if (role !== a.eventRole) await tx.volunteerAssignments.update({ where: { id: a.id }, data: { eventRole: role } });
			}
			for (const [volunteerId, role] of wanted) {
				const old = existing.find((a) => a.volunteerId === volunteerId);
				if (!old) {
					await tx.volunteerAssignments.create({
						data: { volunteerId, eventId: dbEvent.id, eventRole: role, status: VolunteerAssignmentsStatus.ACTIVE, createdBy: userId }
					});
				} else if (old.status === VolunteerAssignmentsStatus.CANCELLED) {
					await tx.volunteerAssignments.update({
						where: { id: old.id },
						data: { eventRole: role, status: VolunteerAssignmentsStatus.ACTIVE }
					});
				}
			}
		});
	}
	return null;
}
