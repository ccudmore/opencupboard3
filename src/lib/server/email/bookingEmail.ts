import { z } from 'zod';
import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';
import { ClientRelationship } from '$prisma/enums';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { isMailConfigured, sendMail } from './mailer';
import { renderTemplate, type TemplateVars } from './templates';

export const emailBookingInclude = {
	household: { include: { members: true } },
	appointment: { include: { event: { include: { location: true } } } },
	datedRequest: true
} satisfies Prisma.AppointmentBookingsInclude;

type EmailBooking = Prisma.AppointmentBookingsGetPayload<{ include: typeof emailBookingInclude }>;

export type Recipient = { name: string; email: string };

const MAX_SUBJECT = 200;
const MAX_BODY = 10_000;

function joinNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? '';
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function fullName(m: { firstName: string; lastName: string }): string {
	return `${m.firstName} ${m.lastName}`.trim();
}

/** Primary members of the household who have a usable email address. */
export function recipientsFor(booking: EmailBooking): Recipient[] {
	return booking.household.members
		.filter((m) => m.relationship === ClientRelationship.PRIMARY)
		.map((m) => ({ name: fullName(m), email: (m.email ?? '').trim() }))
		.filter((r) => z.email().safeParse(r.email).success);
}

/**
 * The values available to {{placeholders}} in a template.
 *   primaryNames, firstNames, date, time, endTime, serviceTitle, location,
 *   locationName, address, specialRequest, specialRequestSection,
 *   householdId, organization
 */
export function buildVars(booking: EmailBooking, options: { organization: string; timeZone: string }): TemplateVars {
	const primaries = booking.household.members.filter((m) => m.relationship === ClientRelationship.PRIMARY);
	const appt = booking.appointment;
	const loc = appt?.event.location;

	const dateFormat = new Intl.DateTimeFormat('en-CA', { dateStyle: 'full', timeZone: options.timeZone });
	const timeFormat = new Intl.DateTimeFormat('en-CA', { timeStyle: 'short', timeZone: options.timeZone });

	const address = [loc?.street, loc?.city].filter(Boolean).join(', ');
	const request = booking.datedRequest?.requestText?.trim() ?? '';

	return {
		primaryNames: joinNames(primaries.map(fullName)),
		firstNames: joinNames(primaries.map((m) => m.firstName.trim())),
		date: appt ? dateFormat.format(appt.startTime) : '',
		time: appt ? timeFormat.format(appt.startTime) : '',
		endTime: appt ? timeFormat.format(appt.endTime) : '',
		serviceTitle: appt?.event.title ?? '',
		location: [loc?.name, address].filter(Boolean).join(', '),
		locationName: loc?.name ?? '',
		address,
		specialRequest: request,
		specialRequestSection: request ? `Special request noted: ${request}\n` : '',
		householdId: booking.household.uniqueId ?? '',
		organization: options.organization
	};
}

function settings() {
	return {
		organization: publicEnv.PUBLIC_ORGANIZATION_NAME || 'Open Cupboard',
		timeZone: privateEnv.TIMEZONE || 'America/Toronto'
	};
}

async function loadBooking(householdId: string, bookingId: string) {
	return prisma.appointmentBookings.findFirst({
		where: { id: bookingId, householdId },
		include: emailBookingInclude
	});
}

export type EmailDraft = { to: Recipient[]; subject: string; body: string };
export type DraftResult = { ok: true; draft: EmailDraft } | { ok: false; status: number; message: string };

/** Builds the confirmation message from the template. Nothing is sent. */
export async function buildConfirmationEmail(householdId: string, bookingId: string): Promise<DraftResult> {
	const booking = await loadBooking(householdId, bookingId);
	if (!booking) return { ok: false, status: 404, message: 'Booking not found.' };

	const to = recipientsFor(booking);
	if (to.length === 0) {
		return { ok: false, status: 400, message: 'No primary member of this household has an email address.' };
	}

	const template = booking.appointment ? 'booking-confirmation' : 'booking-confirmation-unscheduled';
	const { subject, body } = await renderTemplate(template, buildVars(booking, settings()));
	return { ok: true, draft: { to, subject, body } };
}

export type SendResult = { ok: true; to: Recipient[] } | { ok: false; status: number; message: string };

/**
 * Sends the confirmation to every primary member with an email address.
 * Recipients always come from the database. If `subject` and `body` are given
 * (the user edited the text) they replace the template text.
 */
export async function sendConfirmationEmail(args: {
	householdId: string;
	bookingId: string;
	userId?: string;
	subject?: string;
	body?: string;
}): Promise<SendResult> {
	if (!isMailConfigured()) return { ok: false, status: 503, message: 'Email is not set up on this server.' };

	const built = await buildConfirmationEmail(args.householdId, args.bookingId);
	if (!built.ok) return built;

	const subject = (args.subject?.trim() || built.draft.subject).replace(/[\r\n]+/g, ' ').slice(0, MAX_SUBJECT);
	const body = (args.body?.trim() ? args.body : built.draft.body).slice(0, MAX_BODY);
	const emails = built.draft.to.map((r) => r.email);

	try {
		await sendMail({ to: emails, subject, text: body });
	} catch (err) {
		console.error('Sending confirmation email failed:', err);
		return { ok: false, status: 502, message: 'The email could not be sent. Please try again later.' };
	}

	// Remember that it was sent (shown in the bookings list)
	const existing = await prisma.appointmentBookings.findUnique({
		where: { id: args.bookingId },
		select: { confirmations: true }
	});
	const history = Array.isArray(existing?.confirmations) ? existing.confirmations : [];
	await prisma.appointmentBookings.update({
		where: { id: args.bookingId },
		data: {
			confirmations: [
				...history,
				{ sentAt: new Date().toISOString(), to: emails, sentBy: args.userId ?? null }
			] as Prisma.InputJsonValue
		}
	});

	return { ok: true, to: built.draft.to };
}
