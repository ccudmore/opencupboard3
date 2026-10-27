// The roles a volunteer can be given on an event, by the event's type (its category on the calendar).
// To add roles, or roles for another type of event, add them here: the Calendar, the volunteer's
// page and the checks on the server all read this list. Types that aren't listed have no roles.

export const EVENT_ROLES: Record<string, string[]> = {
	'Service Date': ['Supervisor', 'Shopper', 'Service Assistant'],
	Meeting: ['Chair', 'Secretary', 'Member', 'Guest'],
	Shopping: ['Shopper'],
	'Food Drives & Events': ['Supervisor', 'Assistant', 'Setup'],
	'Lion Hearts': ['Driver', 'Sorter'],
	Inventory: ['Supervisor', 'Sorter']
};

export function rolesFor(eventType: string): string[] {
	return Object.hasOwn(EVENT_ROLES, eventType) ? EVENT_ROLES[eventType] : [];
}

/** Every role there is, once each. A volunteer's skills are chosen from this list. */
export const ALL_ROLES: string[] = [...new Set(Object.values(EVENT_ROLES).flat())].sort();
