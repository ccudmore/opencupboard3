import { error, json } from '@sveltejs/kit';
import { requireRole } from '$lib/server/auth';
import { searchGuests, parseGuestSearchParams } from '$lib/server/queries/guests';

//const MIN_LENGTH = 2;
//const MAX_LENGTH = 100;
const LIMIT = 25;

export async function GET({ url, locals }) {
//	const q = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_LENGTH);

	try {
		const results2 = await searchGuests(parseGuestSearchParams(url.searchParams));

		type Result = { id: number; name: string; category: string };

		const results3 = results2.guests.map((g: { id: any; fullName: any; }) => ({ id: g.id, name: g.fullName, category: 'guest' })) ;
		return json({ results: results3 });
	} catch (e) {
		console.error('Search query failed', e);
		error(500, 'Search failed');
	}
};