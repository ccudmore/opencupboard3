import { error, json } from '@sveltejs/kit';
import { requireRole } from '$lib/server/auth';
import { searchGuests, parseGuestSearchParams } from '$lib/server/queries/guests';

export async function GET({ url, locals }) {
	// craig requires permission checks
	let destinationArray = [];
	const urlbase = new URL(url);
	try {
		const guestResults = await searchGuests(parseGuestSearchParams(url.searchParams) );

		const transformedGuests = guestResults.guests.map(guest => {
  			return {
				id: guest.id,
    			URL: `${urlbase.origin}/households/${guest.householdMembershipId}`, 
    			desc1: guest.fullName,
    			desc2: guest.memberOf.street,
    			desc3: guest.phone,
				category: 'Client'
  			};
		});
		destinationArray.push(...transformedGuests);

		return json({ results: destinationArray });
	} catch (e) {
		console.error('Search query failed', e);
		error(500, 'Search failed');
	}
};