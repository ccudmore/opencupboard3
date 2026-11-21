import { eventPlace } from "#lib/eventLocation.ts";
import {
  SERVICE_DATE,
  serviceDateLink,
  calendarEventLink,
} from "#lib/server/eventLinks.ts";
import { streetWithUnit } from "#lib/address.ts";
import { error } from "@sveltejs/kit";
import { requirePermission } from "#lib/utils.ts";
import {
  searchHousehold,
  parseHouseholdSearchParams,
} from "#lib/server/queries/household.ts";
import { searchEvent, parseEventSearchParams } from "#lib/server/queries/event.ts";
import {
  searchVolunteer,
  parseVolunteerSearchParams,
} from "#lib/server/queries/volunteer.ts";

export async function GET({ url, locals }) {
  requirePermission(locals.user?.permissions, url, ["manage-households"]);

  let destinationArray = [];
  const urlbase = new URL(url);
  try {
    //		const clientResults = await searchClients(parseClientSearchParams(url.searchParams) );
    const householdResults = await searchHousehold(
      parseHouseholdSearchParams(url.searchParams),
    );

    const transformedHouseholds = householdResults.households.map(
      (household) => {
        return {
          id: household.id,
          URL: `${urlbase.origin}/households/${household.id}`,
          desc1: household.members
            .map((m) => `${m.firstName} ${m.lastName}`)
            .join(", "),
          desc2: streetWithUnit(household.street, household.unitNumber),
          desc3: household.members.map((m) => `${m.phone}`).join(", "),
          category: "Household",
        };
      },
    );

    const eventResults = await searchEvent(
      parseEventSearchParams(url.searchParams),
    );
    const transformedEvents = eventResults.events.map((event) => {
      // service dates have their own page; any other event opens on the calendar
      const isServiceDate = event.type === SERVICE_DATE;
      return {
        id: event.id,
        URL: `${urlbase.origin}${
          isServiceDate
            ? serviceDateLink(event.startTime, false, event.id)
            : calendarEventLink(event.id, event.startTime)
        }`,
        desc1: event.title || (isServiceDate ? SERVICE_DATE : event.type),
        desc2: event.startTime.toLocaleString("en-CA"),
        desc3: eventPlace(event),
        category: isServiceDate ? "Service Date" : "Event",
      };
    });

    const volunteerResults = await searchVolunteer(
      parseVolunteerSearchParams(url.searchParams),
    );
    const transformedVolunteers = volunteerResults.volunteers.map(
      (volunteer) => {
        return {
          id: volunteer.id,
          URL: `${urlbase.origin}/volunteers/${volunteer.id}`,
          desc1: `${volunteer.firstName} ${volunteer.lastName}`,
          desc2: volunteer.phone1,
          desc3: volunteer.user.email,
          category: "Volunteer",
        };
      },
    );

    destinationArray.push(...transformedHouseholds);
    destinationArray.push(...transformedEvents);
    destinationArray.push(...transformedVolunteers);

    return Response.json({ results: destinationArray });
  } catch (e) {
    console.error("Search query failed", e);
    error(500, "Search failed");
  }
}
