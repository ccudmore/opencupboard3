import type { PageServerLoad } from './$types';
import { searchGuests, parseGuestSearchParams } from '$lib/server/queries/guests';

export const load: PageServerLoad = async ({ url }) => {
  return searchGuests(parseGuestSearchParams(url.searchParams));
};