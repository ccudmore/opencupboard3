import { error, json } from '@sveltejs/kit';
import { requireRole } from '$lib/server/auth';
import { searchHousehold, parseHouseholdSearchParams } from '$lib/server/queries/household';
import { searchEvent, parseEventSearchParams } from '$lib/server/queries/event';
import { searchVolunteer, parseVolunteerSearchParams } from '$lib/server/queries/volunteer';

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

		const eventResults = await searchEvent(parseEventSearchParams(url.searchParams) );
		const transformedEvents = eventResults.events.map(event => {
  			return {
				id: event.id,
    			URL: `${urlbase.origin}/event/${event.id}`, 
				desc1: event.title,
  				desc2: event.startTime.toLocaleString("en-CA"),
				desc3: event.location.name,
				category: 'Event'
  			};
		});
		const volunteerResults = await searchVolunteer(parseVolunteerSearchParams(url.searchParams) );
		const transformedVolunteers = volunteerResults.volunteers.map(volunteer => {
  			return {
				id: volunteer.id,
    			URL: `${urlbase.origin}/event/${volunteer.id}`, 
				desc1: `${volunteer.firstName} ${volunteer.lastName}`,
  				desc2: volunteer.phone1,
				desc3: volunteer.email1,
				category: 'Volunteer'
  			};
		});


		destinationArray.push(...transformedHouseholds);
		destinationArray.push(...transformedEvents);
		destinationArray.push(...transformedVolunteers);

		return json({ results: destinationArray });
	} catch (e) {
		console.error('Search query failed', e);
		error(500, 'Search failed');
	}
};