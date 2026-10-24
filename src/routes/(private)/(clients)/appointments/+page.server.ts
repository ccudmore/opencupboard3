import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';
import { requirePermission } from '$lib/utils';
import { EventStatus, AppointmentBookingStatus, HouseholdStatus } from '$prisma/enums';

export const load: PageServerLoad = async ({ url, locals }) => {
//    const result = await searchHousehold(parseHouseholdSearchParams(url.searchParams));
    requirePermission(locals?.user?.permissions, url, ['manage-appointments']);

// craig - move to a query
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const events = await prisma.event.findMany({
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
  const services = events.map((event) => {
	let booked = 0;
	let available = 0;

	const appointments = event.appointments.map((appt) => {
		const activeBookings = appt.bookings.filter(
			(b) => b.status === AppointmentBookingStatus.ACTIVE
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
		availableAppointmentCount: available
	};
});
};