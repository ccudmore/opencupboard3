import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { TIMEZONE } from "$app/env/private";
import { SHOW_HOUSEHOLD_SIZE } from "$app/env/public";
import prisma from "#lib/prisma.ts";
import { requirePermission, isIdVerificationNeeded } from "#lib/utils.ts";
import { calculateChildCount, calculateFamilySize } from "#lib/utils.ts";
import { HOLDS_APPOINTMENT } from "#lib/server/bookingActions.ts";
import { datedRequestTypes } from "#lib/datedRequestTypes.ts";
import {
  ClientRelationship,
  DatedRequestStatus,
  AppointmentBookingStatus,
} from "#prisma/enums";
import type { HouseholdMember } from "#lib/types/household.ts";

// "Create Chits": a printable sheet with one slip (chit) per appointment of a service date,
// two across and four down, so eight to a page. It is a standalone page rather than part of the
// app, so the menus don't print; the Print button (or Ctrl/Cmd+P) can also save it as a PDF.

const PER_PAGE = 8;
// Long text is shortened so a chit never runs past its box; the full text is on the household page
const MAX_REQUEST = 120;
const MAX_NOTES = 100;
const MAX_PETS = 60;
const MAX_DIET = 80;

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const clip = (s: string, max: number) =>
  s.length > max ? s.slice(0, max).trimEnd() + "…" : s;

const oneLine = (s: string | null | undefined) =>
  (s ?? "").replace(/\s+/g, " ").trim();

