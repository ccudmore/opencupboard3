import type { Prisma } from '$prisma/client';
import prisma from '$lib/prisma';

export const VOLUNTEER_PAGE_SIZE = 25;

export type SearchVolunteerOptions = {
  q?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Volunteers whose name, email, phone or city contain every word of the search text,
 * sorted by last then first name, one page at a time.
 */
export async function searchVolunteer({
  q = '',
  page = 1,
  pageSize = VOLUNTEER_PAGE_SIZE
}: SearchVolunteerOptions = {}) {
  const term = q.trim();
  const words = term.split(/\s+/).filter(Boolean);

  const where: Prisma.VolunteerWhereInput = {
    AND: words.map((word) => ({
      OR: [
        { firstName: { contains: word, mode: 'insensitive' } },
        { lastName: { contains: word, mode: 'insensitive' } },
        { email1: { contains: word, mode: 'insensitive' } },
        { email2: { contains: word, mode: 'insensitive' } },
        { phone1: { contains: word, mode: 'insensitive' } },
        { phone2: { contains: word, mode: 'insensitive' } },
        { city: { contains: word, mode: 'insensitive' } }
      ]
    }))
  };

  const [total, volunteers] = await Promise.all([
    prisma.volunteer.count({ where }),
    prisma.volunteer.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return { volunteers, total, page, pageSize, q: term };
}

/** Turns URLSearchParams into SearchVolunteerOptions so every caller parses them the same way. */
export function parseVolunteerSearchParams(params: URLSearchParams): SearchVolunteerOptions {
  return {
    q: params.get('q')?.trim() ?? '',
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: params.get('pageSize') ? Math.min(200, Math.max(1, Number(params.get('pageSize')))) : VOLUNTEER_PAGE_SIZE
  };
}
