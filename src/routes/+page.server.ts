import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { env as privateEnv } from "$env/dynamic/private";
import { hasPermission } from "$lib/utils";
import {
  myUpcomingShifts,
  pendingAppointmentCount,
  pendingExpenseCount,
  pendingSignupCount,
  upcomingServiceDates,
} from "$lib/server/dashboard";

// The home page: only for people who are signed in. Each tile is included only when the person
// has its permission, so nothing is counted (or sent to the browser) for anyone else.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user;
  if (!user)
    throw redirect(
      303,
      `/login?redirectTo=${encodeURIComponent(url.pathname)}`,
    );

  const can = (permissions: string[]) =>
    !!hasPermission(user.permissions, permissions);
  const timeZone = privateEnv.TIMEZONE || "America/Toronto";

  const wantsAppointments = can(["manage-appointments"]);
  const wantsExpenses = can(["manage-expenses"]);
  const wantsVolunteers = can(["manage-volunteers"]);
  const isVolunteer = can(["access-volunteer"]);

  // the service dates are shared by the two tiles that list them
  const [
    dates,
    pendingAppointments,
    pendingExpenses,
    pendingSignups,
    myShifts,
  ] = await Promise.all([
    wantsAppointments || wantsVolunteers
      ? upcomingServiceDates(timeZone)
      : Promise.resolve([]),
    wantsAppointments ? pendingAppointmentCount() : Promise.resolve(0),
    wantsExpenses ? pendingExpenseCount() : Promise.resolve(0),
    wantsVolunteers ? pendingSignupCount() : Promise.resolve(0),
    isVolunteer ? myUpcomingShifts(user.id) : Promise.resolve([]),
  ]);

  return {
    timeZone,
    appointments: wantsAppointments
      ? {
          dates: dates.map((d) => ({
            id: d.id,
            title: d.title,
            start: d.start,
            place: d.place,
            href: d.href,
            ...d.appointments,
          })),
          pending: pendingAppointments,
          canReview: can(["manage-households"]),
        }
      : null,
    myShifts: isVolunteer ? { shifts: myShifts } : null,
    expenses: wantsExpenses ? { pending: pendingExpenses } : null,
    volunteers: wantsVolunteers
      ? {
          dates: dates.map((d) => ({
            id: d.id,
            title: d.title,
            start: d.start,
            place: d.place,
            href: d.href,
            ...d.volunteers,
          })),
          pending: pendingSignups,
        }
      : null,
  };
};
