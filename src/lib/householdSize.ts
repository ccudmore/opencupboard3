import { CHILD_AGE_LIMIT } from "$app/env/public";

/**
 * Adults and children in a household, worked out from its members: a member younger than
 * CHILD_AGE_LIMIT (13 unless configured) is a child, everyone else, including anyone with no
 * birth year, is an adult. `year` is the year to work out ages in: this year, unless looking back
 * at an earlier visit.
 */
export function countPeople(
  members: readonly { birthYear: number | null }[],
  year = new Date().getFullYear(),
) {
  const children = members.filter(
    (m) => m.birthYear != null && year - m.birthYear < CHILD_AGE_LIMIT,
  ).length;
  return { adults: members.length - children, children };
}
