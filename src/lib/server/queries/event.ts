import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';

export const EVENT_PAGE_SIZE = 100;

export type SearchEventOptions = {
  q?: string;
  activeOnly?: boolean;
  showNonActive?: boolean;
  page?: number;
  pageSize?: number;
};

export async function searchEvent({
  q = '',
  showNonActive = false,
  page = 1,
  pageSize = EVENT_PAGE_SIZE
}: SearchEventOptions = {}) {
  const term = q.trim();

  // add date time search, craig
  const eventWhere: Prisma.EventWhereInput = {
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
      ]
  }

  // craig - add paging
  const events = await prisma.event.findMany({
    where: eventWhere,
    include: {location: true}
  });
  
  const total = events.length;
  const start = (page - 1) * pageSize;
  
  return { events, total, page, pageSize, q: term };
}

/** Turns URLSearchParams into SearchGuestsOptions so both callers parse identically. */
export function parseEventSearchParams(params: URLSearchParams): SearchEventOptions {
  return {
    q: params.get('q')?.trim() ?? '',
    showNonActive: params.has('shownonactive'),
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: params.get('pageSize') ? Math.max(1, Number(params.get('pageSize'))) : EVENT_PAGE_SIZE
  };
}