import { fail } from "@sveltejs/kit";
import { z } from "zod";
import prisma from "#lib/prisma.ts";

// Add, edit and delete external contacts. The caller has already checked the `manage-contacts` permission.

export const CONTACTS_PERMISSION = "manage-contacts";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const email = z
  .string()
  .trim()
  .max(200)
  .refine(
    (v) => v === "" || z.string().email().safeParse(v).success,
    "Enter a valid email address",
  )
  .transform((v) => v.toLowerCase() || null);

// "example.org" becomes "https://example.org". Only http and https links are kept, because the
// address is shown as a clickable link.
const website = z
  .string()
  .trim()
  .max(300)
  .transform((v, ctx) => {
    if (!v) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const url = new URL(withScheme);
      if (
        (url.protocol !== "http:" && url.protocol !== "https:") ||
        !url.hostname.includes(".")
      )
        throw new Error("bad");
      return url.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid web site address" });
      return z.NEVER;
    }
  });

// Phone numbers are free text (extensions, international numbers), but must look like one:
// only phone-number characters and at least 7 digits.
const phone = z
  .string()
  .trim()
  .max(40)
  .refine(
    (v) =>
      v === "" ||
      (/^[0-9+().\-\s#,xXeEtT]+$/.test(v) && v.replace(/\D/g, "").length >= 7),
    "Enter a valid phone number",
  )
  .transform((v) => v || null);

const contactFields = {
  name: z.string().trim().min(1, "Enter a name").max(150),
  organization: optional(150),
  jobTitle: optional(100),
  category: z.string().trim().min(1, "Choose a category").max(100),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  phone,
  altPhone: phone,
  email,
  website,
  street: optional(200),
  city: optional(100),
  state: optional(100),
  postalCode: optional(20),
  country: optional(100),
  notes: optional(2000),
};
const createSchema = z.object(contactFields);
const updateSchema = z.object({ contactId: z.string().min(1), ...contactFields });

const FIELDS = [
  "name",
  "organization",
  "jobTitle",
  "category",
  "status",
  "phone",
  "altPhone",
  "email",
  "website",
  "street",
  "city",
  "state",
  "postalCode",
  "country",
  "notes",
] as const;

const read = (fd: FormData) =>
  Object.fromEntries(FIELDS.map((key) => [key, text(fd, key)]));

function handleError(err: unknown) {
  console.error(err);
  return fail(500, { message: "Something went wrong. Please try again." });
}

/** Every contact, for the Contacts page (which searches and filters in the browser). */
export function listContacts() {
  return prisma.contact.findMany({
    orderBy: [{ name: "asc" }],
  });
}

export async function createContact(
  actorId: string | undefined,
  formData: FormData,
) {
  const parsed = createSchema.safeParse(read(formData));
  if (!parsed.success)
    return fail(400, { message: parsed.error.issues[0].message });
  try {
    const contact = await prisma.contact.create({
      data: { ...parsed.data, createdBy: actorId },
    });
    return { contactId: contact.id };
  } catch (err) {
    return handleError(err);
  }
}

export async function updateContact(formData: FormData) {
  const parsed = updateSchema.safeParse({
    contactId: text(formData, "contactId"),
    ...read(formData),
  });
  if (!parsed.success)
    return fail(400, { message: parsed.error.issues[0].message });
  const { contactId, ...data } = parsed.data;
  try {
    await prisma.contact.update({ where: { id: contactId }, data });
    return { contactId };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025")
      return fail(404, { message: "That contact no longer exists." });
    return handleError(err);
  }
}

export async function deleteContact(formData: FormData) {
  const contactId = text(formData, "contactId");
  if (!contactId) return fail(400, { message: "Invalid request." });
  try {
    await prisma.contact.delete({ where: { id: contactId } });
    return { deleted: true };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2025")
      return fail(404, { message: "That contact no longer exists." });
    return handleError(err);
  }
}
