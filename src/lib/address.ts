/** Puts the unit number in front of the street: "Unit 4, 123 Main St". Either part may be missing. */
export function streetWithUnit(
  street?: string | null,
  unitNumber?: string | null,
): string {
  const s = (street ?? "").trim();
  const u = (unitNumber ?? "").trim();
  if (!u) return s;
  return s ? `Unit ${u}, ${s}` : `Unit ${u}`;
}
