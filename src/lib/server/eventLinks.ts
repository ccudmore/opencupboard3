import { zonedParts } from "#lib/timezone.ts";
import { TIMEZONE } from "$app/env/private";

/** The event type the calendar uses for service dates. */
export const SERVICE_DATE = "Service Date";

const tz = () => TIMEZONE || "America/Toronto";

/**
 * The Service Dates page opened on one service date (and its Appointments tab, for an appointment).
 * Pass the event's id too: two service dates can fall on the same day, and the date alone can't say which.
 */
export function serviceDateLink(start: Date, appointments = false, id?: string): string {
  const date = zonedParts(start, tz()).date;
  const today = zonedParts(new Date(), tz()).date;
  const q = new URLSearchParams();
  if (date < today) q.set("past", "1"); // earlier service dates are only listed with this
  q.set("focus", date);
  if (id) q.set("id", id);
  if (appointments) q.set("tab", "appointments");
  return `/servicedates?${q}`;
}

/** The calendar opened on one event, on the day it starts. */
export function calendarEventLink(id: string, start: Date): string {
  const q = new URLSearchParams({ event: id, date: zonedParts(start, tz()).date });
  return `/calendar?${q}`;
}
