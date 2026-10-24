import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';
import { requirePermission } from '$lib/utils';
import { EventStatus, AppointmentBookingStatus} from '$prisma/enums';

export const load: PageServerLoad = async ({ url, locals }) => {
//    const result = await searchHousehold(parseHouseholdSearchParams(url.searchParams));
    requirePermission(locals?.user?.permissions, url, ['manage-appointments']);

// craig - move to a query
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const services = await prisma.event.findMany({
        where: {
            type: 'Service Date',
            status: EventStatus.ACTIVE,
            startTime: {gt: oneYearAgo},
        },
        orderBy: {startTime: 'asc'},
        include: {
            appointments: {
                orderBy: { startTime: 'asc' }, 
                include: {
                    bookings: {
                        include: {household: true}
                    }}
            }
        }
    })

for (const event of services as any[]) {
  let booked = 0;
  let available = 0;

  for (const appt of event.appointments) {
    const activeBookings = appt.bookings.filter((b: any) => b.status === AppointmentBookingStatus.ACTIVE);

    if (activeBookings.length > 0) {
      booked++;
      const activeHousehold = activeBookings
        .map((b: any) => b.household)
        .find((h: any) => h?.status === 'Active');

      if (activeHousehold) {
        appt.activeBookingHousehold = activeHousehold;
      } else {
        delete appt.activeBookingHousehold;
      }
      
    } else {
      available++;
      delete appt.activeBookingHousehold;
    }
  }

  event.bookedAppointmentCount = booked;
  event.availableAppointmentCount = available;
}
 
    // sort bookings into active, historical

    // for each service, get the countof 
    return { services };
};