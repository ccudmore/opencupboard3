import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';

export const VOLUNTEER_PAGE_SIZE = 100;

export type SearchVolunteerOptions = {
  q?: string;
  activeOnly?: boolean;
  showNonActive?: boolean;
  page?: number;
  pageSize?: number;
};

export async function searchVolunteer({
  q = '',
  showNonActive = false,
  page = 1,
  pageSize = VOLUNTEER_PAGE_SIZE
}: SearchVolunteerOptions = {}) {
  const term = q.trim();

  // craig - add status of active, date search, location search, paging
  const volunteerWhere: Prisma.VolunteerWhereInput = {
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
      ]
  }

  // Step 1: ids of all matching households (one row per household)
  const volunteers = await prisma.volunteer.findMany({
    where: volunteerWhere,
//    include: {location: true}
  });
  
  const total = volunteers.length;
  const start = (page - 1) * pageSize;
  
  return { volunteers, total, page, pageSize, q: term };
}

/** Turns URLSearchParams into SearchGuestsOptions so both callers parse identically. */
export function parseVolunteerSearchParams(params: URLSearchParams): SearchVolunteerOptions {
  return {
    q: params.get('q')?.trim() ?? '',
    showNonActive: params.has('shownonactive'),
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: params.get('pageSize') ? Math.max(1, Number(params.get('pageSize'))) : VOLUNTEER_PAGE_SIZE
  };
}