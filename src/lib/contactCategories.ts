import { CONTACT_CATEGORIES } from "$app/env/public";

/** The categories offered for contacts, from the CONTACT_CATEGORIES environment variable. */
export const contactCategories: string[] = [
  ...new Set(
    CONTACT_CATEGORIES.split(",")
      .map((c) => c.trim())
      .filter(Boolean),
  ),
];
