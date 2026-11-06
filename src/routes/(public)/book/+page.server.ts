import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { book, lookup, register } from '$lib/server/selfBooking';

// A public page: no sign-in. Everything a visitor can do is in $lib/server/selfBooking.ts.
export const load: PageServerLoad = async () => ({
	organization: publicEnv.PUBLIC_ORGANIZATION_NAME || 'Open Cupboard',
	timeZone: privateEnv.TIMEZONE || 'America/Toronto'
});

const clientIp = (e: { getClientAddress: () => string }) => {
	try {
		return e.getClientAddress();
	} catch {
		return 'unknown';
	}
};

export const actions: Actions = {
	/** Their ID: their history, when they can next book, and the appointments open to them. */
	lookup: async (event) => {
		const form = await event.request.formData();
		const r = await lookup(clientIp(event), form.get('uniqueId'));
		return r.ok ? r : fail(r.status, { message: r.message });
	},

	book: async (event) => {
		const form = await event.request.formData();
		const r = await book(clientIp(event), form.get('uniqueId'), form.get('appointmentId'));
		return r.ok ? r : fail(r.status, { message: r.message });
	},

	register: async (event) => {
		const form = await event.request.formData();
		const data: Record<string, unknown> = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
		data.dietaryRestrictions = form.getAll('dietaryRestrictions').filter((v): v is string => typeof v === 'string');
		const r = await register(clientIp(event), data);
		return r.ok ? r : fail(r.status, { message: r.message });
	}
};
