import type {
	CalendarCategory,
	CalendarEvent,
	CalendarChanges,
	Volunteer,
	CalendarMode,
	EventVolunteer,
} from '$lib/components/Calendar.svelte';
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



// craig - update colors - maybe load this from a file or calendar.svelte

async function getCategories(): Promise<CalendarCategory[]> {
	return [
		{ name: 'Service Date', color: '#2563eb', roles: rolesFor('Service Date') },
		{ name: 'Meeting', color: '#7c3aed', roles: rolesFor('Meeting') },
		{ name: 'Shopping', color: '#FFD580', roles: rolesFor('Shopping') },
		{ name: 'Food Drives & Events', color: '#EDC8FF', roles: rolesFor('Food Drives & Events') },
		{ name: 'Lion Hearts', color: '#90EE90', roles: rolesFor('Lion Hearts') },
		{ name: 'Inventory', color: '#16a34a', roles: rolesFor('Inventory') },
		{ name: 'COBS', color: '#ea580c' } // no roles
	];
}

const categories = await getCategories()
/** Used for volunteers who are assigned to an event without a role. */
const NO_ROLE = '';

async function getVolunteers(): Promise<Volunteer[]> {
	return prisma.volunteer.findMany({
		select: { id: true, firstName: true, lastName: true },
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
	});
}

/** Read fresh for every request, so a new volunteer can be assigned straight away. */
async function volunteerIds(): Promise<Set<string>> {
	return new Set((await getVolunteers()).map((v) => v.id));
}

async function getEvents(): Promise<CalendarEvent[]> {
	// Helpers for the sample data: a time relative to today.
	const at = (dayOffset: number, h: number, m = 0) => {
		const d = new Date();
		return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset, h, m).toISOString();
	};
	const day = (dayOffset: number) => at(dayOffset, 0).slice(0, 10);

// craig - only find them 1 year back
	const results = await prisma.event.findMany({
//		where: less than a year ago,
		include: {volunteers: true, location: true, appointments: true}
	})

	const events: CalendarEvent[] = results.map(v => ({
    	id: v.id,
		title: v.title??'untitled',
		location: v.location.name,
		start: v.startTime,
		end: v.endTime,
    	category: v.type,
		repeating: false,
		// cancelled assignments aren't shown on the calendar
		volunteers: v.volunteers
			.filter((a) => a.status !== VolunteerAssignmentsStatus.CANCELLED)
			.map((a) => (a.eventRole === NO_ROLE ? { id: a.volunteerId } : { id: a.volunteerId, role: a.eventRole }))
	}));

/*
sample data:
{
			id: '1',
			title: 'Pottery workshop',
			location: 'Studio B',
			start: at(1, 10),
			end: at(1, 12),
			category: 'Workshop',
			repeating: true,
			repeatEvery: 1,
			repeatUnit: 'week',
			repeatUntil: day(60), // optional end date; omit to repeat forever
			slots: 6,
			volunteers: [{ id: 'v1', role: 'Instructor' }, 'v3'] // 'v3' = no role
		},
		{
			id: '5',
			title: 'Morning check-in',
			start: at(0, 9),
			end: at(0, 9, 30),
			category: 'Meeting',
			repeating: true,
			repeatEvery: 2,
			repeatUnit: 'day'
		},
		{
			id: '2',
			title: 'Planning meeting',
			location: 'Room 2',
			start: at(0, 14),
			end: at(0, 15, 30),
			category: 'Meeting',
			repeating: false
		},
		{
			id: '3',
			title: 'Potluck',
			location: 'Main hall',
			start: at(3, 18),
			end: at(3, 20),
			category: 'Social',
			repeating: false,
			slots: 20
		},
		{
			// Category isn't defined above, so the calendar won't display this one.
			id: 'x',
			title: 'Hidden (unknown category)',
			start: at(0, 11),
			end: at(0, 12),
			category: 'Not defined'
		},
		{
			id: '4',
			title: 'Furnace check',
			start: at(1, 11),
			end: at(1, 12, 30),
			category: 'Maintenance',
			repeating: false
		}
	];
	*/
	return events
}

export const load: PageServerLoad = async ({params, locals, url }) => {
    requirePermission(locals?.user?.permissions, url, ['login']);

	let mode = <CalendarMode>('readonly'); // defaults to read-only
	if (hasPermission(locals?.user?.permissions, ['manage-households', 'manage-inventory'])) {
		mode = <CalendarMode>('full')
	} else if (hasPermission(locals?.user?.permissions, ['manage-volunteers'])) {
		mode = <CalendarMode>('volunteers')
	}
	const [categories, volunteers, events] = await Promise.all([
		getCategories(),
		getVolunteers(),
		getEvents()
	]);
	return { categories, volunteers, events, mode };
};

async function saveChanges({ created, updated, deleted }: CalendarChanges) {
	// for future reference, the rest of the generated code is found in my ~/Downloads folder
}

export const actions: Actions = {
	/** A new event. */
	add: ({ request, url, locals }) =>
	{
	    requirePermission(locals?.user?.permissions, url, ['login']);
		return handle(request, (c) =>
			c.created.length === 1 && c.updated.length === 0 && c.deleted.length === 0
				? null
				: 'Adding expects exactly one new event.'
		);
	},
 
	/**
	 * An edit: one event changed, possibly splitting a repeating series (so may also create one).
	 * For now only the volunteers (and their roles) are saved; other event changes are not stored yet.
	 */
	update: async ({ request, url, locals }) => {
		requirePermission(locals?.user?.permissions, url, ['manage-households', 'manage-inventory', 'manage-volunteers']);

		const parsed = readChanges(await request.formData(), await volunteerIds());
		if ('error' in parsed) return fail(400, { message: parsed.error });
		if (parsed.changes.updated.length < 1 || parsed.changes.deleted.length > 0) {
			return fail(400, { message: 'Updating expects changed events only.' });
		}

		const result = await saveVolunteerAssignments(parsed.changes.updated, locals.user?.id);
		if (result) return fail(400, { message: result });
		return { saved: true };
	},
 
	/** A delete: removed events, and/or a series trimmed (exception or earlier end date). */
	delete: ({ request, url, locals }) =>
	{
	    requirePermission(locals?.user?.permissions, url, ['login']);
		handle(request, (c) =>
			c.created.length === 0 && c.updated.length + c.deleted.length >= 1
				? null
				: 'Deleting expects removed or trimmed events only.'
		);
	},
};

/**
 * The calendar posts every add, edit and delete here as `changes`:
 *   { created: Event[], updated: Event[], deleted: string[] }
 * Editing or deleting one occurrence of a repeating event can touch more than one event
 * (the series gets an exception and/or a new event is created), hence the lists.
 *
 * Add your own checks (is the user signed in, may they change events or only volunteers, …)
 * at the top of each action, e.g. `if (!locals.user) return fail(401, …)`.
 */
async function handle(
	request: Request,
	rule: (c: CalendarChanges) => string | null // action-specific shape check
) {
//	console.log('CRAIG2 - handle')
		const parsed = readChanges(await request.formData(), await volunteerIds());

//	console.log(request)
//	console.log(rule) 
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
	const { id, title, location, start, end, category } = raw;
 
	if (typeof id !== 'string' || !id) return { error: 'Event needs an id.' };
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
