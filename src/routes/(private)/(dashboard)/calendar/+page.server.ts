import type {
	CalendarCategory,
	CalendarEvent,
	CalendarChanges,
	Volunteer,
	CalendarMode,
	EventVolunteer,
} from '$lib/components/Calendar.svelte';
import { requirePermission } from '$lib/server/auth';
import prisma from '$lib/prisma';
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
		{ name: 'Service Date', color: '#2563eb', roles: ['Supervisor', 'Assistant', 'Setup'] },
		{ name: 'Meeting', color: '#7c3aed', roles: ['Chair', 'Secretary', 'Member', 'Guest'] },
		{ name: 'Shopping', color: '#FFD580', roles: ['Shopper', ] },
		{ name: 'Food Drives & Events', color: '#EDC8FF', roles: ['Supervisor', 'Assistant', 'Setup'] },
		{ name: 'Lion Hearts', color: '#90EE90', roles: ['Driver', 'Sorter',] },
		{ name: 'Inventory', color: '#16a34a', roles: ['Supervisor', 'Sorter',] },
		{ name: 'COBS', color: '#ea580c' } // no roles
	];
}

const categories = await getCategories()
const volunteers = await getVolunteers();

async function getVolunteers(): Promise<Volunteer[]> {
	/*
	const results = await prisma.volunteer.findMany({
		select: {
    		id: true,
    		firstName: true,
    		lastName: true,
  		},
	});
	const volunteers: Volunteer[] = results.map(v => ({
    	firstName: v.firstName,
		lastName: v.lastName,
    	id: v.id
	}));
	return volunteers
	*/
	return []
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
		// volunteers: 
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
    const user = requirePermission(locals, url, ['login']);

	let mode = <CalendarMode>('readonly'); // defaults to read-only

	if (user.roles.includes('Client Manager')
		|| user.roles.includes('Administrator') 
		|| user.roles.includes('Inventory Manager')) {
		mode = <CalendarMode>('full')
	} else if (user.roles.includes('Volunteer Manager')) {
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
	console.log('CRAIG')
	// for future reference, the rest of the generated code is found in my ~/Downloads folder
}

export const actions: Actions = {
	/** A new event. */
	add: ({ request }) =>
		handle(request, (c) =>
			c.created.length === 1 && c.updated.length === 0 && c.deleted.length === 0
				? null
				: 'Adding expects exactly one new event.'
		),
 
	/** An edit: one event changed, possibly splitting a repeating series (so may also create one). */
	update: ({ request }) =>
		handle(request, (c) =>
			c.updated.length >= 1 && c.deleted.length === 0 ? null : 'Updating expects changed events only.'
		),
 
	/** A delete: removed events, and/or a series trimmed (exception or earlier end date). */
	delete: ({ request }) =>
		handle(request, (c) =>
			c.created.length === 0 && c.updated.length + c.deleted.length >= 1
				? null
				: 'Deleting expects removed or trimmed events only.'
		)
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
	console.log('CRAIG2 - handle')
		const parsed = readChanges(await request.formData());

	console.log(request)
	console.log(rule) 
}

/** Parses and validates the `changes` form field sent by the calendar. */
function readChanges(form: FormData): { changes: CalendarChanges } | { error: string } {
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
			const r = cleanEvent(item);
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
function cleanEvent(raw: unknown): { event: CalendarEvent } | { error: string } {
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
			if (typeof vid !== 'string' || !volunteers.some((x) => x.id === vid))
				return { error: `Unknown volunteer "${String(vid)}".` };
			if (role && !cat.roles?.includes(role))
				return { error: `"${role}" isn't a role for ${cat.name} events.` };
			list.push(role ? { id: vid, role } : { id: vid });
		}
		event.volunteers = list;
	}
	return { event };
}