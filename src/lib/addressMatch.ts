// Helpers for spotting the same address typed two different ways ("123 Example St." and "123 example street").

const WORDS: Record<string, string> = {
  street: "st", avenue: "ave", av: "ave", road: "rd", drive: "dr", boulevard: "blvd",
  court: "ct", crescent: "cres", lane: "ln", place: "pl", terrace: "terr", circle: "cir",
  highway: "hwy", parkway: "pkwy", square: "sq", trail: "trl",
  north: "n", south: "s", east: "e", west: "w",
};

/** Lower case, no punctuation or unit numbers, one spelling for street types and directions. */
export function normalizeStreet(street: string | null | undefined): string {
  return (street ?? "")
    .toLowerCase()
    .replace(/\b(unit|apt|apartment|suite|ste)\.?\s*#?\s*\w+/g, " ") // "Apt 4"
    .replace(/#\s*\w+/g, " ") // "#4"
    .replace(/[.,'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w)
    .join(" ");
}

export const normalizePostal = (v: string | null | undefined) =>
  (v ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const normalizeCity = (v: string | null | undefined) =>
  (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type Place = { street?: string | null; city?: string | null; postalCode?: string | null };

/** Same street address, in the same postal code (or, when one has no postal code, the same city). */
export function sameAddress(a: Place, b: Place): boolean {
  const sa = normalizeStreet(a.street);
  if (!sa || sa !== normalizeStreet(b.street)) return false;
  const pa = normalizePostal(a.postalCode);
  const pb = normalizePostal(b.postalCode);
  if (pa && pb) return pa === pb;
  const ca = normalizeCity(a.city);
  return !!ca && ca === normalizeCity(b.city);
}

/** The first word of the street, normally the house number: used to narrow the database search. */
export const houseNumber = (street: string | null | undefined) =>
  normalizeStreet(street).split(" ")[0] ?? "";
