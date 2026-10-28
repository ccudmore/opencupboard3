// What the service dates page sends to its components (see loadServiceDates in $lib/server/serviceDates.ts)
export type Appointment = {
	id: string;
	startTime: Date;
	endTime: Date;
	past: boolean;
	booking: { id: string; householdId: string; name: string } | null;
};

export type Service = {
	id: string;
	title: string;
	note: string;
	status: 'ACTIVE' | 'CANCELLED';
	startTime: Date;
	endTime: Date;
	date: string; // YYYY-MM-DD in the organization's time zone
	startClock: string; // HH:MM
	endClock: string;
	past: boolean;
	siteId: string;
	siteName: string;
	appointments: Appointment[];
	counts: { total: number; booked: number; open: number };
	roles: { role: string; required: number; filled: number }[];
	volunteers: { assignmentId: string; volunteerId: string; name: string; role: string; status: string }[];
};

export type Site = { id: string; name: string };
