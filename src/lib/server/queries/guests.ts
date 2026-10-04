import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';

export const GUEST_PAGE_SIZE = 10;

export type SearchGuestsOptions = {
  q?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export async function searchGuests({
  q = '',
  activeOnly = false,
  page = 1,
  pageSize = GUEST_PAGE_SIZE
}: SearchGuestsOptions = {}) {
  const term = q.trim();
  const safePage = Math.max(1, page);

  const searchFilter: Prisma.GuestWhereInput = term
    ? {
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
          { memberOf: { street: { contains: term, mode: 'insensitive' } } },
          { memberOf: { city: { contains: term, mode: 'insensitive' } } },
          { memberOf: { postalCode: { contains: term, mode: 'insensitive' } } },
          { email: { contains: term, mode: 'insensitive' } },
          { fullName: { contains: term, mode: 'insensitive' } }
        ]
      }
    : {};

  const statusFilter: Prisma.GuestWhereInput = activeOnly
    ? { memberOf: { status: 'Active' } }
    : {};

  const primaryUserFilter: Prisma.GuestWhereInput = { relationship: 'Primary' };

  const where: Prisma.GuestWhereInput = {
    AND: [searchFilter, statusFilter, primaryUserFilter]
  };

  const [guests, total] = await Promise.all([
    prisma.guest.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: { memberOf: true }
    }),
    prisma.guest.count({ where })
  ]);

  return { guests, total, page: safePage, pageSize, q: term };
}

/** Turns URLSearchParams into SearchGuestsOptions so both callers parse identically. */
export function parseGuestSearchParams(params: URLSearchParams): SearchGuestsOptions {
  return {
    q: params.get('q')?.trim() ?? '',
    activeOnly: params.get('s') === 'active',
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: params.get('pageSize') ? Math.max(1, Number(params.get('pageSize'))) : GUEST_PAGE_SIZE
  };
}