import type { RequestHandler } from '@sveltejs/kit';

// Helper to format date into iCal format: YYYYMMDDTHHMMSSZ
const formatICalDate = (date: Date) => {
	return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

export const GET: RequestHandler = async () => {
	// 1. Fetch your dynamic events from your database
	const events = [
		{
			id: 'event-1',
			title: 'SvelteKit Live Stream',
			description: 'Learning how to build web applications.',
			start: new Date('2026-11-20T15:00:00Z'),
			end: new Date('2026-11-20T16:00:00Z'),
		},
		{
			id: 'event-2',
			title: 'Community Q&A',
			description: 'Answering all your framework questions.',
			start: new Date('2026-11-27T18:00:00Z'),
			end: new Date('2026-11-27T19:00:00Z'),
		}
	];

	// 2. Build the iCalendar array
	const icalLines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//YourBrand//SvelteKit Calendar//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'X-WR-CALNAME:My Subscribable Events',
		'X-WR-TIMEZONE:UTC',
	];

	for (const event of events) {
		icalLines.push(
			'BEGIN:VEVENT',
			`UID:${event.id}@yourdomain.com`,
			`DTSTAMP:${formatICalDate(new Date())}`,
			`DTSTART:${formatICalDate(event.start)}`,
			`DTEND:${formatICalDate(event.end)}`,
			`SUMMARY:${event.title}`,
			`DESCRIPTION:${event.description}`,
			'END:VEVENT'
		);
	}

	icalLines.push('END:VCALENDAR');

	// 3. Join everything cleanly using CRLF (\(\r\\)n)
const icalString = icalLines.join('\r\n');
	// 4. Return response with correct content-type headers
	return new Response(icalString, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'inline; filename="calendar.ics"',
			'Cache-Control': 'public, max-age=3600' 
		}
	});
};