export const GET: RequestHandler = async ({ locals, url, params }) => {
  requirePermission(locals?.user?.permissions, url, ["manage-appointments"]);
  const tz = TIMEZONE || "America/Toronto";

  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: {
      title: true,
      startTime: true,
      location: { select: { name: true } },
      appointments: {
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          bookings: {
            where: {
              status: {
                in: [...HOLDS_APPOINTMENT, AppointmentBookingStatus.COMPLETE],
              },
            },
            take: 1,
            select: {
              // a request made when the booking was made, even if it isn't an open special request
              datedRequest: { select: { requestText: true } },
              household: {
                select: {
                  pets: true,
                  dietaryRestrictions: true,
                  languagesSpoken: true,
                  notes: true,
                  members: {
                    select: {
                      firstName: true,
                      lastName: true,
                      relationship: true,
                      birthYear: true,
                      idCheckDate: true,
                    },
                    orderBy: { createdAt: "asc" },
                  },
                  datedRequests: {
                    where: {
                      type: datedRequestTypes[0].name,
                      status: DatedRequestStatus.ACTIVE,
                    },
                    orderBy: { createdAt: "asc" },
                    select: { requestText: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!event) throw error(404, "Service date not found");

  const time = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const day = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeZone: tz,
  });
  const dateText = day.format(event.startTime);

  const chit = (a: (typeof event.appointments)[number]) => {
    // appointments show their start time only
    const when = `<strong>${esc(time.format(a.startTime))}</strong> <span class="date">${esc(dateText)}</span>`;
    const household = a.bookings[0]?.household;
    if (!household) {
      return `<div class="chit open"><div class="when">${when}</div><p class="none">No household booked</p></div>`;
    }
    const members = household.members;
    const primary = members
      .filter((m) => m.relationship === ClientRelationship.PRIMARY)
      .map((m) => `${m.firstName} ${m.lastName}`.trim())
      .join(" & ");
    const needsId = members
      .filter((m) => isIdVerificationNeeded(m.idCheckDate))
      .map((m) => `${m.firstName} ${m.lastName}`.trim());
    const asMembers = members as unknown as HouseholdMember[];
    const size = `${members.length} (${calculateFamilySize(asMembers)})`;
    const children = calculateChildCount(asMembers);

    // open special requests, plus the request made with this booking if it isn't among them
    const requests = household.datedRequests
      .map((r) => oneLine(r.requestText))
      .filter(Boolean);
    const bookingRequest = oneLine(a.bookings[0]?.datedRequest?.requestText);
    if (bookingRequest && !requests.includes(bookingRequest))
      requests.push(bookingRequest);

    const languages = household.languagesSpoken.filter(Boolean).join(", ");
    const diet = household.dietaryRestrictions.filter(Boolean).join(", ");
    const pets = oneLine(household.pets);
    const notes = oneLine(household.notes);
    const idRow = needsId.length
      ? `<div class="row id"><span class="label">ID renewal due:</span> ${esc(clip(needsId.join(", "), 90))}</div>`
      : "";
    const row = (label: string, value: string) =>
      value
        ? `<div class="row"><span class="label">${esc(label)}:</span> ${value}</div>`
        : "";

    return `<div class="chit">
  <div class="when">${when}</div>
  <div class="who">${esc(primary) || "Unnamed household"}</div>
  <div class="facts">${SHOW_HOUSEHOLD_SIZE ? `<span>Family size: <strong>${esc(size)}</strong></span>` : ""}<span>Children: <strong>${children}</strong></span>${
    languages ? `<span>Languages spoken: <strong>${esc(languages)}</strong></span>` : ""
  }</div>
  ${idRow}
  ${row("Dietary", esc(clip(diet, MAX_DIET)))}
  ${row("Pets", esc(clip(pets, MAX_PETS)))}
  <div class="row"><span class="label">${esc(datedRequestTypes[0].name)}:</span> ${
    requests.length
      ? requests.map((t) => esc(clip(t, MAX_REQUEST))).join("; ")
      : '<span class="muted">none</span>'
  }</div>
  ${row("Notes", esc(clip(notes, MAX_NOTES)))}
</div>`;
  };

  const pages: string[] = [];
  for (let i = 0; i < event.appointments.length; i += PER_PAGE) {
    pages.push(
      `<section class="sheet">${event.appointments
        .slice(i, i + PER_PAGE)
        .map(chit)
        .join("")}</section>`,
    );
  }

  const title = `Chits: ${event.title ?? "Service date"}, ${dateText}`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  @page { size: letter portrait; margin: 0.4in; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; background: #f3f4f6; }
  .bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 12px 16px; background: #fff; border-bottom: 1px solid #d1d5db; }
  .bar h1 { font-size: 16px; margin: 0; flex: 1; }
  .bar button { font: inherit; padding: 8px 16px; border: 0; border-radius: 6px; background: #1f2937; color: #fff; cursor: pointer; }
  .empty { padding: 24px 16px; }
  .sheet { width: 7.7in; height: 10.2in; margin: 16px auto; background: #fff;
           display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 0.12in;
           break-after: page; box-shadow: 0 1px 4px rgba(0,0,0,.15); padding: 0; }
  .chit { border: 1.5px dashed #6b7280; border-radius: 6px; padding: 0.08in 0.12in; font-size: 10.5px; line-height: 1.28; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
  .when { font-size: 11px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; }
  .when strong { font-size: 16px; margin-right: 6px; }
  .who { font-size: 15px; font-weight: 700; }
  .facts { display: flex; gap: 4px 12px; flex-wrap: wrap; }
  .row { overflow-wrap: anywhere; }
  .label { font-weight: 600; }
  .muted { color: #6b7280; }
  .row.id { padding: 2px 6px; border: 1.5px solid #111; border-radius: 4px; font-weight: 600; }
  .open { color: #6b7280; }
  .none { margin: auto 0; text-align: center; font-size: 13px; }
  @media print {
    body { background: #fff; }
    .bar { display: none; }
    .sheet { margin: 0; box-shadow: none; width: auto; height: 10.2in; }
    .sheet:last-child { break-after: auto; }
  }
</style></head>
<body>
<div class="bar"><h1>${esc(title)}</h1><button type="button" onclick="window.print()">Print or save as PDF</button></div>
${pages.length ? pages.join("\n") : '<p class="empty">This service date has no appointments yet.</p>'}
</body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
};
