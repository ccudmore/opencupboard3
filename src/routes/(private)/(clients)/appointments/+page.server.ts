import type { PageServerLoad } from "./$types";
import { requirePermission } from "#lib/utils.ts";
import { retrieveServiceDatesInThePastYear } from "#lib/server/queries/event.ts";
import {
  AppointmentBookingStatus,
  HouseholdStatus,
} from "#prisma/enums";

export const load: PageServerLoad = async ({ url, locals }) => {
  requirePermission(locals?.user?.permissions, url, ["manage-appointments"]);

  const events = await retrieveServiceDatesInThePastYear();
// CRAIG - this could be a dead code path, but I don't want to delete it yet.  It is used in the appointments page to show the number of booked and available appointments for each service date.  I think this is a good idea, but it is not currently used in the UI.  I will leave it here for now, but we may want to remove it later if we don't use it.

  const services = events.map((event) => {
    let booked = 0;
    let available = 0;

    const appointments = event.appointments.map((appt) => {
      const activeBookings = appt.bookings.filter(
        (b) => b.status === AppointmentBookingStatus.ACTIVE,
      );

      if (activeBookings.length === 0) {
        available++;
        return { ...appt, activeBookingHousehold: undefined };
      }

      booked++;
      const activeBookingHousehold = activeBookings
        .map((b) => b.household)
        .find((h) => h.status === HouseholdStatus.ACTIVE);

      return { ...appt, activeBookingHousehold };
    });

    return {
      ...event,
      appointments,
      bookedAppointmentCount: booked,
      availableAppointmentCount: available,
    };
  });
};
