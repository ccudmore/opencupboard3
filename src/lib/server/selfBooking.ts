import { randomInt } from "node:crypto";
import { z } from "zod";
import prisma from "$lib/prisma";
import {
  AppointmentBookingStatus,
  ClientRelationship,
  EventStatus,
  HouseholdStatus,
} from "$prisma/enums";
import { calculateNextServiceDate } from "$lib/utils";
import { getHouseholdBookings } from "$lib/server/queries/booking";
import { notifyPermission } from "$lib/server/notifications";
import { HOLDS_APPOINTMENT } from "$lib/server/bookingActions";

// What a household can do for itself on the public /book page. Nothing here is signed in: the
// household's unique ID is the only key, so every function checks it again, limits how often it
// can be tried, and shows nothing personal (no names, addresses or contact details).

export type Fail = { ok: false; status: number; message: string };
const fail = (status: number, message: string): Fail => ({
  ok: false,
  status,
  message,
});

const SERVICE_TYPE = "Service Date";
const OFFER_DAYS = 90; // how far ahead appointments are offered
const MAX_OFFERED = 200;
const MANAGERS = ["manage-households"];

// ---------------------------------------------------------------- limits

const attempts = new Map<string, number[]>();

/** True when `key` has already used up `max` tries in the last `windowMs`. Otherwise counts this try. */
export function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 5000)
    for (const [k, v] of attempts)
      if (v.every((t) => now - t >= windowMs)) attempts.delete(k);
  return false;
}

const TOO_MANY =
  "Too many tries. Please wait a few minutes and try again, or contact us.";

// ---------------------------------------------------------------- the household

const ID_PATTERN = /^[A-Z0-9]{4,12}$/;
const normalizeId = (raw: unknown) =>
  String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const names = (members: { firstName: string; lastName: string }[]) =>
  members.map((m) => `${m.firstName} ${m.lastName}`.trim()).join(" & ") ||
  "A household";

/** The household for an ID, or the reason there isn't one. The same message for "no such ID" however it fails. */
async function householdFor(rawId: unknown) {
  const uniqueId = normalizeId(rawId);
  if (!ID_PATTERN.test(uniqueId))
    return fail(
      404,
      "We could not find that ID. Please check it and try again.",
    );
  const household = await prisma.household.findUnique({
    where: { uniqueId },
    include: {
      members: {
        where: { relationship: ClientRelationship.PRIMARY },
        select: { firstName: true, lastName: true },
      },
    },
  });
  if (!household)
    return fail(
      404,
      "We could not find that ID. Please check it and try again.",
    );
  return { ok: true as const, household };
}

// ---------------------------------------------------------------- look up

export async function lookup(ip: string, rawId: unknown) {
  if (tooMany(`lookup:${ip}`, 15, 15 * 60_000)) return fail(429, TOO_MANY);
  const found = await householdFor(rawId);
  if (!found.ok) return found;
  const { household } = found;

  if (household.status === HouseholdStatus.PENDING) {
    return { ok: true as const, state: "pending" as const };
  }
  if (household.status !== HouseholdStatus.ACTIVE) {
    return { ok: true as const, state: "inactive" as const };
  }

  const bookings = await getHouseholdBookings(household.id);
  const history = bookings.map((b) => ({
    id: b.id,
    when: (
      b.appointment?.startTime ??
      b.plannedStart ??
      b.createdAt
    ).toISOString(),
    scheduled: !!b.appointment,
    status: b.status,
    place: b.appointment?.event.location?.name ?? b.plannedSite?.name ?? "",
  }));

  const eligible = calculateNextServiceDate(bookings); // null: can book right away
  const heldDays = new Set(
    bookings
      .filter((b) => HOLDS_APPOINTMENT.includes(b.status) && b.appointment)
      .map((b) => b.appointment!.eventId),
  );

  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      type: SERVICE_TYPE,
      status: EventStatus.ACTIVE,
      endTime: { gt: now },
      startTime: {
        ...(eligible ? { gte: eligible } : {}),
        lt: new Date(+now + OFFER_DAYS * 86_400_000),
      },
    },
    orderBy: { startTime: "asc" },
    include: {
      location: true,
      appointments: {
        where: {
          startTime: { gt: now },
          bookings: { none: { status: { in: HOLDS_APPOINTMENT } } },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });

  const appointments = events
    .filter((e) => !heldDays.has(e.id))
    .flatMap((e) =>
      e.appointments.map((a) => ({
        id: a.id,
        start: a.startTime.toISOString(),
        end: a.endTime.toISOString(),
        place: e.location?.name ?? e.locationText ?? "",
      })),
    )
    .slice(0, MAX_OFFERED);

  return {
    ok: true as const,
    state: "active" as const,
    history,
    eligibleDate: eligible ? eligible.toISOString() : null,
    appointments,
  };
}

