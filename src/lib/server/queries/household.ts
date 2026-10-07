import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';

export const GUEST_PAGE_SIZE = 10;

export type SearchHouseholdOptions = {
  q?: string;
  activeOnly?: boolean;
  showNonActive?: boolean;
  page?: number;
  pageSize?: number;
};

export async function searchHousehold({
  q = '',
  showNonActive = false,
  page = 1,
  pageSize = GUEST_PAGE_SIZE
}: SearchHouseholdOptions = {}) {
  const term = q.trim();

 // The same guest must be Primary AND match the search
  const guestWhere: Prisma.GuestWhereInput = {
    relationship: 'Primary',
    ...(!showNonActive && { memberOf: { status: 'Active' } }),
    ...(term && {
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { memberOf: { street: { contains: term, mode: 'insensitive' } } },
        { memberOf: { city: { contains: term, mode: 'insensitive' } } },
        { memberOf: { postalCode: { contains: term, mode: 'insensitive' } } },
        { memberOf: { postalCode: { contains: term, mode: 'insensitive' } } }
      ]
    })
  };

  const orderBy = [
    { _min: { fullName: 'asc' } },
    { householdMembershipId: 'asc' } // tie-breaker so paging is stable
  ] satisfies Prisma.GuestGroupByArgs['orderBy'];

  // Retrieve all households that have at least one member that meets the search criteria

  // Step 1: one row per household, sorted and paged in the database
  const [pageRows, allRows] = await Promise.all([
    prisma.guest.groupBy({
      by: ['householdMembershipId'],
      where: guestWhere,
      _min: { fullName: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.guest.groupBy({
      by: ['householdMembershipId'],
      where: guestWhere
    })
  ]);

  const ids = pageRows.map((r) => r.householdMembershipId);

  // Step 2: full household records with ALL Primary guests (not just the ones that matched)
  const households = await prisma.household.findMany({
    where: { id: { in: ids } },
    include: {
      members: {
        where: { relationship: 'Primary' },
        orderBy: [{ lastName: 'asc'}, {firstName: 'asc' }]
      }
    }
  });

  // findMany doesn't preserve the `in` order, so restore the sorted order
  const byId = new Map(households.map((h) => [h.id, h]));
  const ordered = ids.map((id) => byId.get(id)).filter((h) => h !== undefined);

  return { households: ordered, total: allRows.length, page, pageSize, q: term };
}

/** Turns URLSearchParams into SearchGuestsOptions so both callers parse identically. */
export function parseHouseholdSearchParams(params: URLSearchParams): SearchHouseholdOptions {
  return {
    q: params.get('q')?.trim() ?? '',
    showNonActive: params.has('shownonactive'),
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: params.get('pageSize') ? Math.max(1, Number(params.get('pageSize'))) : GUEST_PAGE_SIZE
  };
}