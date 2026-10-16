import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';

/*
This is no longer used but is being kept around just in case.
It's been replaced by household.ts
*/

export const CLIENT_PAGE_SIZE = 10;

export type SearchClientsOptions = {
  q?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export async function searchClients({
  q = '',
  activeOnly = false,
  page = 1,
  pageSize = CLIENT_PAGE_SIZE
}: SearchClientsOptions = {}) {
  const term = q.trim();
  const safePage = Math.max(1, page);

  const searchFilter: Prisma.ClientWhereInput = term
    ? {
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
          { memberOf: { street: { contains: term, mode: 'insensitive' } } },
          { memberOf: { city: { contains: term, mode: 'insensitive' } } },
          { memberOf: { postalCode: { contains: term, mode: 'insensitive' } } },
          { email: { contains: term, mode: 'insensitive' } },
        ]
      }
    : {};

  const statusFilter: Prisma.ClientWhereInput = activeOnly
    ? { memberOf: { status: 'Active' } }
    : {};

  const primaryUserFilter: Prisma.ClientWhereInput = { relationship: 'Primary' };

  const where: Prisma.ClientWhereInput = {
    AND: [searchFilter, statusFilter, primaryUserFilter]
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: { memberOf: true }
    }),
    prisma.client.count({ where })
  ]);

  return { clients, total, page: safePage, pageSize, q: term };
}

/** Turns URLSearchParams into SearchClientOptions so both callers parse identically. */
export function parseClientSearchParams(params: URLSearchParams): SearchClientsOptions {
  return {
    q: params.get('q')?.trim() ?? '',
    activeOnly: params.get('s') === 'active',
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: params.get('pageSize') ? Math.max(1, Number(params.get('pageSize'))) : CLIENT_PAGE_SIZE
  };
}