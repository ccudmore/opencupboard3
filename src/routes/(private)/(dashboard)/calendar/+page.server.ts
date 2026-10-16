import type {
	CalendarCategory,
	CalendarEvent,
	Volunteer,
	CalendarMode
} from '$lib/components/Calendar.svelte';
import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import prisma from '$lib/prisma';

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

async function getVolunteers(): Promise<Volunteer[]> {
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
	const user = requireRole(locals, url, ['Client Manager', 'Administrator','User', 'Volunteer Manager', 'Volunteer', 'Inventory Manager']);

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