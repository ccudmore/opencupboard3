import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';
import { HouseholdStatus, ClientRelationship } from '$prisma/browser';

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
  const compactTerm = term.replace(/\s+/g, '');

  const guestWhere: Prisma.ClientWhereInput = {
    relationship: ClientRelationship.PRIMARY,
    ...(!showNonActive && { memberOf: { status: HouseholdStatus.ACTIVE } }),
//    ...(!showNonActive && { memberOf: { status: 'Active' } }),
    ...(term && {
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { memberOf: { street: { contains: term, mode: 'insensitive' } } },
        { memberOf: { city: { contains: term, mode: 'insensitive' } } },
        { memberOf: { postalCode: { contains: compactTerm, mode: 'insensitive' } } }
      ]
    })
  };

  // Step 1: ids of all matching households (one row per household)
  const matches = await prisma.client.groupBy({
    by: ['householdMembershipId'],
    where: guestWhere
  });
  const ids = matches.map((m) => m.householdMembershipId);

  // Step 2: full households with their Primary members, sorted last then first
  const households = await prisma.household.findMany({
    where: { id: { in: ids } },
    include: {
      members: {
        where: { relationship: ClientRelationship.PRIMARY },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      }
    }
  });

  // Step 3: sort households by their first Primary member, then page
  const cmp = (a?: string, b?: string) =>
    (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' });

  households.sort((a, b) => {
    const ma = a.members[0];
    const mb = b.members[0];
    return (
      cmp(ma?.lastName, mb?.lastName) ||
      cmp(ma?.firstName, mb?.firstName) ||
      a.id.localeCompare(b.id) // stable tie-breaker for paging
    );
  });

  const total = households.length;
  const start = (page - 1) * pageSize;
  
  return { households: households.slice(start, start + pageSize), total, page, pageSize, q: term };
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