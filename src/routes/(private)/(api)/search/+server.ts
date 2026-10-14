import { error, json } from '@sveltejs/kit';
import { requireRole } from '$lib/server/auth';
import { searchClients, parseClientSearchParams } from '$lib/server/queries/clients';
import { searchHousehold, parseHouseholdSearchParams } from '$lib/server/queries/household';

export async function GET({ url, locals }) {
	// craig requires permission checks
	let destinationArray = [];
	const urlbase = new URL(url);
	try {
//		const clientResults = await searchClients(parseClientSearchParams(url.searchParams) );
		const householdResults = await searchHousehold(parseHouseholdSearchParams(url.searchParams) );

		const transformedHouseholds = householdResults.households.map(household => {
  			return {
				id: household.id,
    			URL: `${urlbase.origin}/households/${household.id}`, 
				desc1:   household.members.map(m => `${m.firstName} ${m.lastName}`).join(', '),
  				desc2: household.street,
				desc3:   household.members.map(m => `${m.phone}`).join(', '),
				category: 'Household'
  			};
		});

		/*
		const transformedClients = clientResults.clients.map(client => {
  			return {
				id: client.id,
    			URL: `${urlbase.origin}/households/${client.householdMembershipId}`, 
    			desc1: `${client.firstName} ${client.firstName}`,
    			desc2: client.memberOf.street,
    			desc3: client.phone,
				category: 'Guest' // craig - need to make this configurable in env file
  			};
		});
		*/
//		destinationArray.push(...transformedClients);
		destinationArray.push(...transformedHouseholds);

		return json({ results: destinationArray });
	} catch (e) {
		console.error('Search query failed', e);
		error(500, 'Search failed');
	}
};