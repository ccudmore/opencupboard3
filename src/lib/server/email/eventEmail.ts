import { streetWithUnit } from "$lib/address";
import { z } from "zod";
import prisma from "$lib/prisma";
import type { Prisma } from "$prisma/client";
import { VolunteerAssignmentsStatus } from "$prisma/enums";
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { isMailConfigured, sendMail } from "./mailer";
import { fill, renderTemplate } from "./templates";
import type { Recipient } from "./bookingEmail";

// Emails to the people attending a calendar event (not a service date, which has its own emails):
// its volunteers and its guests. Each person gets their own message, greeted by first name.

export type EventEmailKind = "confirmation" | "reminder";

const TEMPLATES: Record<
  EventEmailKind,
  { template: string; column: "confirmations" | "reminders" }
> = {
  confirmation: { template: "event-confirmation", column: "confirmations" },
  reminder: { template: "event-reminder", column: "reminders" },
};

const eventInclude = {
  location: true,
  volunteers: {
    where: { status: { not: VolunteerAssignmentsStatus.CANCELLED } },
    include: { volunteer: { include: { user: { select: { email: true } } } } },
  },
  guests: true,
} satisfies Prisma.EventInclude;

type EmailEvent = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

/** One person to email, who may have more than one address. */
interface Person {
  kind: "volunteer" | "guest";
  /** the assignment's or the guest's id, where the "sent" history is kept */
  id: string;
  name: string;
  firstName: string;
  emails: string[];
}

const validEmail = (v: string | null | undefined) =>
  z.email().safeParse((v ?? "").trim()).success;

/** Everyone on the event who has an address. Guests are left out when `includeGuests` is false. */
function peopleOf(event: EmailEvent, includeGuests: boolean): Person[] {
  const out: Person[] = [];
  for (const a of event.volunteers) {
    const emails = [
      ...new Set(
        [a.volunteer.user.email, a.volunteer.email2]
          .filter(validEmail)
          .map((e) => e!.trim()),
      ),
    ];
    if (emails.length === 0) continue;
    out.push({
      kind: "volunteer",
      id: a.id,
      name: `${a.volunteer.firstName} ${a.volunteer.lastName}`.trim(),
      firstName: a.volunteer.firstName.trim(),
      emails,
    });
  }
  if (includeGuests) {
    for (const g of event.guests) {
      if (!validEmail(g.email)) continue;
      out.push({
        kind: "guest",
        id: g.id,
        name: g.name,
        firstName: g.name.trim().split(/\s+/)[0] ?? "",
        emails: [g.email!.trim()],
      });
    }
  }
  return out;
}

function settings() {
  return {
    organization: publicEnv.PUBLIC_ORGANIZATION_NAME || "Open Cupboard",
    timeZone: privateEnv.TIMEZONE || "America/Toronto",
  };
}

/** For a repeating event: the occurrence the message is about (its start), else the event's own time. */
function times(event: EmailEvent, occurrence?: string) {
  const duration = +event.endTime - +event.startTime;
  const start =
    occurrence && !isNaN(Date.parse(occurrence))
      ? new Date(occurrence)
      : event.startTime;
  return { start, end: new Date(+start + duration) };
}

export type EventDraft =
  | {
      ok: true;
      draft: { to: Recipient[]; subject: string; body: string };
      people: Person[];
      event: EmailEvent;
    }
  | { ok: false; status: number; message: string };

/**
 * Builds the message from its template. Nothing is sent. {{firstName}} is left in the text and
 * filled in for each person when it is sent, so one edited message still greets everyone by name.
 */