// ---------------------------------------------------------------- book

class Taken extends Error {}
class NotAllowed extends Error {}

export async function book(ip: string, rawId: unknown, appointmentId: unknown) {
  if (tooMany(`book:${ip}`, 10, 15 * 60_000)) return fail(429, TOO_MANY);
  const found = await householdFor(rawId);
  if (!found.ok) return found;
  const { household } = found;
  if (household.status !== HouseholdStatus.ACTIVE)
    return fail(
      403,
      "This household cannot book online right now. Please contact us.",
    );
  const apptId = typeof appointmentId === "string" ? appointmentId : "";
  if (!apptId) return fail(400, "Choose an appointment.");

  let booked: { startTime: Date; place: string } | null = null;
  for (let attempt = 0; attempt < 3 && !booked; attempt++) {
    try {
      booked = await prisma.$transaction(
        async (tx) => {
          const appt = await tx.appointment.findUnique({
            where: { id: apptId },
            include: { event: { include: { location: true } } },
          });
          if (
            !appt ||
            appt.event.type !== SERVICE_TYPE ||
            appt.event.status !== EventStatus.ACTIVE ||
            appt.startTime <= new Date()
          ) {
            throw new NotAllowed(
              "That appointment is no longer available. Please choose another.",
            );
          }

          // Someone else may have asked for it a moment ago (pending ones hold the appointment too)
          const held = await tx.appointmentBookings.count({
            where: { appointmentId: apptId, status: { in: HOLDS_APPOINTMENT } },
          });
          if (held > 0)
            throw new Taken(
              "Sorry, that appointment was just taken. Please choose another.",
            );

          const mine = await tx.appointmentBookings.findMany({
            where: { householdId: household.id },
            include: { appointment: true },
          });
          const eligible = calculateNextServiceDate(
            mine as Parameters<typeof calculateNextServiceDate>[0],
          );
          if (eligible && appt.event.startTime < eligible)
            throw new NotAllowed("You are not able to book that date yet.");
          if (
            mine.some(
              (b) =>
                HOLDS_APPOINTMENT.includes(b.status) &&
                b.appointment?.eventId === appt.eventId,
            )
          ) {
            throw new NotAllowed(
              "You already have an appointment on that day.",
            );
          }

          await tx.appointmentBookings.create({
            data: {
              status: AppointmentBookingStatus.PENDING,
              createdBy: "public-booking",
              household: { connect: { id: household.id } },
              appointment: { connect: { id: apptId } },
            },
          });
          return {
            startTime: appt.startTime,
            place: appt.event.location?.name ?? appt.event.locationText ?? "",
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      if (err instanceof Taken || err instanceof NotAllowed)
        return fail(409, err.message);
      if ((err as { code?: string })?.code === "P2034") continue; // two people at once: try again
      console.error(err);
      return fail(500, "Something went wrong. Please try again.");
    }
  }
  if (!booked)
    return fail(
      409,
      "That appointment may have just been taken. Please try again.",
    );

  await notifyPermission(MANAGERS, {
    subject: "New pending appointment booking",
    body: `${names(household.members)} asked to book ${booked.startTime.toISOString()}${booked.place ? ` at ${booked.place}` : ""}. It is waiting for confirmation.`,
    link: "/households/pending",
    createdBy: "public-booking",
  });
  return {
    ok: true as const,
    start: booked.startTime.toISOString(),
    place: booked.place,
  };
}

// ---------------------------------------------------------------- sign up

const POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/;
const text = (max: number) => z.string().trim().max(max);

const registerSchema = z
  .object({
    firstName: text(100).min(1, "Enter your first name"),
    lastName: text(100).min(1, "Enter your last name"),
    street: text(200).min(1, "Enter your street address"),
    unitNumber: text(30),
    city: text(100).min(1, "Enter your city"),
    postalCode: z
      .string()
      .transform((v) => v.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
      .refine((v) => POSTAL.test(v), "Enter a valid postal code (e.g. K1A 0B1)")
      .transform((v) => `${v.slice(0, 3)} ${v.slice(3)}`),
    email: z.union([z.literal(""), z.email("Enter a valid email address")]),
    phone: z
      .string()
      .transform((v) => {
        let d = v.replace(/\D/g, "");
        if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
        return d;
      })
      .refine(
        (d) => d === "" || /^[2-9]\d{2}[2-9]\d{6}$/.test(d),
        "Enter a valid phone number (e.g. 613-555-1234)",
      )
      .transform((d) =>
        d ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : "",
      ),
    adults: z.coerce
      .number()
      .int()
      .min(1, "Enter how many adults are in your household")
      .max(30),
    children: z.coerce.number().int().min(0).max(30),
    dietaryRestrictions: z.array(text(60)).max(20),
    notes: text(1000),
  })
  .refine((d) => d.email !== "" || d.phone !== "", {
    message: "Enter an email address or a phone number so we can reach you",
    path: ["email"],
  });

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const newId = () =>
  Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    "",
  );

/** Creates a Pending household and tells the household managers. A repeat of someone already on file creates nothing, but looks the same. */
export async function register(ip: string, data: Record<string, unknown>) {
  // A hidden field that only a bot fills in: act as if it worked
  if (typeof data.website === "string" && data.website.trim() !== "")
    return { ok: true as const };
  if (tooMany(`register:${ip}`, 5, 60 * 60_000)) return fail(429, TOO_MANY);

  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const d = parsed.data;

  const duplicate = await prisma.client.findFirst({
    where: {
      OR: [
        ...(d.email
          ? [{ email: { equals: d.email, mode: "insensitive" as const } }]
          : []),
        ...(d.phone ? [{ phone: d.phone }] : []),
      ],
    },
    select: { id: true },
  });
  if (duplicate) {
    await notifyPermission(MANAGERS, {
      subject: "Possible repeat sign-up",
      body: `${d.firstName} ${d.lastName} signed up online with an email or phone number that is already on file. Nothing was created.`,
      link: "/households",
      createdBy: "public-booking",
    });
    return { ok: true as const };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.household.create({
        data: {
          status: HouseholdStatus.PENDING,
          uniqueId: newId(),
          createdBy: "public-signup",
          unitNumber: d.unitNumber || null,
          street: d.street,
          city: d.city,
          postalCode: d.postalCode,
          province: "Ontario",
          country: "Canada",
          adultCount: d.adults,
          childCount: d.children,
          dietaryRestrictions: d.dietaryRestrictions,
          notes: d.notes || null,
          members: {
            create: {
              firstName: d.firstName,
              lastName: d.lastName,
              email: d.email ? d.email.toLowerCase() : null,
              phone: d.phone || null,
              relationship: ClientRelationship.PRIMARY,
              createdBy: "public-signup",
            },
          },
        },
      });
      await notifyPermission(MANAGERS, {
        subject: "New household waiting for approval",
        body: `${d.firstName} ${d.lastName} signed up on the booking page.`,
        link: "/households/pending",
        createdBy: "public-signup",
      });
      return { ok: true as const };
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") continue; // that ID was taken: pick another
      console.error(err);
      return fail(
        500,
        "Something went wrong. Please try again, or contact us.",
      );
    }
  }
  return fail(500, "Something went wrong. Please try again, or contact us.");
}
