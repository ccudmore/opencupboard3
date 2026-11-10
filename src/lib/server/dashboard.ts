import prisma from "$lib/prisma";
import {
  AppointmentBookingStatus,
  EventStatus,
  ExpenseStatus,
  VolunteerAssignmentsStatus,
} from "$prisma/enums";
import { zonedParts } from "$lib/timezone";

// The numbers on the home page tiles. The page decides who may see which; these only count.

const SERVICE_TYPE = "Service Date";
const HOLDS = [
  AppointmentBookingStatus.PENDING,
  AppointmentBookingStatus.ACTIVE,
];

export type ServiceDateSummary = {
  id: string;
  title: string;
  start: Date;
  place: string;
  /** The Service Dates page opened on this date */
  href: string;
  appointments: { booked: number; available: number };
  volunteers: { booked: number; needed: number };
};

/** The next few service dates, with how full their appointments and volunteer jobs are. */
export async function upcomingServiceDates(
  timeZone: string,
  limit = 8,
): Promise<ServiceDateSummary[]> {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      type: SERVICE_TYPE,
      status: EventStatus.ACTIVE,
      endTime: { gt: now },
    },
    orderBy: { startTime: "asc" },
    take: limit,
    include: {
      location: { select: { name: true } },
      needs: { select: { count: true } },
      appointments: {
        select: {
          startTime: true,
          bookings: { where: { status: { in: HOLDS } }, select: { id: true } },
        },
      },
      volunteers: {
        where: {
          status: {
            in: [
              VolunteerAssignmentsStatus.ACTIVE,
              VolunteerAssignmentsStatus.COMPLETE,
            ],
          },
        },
        select: { id: true },
      },
    },
  });

  return events.map((e) => {
    const held = e.appointments.filter((a) => a.bookings.length > 0).length;
    const open = e.appointments.filter(
      (a) => a.bookings.length === 0 && a.startTime > now,
    ).length;
    return {
      id: e.id,
      title: e.title ?? SERVICE_TYPE,
      start: e.startTime,
      place: e.location?.name ?? e.locationText ?? "",
      href: `/servicedates?focus=${zonedParts(e.startTime, timeZone).date}`,
      appointments: { booked: held, available: open },
      volunteers: {
        booked: e.volunteers.length,
        needed: e.needs.reduce((sum, n) => sum + n.count, 0),
      },
    };
  });
}

/** The next shifts of the volunteer tied to this login, with where each stands (pending, active...). */
export async function myUpcomingShifts(userId: string, limit = 8) {
  const volunteer = await prisma.volunteer.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!volunteer) return [];
  const rows = await prisma.volunteerAssignments.findMany({
    where: {
      volunteerId: volunteer.id,
      status: { not: VolunteerAssignmentsStatus.CANCELLED },
      event: { status: EventStatus.ACTIVE, endTime: { gte: new Date() } },
    },
    include: { event: { include: { location: { select: { name: true } } } } },
    orderBy: { event: { startTime: "asc" } },
    take: limit,
  });
  return rows.map((a) => ({
    id: a.id,
    title: a.event.title ?? a.event.type,
    role: a.eventRole,
    status: a.status,
    start: a.event.startTime,
    place: a.event.location?.name ?? a.event.locationText ?? "",
  }));
}

/** Bookings that households asked for online and nobody has confirmed. */
export const pendingAppointmentCount = () =>
  prisma.appointmentBookings.count({
    where: { status: AppointmentBookingStatus.PENDING },
  });

export const pendingExpenseCount = () =>
  prisma.expense.count({ where: { status: ExpenseStatus.PENDING } });

/** Volunteers who signed up for a shift and are waiting to be approved (archived volunteers and past events don't count). */
export const pendingSignupCount = () =>
  prisma.volunteerAssignments.count({
    where: {
      status: VolunteerAssignmentsStatus.PENDING,
      volunteer: { status: "ACTIVE" },
      event: { status: EventStatus.ACTIVE, endTime: { gt: new Date() } },
    },
  });