export async function buildEventEmail(
  eventId: string,
  kind: EventEmailKind,
  opts: { occurrence?: string; includeGuests: boolean },
): Promise<EventDraft> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });
  if (!event || event.status !== "ACTIVE")
    return { ok: false, status: 404, message: "That event no longer exists." };
  if (event.type === "Service Date")
    return {
      ok: false,
      status: 400,
      message: "Service date emails are sent from the Service Dates page.",
    };

  const people = peopleOf(event, opts.includeGuests);
  if (people.length === 0)
    return {
      ok: false,
      status: 400,
      message: "None of the attendees has an email address.",
    };

  const { organization, timeZone } = settings();
  const { start, end } = times(event, opts.occurrence);
  const dateFormat = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeZone,
  });
  const timeFormat = new Intl.DateTimeFormat("en-CA", {
    timeStyle: "short",
    timeZone,
  });
  const loc = event.location;
  const address = loc
    ? [streetWithUnit(loc.street, loc.unitNumber), loc.city]
        .filter(Boolean)
        .join(", ")
    : "";
  const locationName = loc?.name ?? event.locationText ?? "";
  const note = event.note?.trim() ?? "";

  const { subject, body } = await renderTemplate(TEMPLATES[kind].template, {
    firstName: "{{firstName}}",
    eventTitle: event.title?.trim() || event.type,
    eventType: event.type,
    date: dateFormat.format(start),
    time: timeFormat.format(start),
    endTime: timeFormat.format(end),
    location: [locationName, address].filter(Boolean).join(", "),
    locationName,
    address,
    note,
    noteSection: note ? `Note: ${note}\n` : "",
    organization,
  });
  const to = people.flatMap((p) =>
    p.emails.map((email) => ({ name: p.name, email })),
  );
  return { ok: true, draft: { to, subject, body }, people, event };
}

export type EventSendResult =
  | { ok: true; to: Recipient[]; failed: string[] }
  | { ok: false; status: number; message: string };

const MAX_SUBJECT = 200;
const MAX_BODY = 10_000;

/** Sends one message per person. The addresses always come from the database. */
export async function sendEventEmail(args: {
  eventId: string;
  kind: EventEmailKind;
  userId?: string;
  occurrence?: string;
  includeGuests: boolean;
  subject?: string;
  body?: string;
}): Promise<EventSendResult> {
  if (!isMailConfigured())
    return {
      ok: false,
      status: 503,
      message: "Email is not set up on this server.",
    };
  const built = await buildEventEmail(args.eventId, args.kind, args);
  if (!built.ok) return built;

  const subject = (args.subject?.trim() || built.draft.subject)
    .replace(/[\r\n]+/g, " ")
    .slice(0, MAX_SUBJECT);
  const template = (args.body?.trim() ? args.body : built.draft.body).slice(
    0,
    MAX_BODY,
  );
  const column = TEMPLATES[args.kind].column;

  const sent: Recipient[] = [];
  const failed: string[] = [];
  for (const p of built.people) {
    try {
      await sendMail({
        to: p.emails,
        subject,
        text: fill(template, { firstName: p.firstName }),
      });
    } catch (err) {
      console.error(
        `Sending event ${args.kind} email to ${p.name} failed:`,
        err,
      );
      failed.push(p.name);
      continue;
    }
    sent.push(...p.emails.map((email) => ({ name: p.name, email })));

    // Remember when it was sent
    const entry = {
      sentAt: new Date().toISOString(),
      to: p.emails,
      sentBy: args.userId ?? null,
    };
    if (p.kind === "volunteer") {
      const row = await prisma.volunteerAssignments.findUnique({
        where: { id: p.id },
        select: { confirmations: true, reminders: true },
      });
      const current = row?.[column];
      await prisma.volunteerAssignments.update({
        where: { id: p.id },
        data: {
          [column]: [
            ...(Array.isArray(current) ? current : []),
            entry,
          ] as Prisma.InputJsonValue,
        },
      });
    } else {
      const row = await prisma.eventGuest.findUnique({
        where: { id: p.id },
        select: { confirmations: true, reminders: true },
      });
      const current = row?.[column];
      await prisma.eventGuest.update({
        where: { id: p.id },
        data: {
          [column]: [
            ...(Array.isArray(current) ? current : []),
            entry,
          ] as Prisma.InputJsonValue,
        },
      });
    }
  }
  if (sent.length === 0)
    return {
      ok: false,
      status: 502,
      message: "The emails could not be sent. Please try again later.",
    };
  return { ok: true, to: sent, failed };
}
