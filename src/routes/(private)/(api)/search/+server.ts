import { error, json } from '@sveltejs/kit';
import { requireRole } from '$lib/server/auth';
import { searchGuests, parseGuestSearchParams } from '$lib/server/queries/guests';

const LIMIT = 25;

export async function GET({ url, locals }) {

	// craig requeires some cleanup and possibly permission checks
	try {
		const results2 = await searchGuests({ ...parseGuestSearchParams(url.searchParams), activeOnly: true });
		type Result = { id: number; name: string; category: string };

		const results3 = results2.guests.map((g: { id: any; fullName: any; }) => ({ id: g.id, name: g.fullName, category: 'guest' })) ;
		return json({ results: results3 });
	} catch (e) {
		console.error('Search query failed', e);
		error(500, 'Search failed');
	}
};