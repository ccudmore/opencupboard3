// Service dates are scheduled in the organization's time zone (the TIMEZONE setting), whatever the
// time zone of the server or the browser is. These turn "2026-11-05" + "10:30" into a moment and back.

export function tzOffsetMinutes(at: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(at);
	const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
	return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** The date and time ("YYYY-MM-DD", "HH:MM") on the wall clock in that zone. */
export function zonedParts(at: Date, timeZone: string): { date: string; time: string } {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	}).formatToParts(at);
	const v = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
	return { date: `${v('year')}-${v('month')}-${v('day')}`, time: `${v('hour')}:${v('minute')}` };
}

/** The moment that wall-clock date and time happen in that zone, or null if they aren't real. */
export function zonedToDate(date: string, time: string, timeZone: string): Date | null {
	const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	const t = /^(\d{2}):(\d{2})$/.exec(time);
	if (!d || !t) return null;
	const naive = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
	let guess = naive - tzOffsetMinutes(new Date(naive), timeZone) * 60000;
	guess = naive - tzOffsetMinutes(new Date(guess), timeZone) * 60000;
	const result = new Date(guess);
	if (Number.isNaN(result.getTime())) return null;
	// Reject things like February 31st, which roll over into another day
	const back = zonedParts(result, timeZone);
	return back.date === date && back.time === time ? result : null;
}

/** "10:30" plus minutes, as minutes since midnight. */
export const clockToMinutes = (time: string): number => {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
};
