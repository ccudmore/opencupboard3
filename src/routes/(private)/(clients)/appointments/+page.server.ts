import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';

export const load: PageServerLoad = async ({ url }) => {
//    const result = await searchHousehold(parseHouseholdSearchParams(url.searchParams));

// craig - move to a query
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const services = await prisma.event.findMany({
        where: {
            type: 'Service Date',
            status: 'Active',
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
                //craig - also include households
            }
        }
    })

for (const event of services as any[]) {
  let booked = 0;
  let available = 0;

  for (const appt of event.appointments) {
    const activeBookings = appt.bookings.filter((b: any) => b.status === 'Active');

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
    const craig = JSON.stringify(services)

    // sort bookings into active, historical
    console.log('CRAIG3')

    // for each service, get the countof 
    console.log(craig)
    return { services };
};