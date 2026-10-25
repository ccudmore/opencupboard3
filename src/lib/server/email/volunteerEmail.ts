import { z } from 'zod';
import prisma from '$lib/prisma';
import type { Prisma } from '$prisma/client';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { isMailConfigured, sendMail } from './mailer';
import { renderTemplate, type TemplateVars } from './templates';
import type { EmailKind, Recipient } from './bookingEmail';

export const assignmentEmailInclude = {
	volunteer: true,
	event: { include: { location: true } }
} satisfies Prisma.VolunteerAssignmentsInclude;

type EmailAssignment = Prisma.VolunteerAssignmentsGetPayload<{ include: typeof assignmentEmailInclude }>;

const KINDS: Record<EmailKind, { template: string; column: 'confirmations' | 'reminders' | 'cancellations' }> = {
	confirmation: { template: 'volunteer-confirmation', column: 'confirmations' },
	reminder: { template: 'volunteer-reminder', column: 'reminders' },
	cancellation: { template: 'volunteer-cancellation', column: 'cancellations' }
};

const MAX_SUBJECT = 200;
const MAX_BODY = 10_000;

/** The volunteer's email addresses that look valid (their first and second email). */
export function recipientsFor(a: EmailAssignment): Recipient[] {
	const name = `${a.volunteer.firstName} ${a.volunteer.lastName}`.trim();
	const seen = new Set<string>();
	const out: Recipient[] = [];
	for (const raw of [a.volunteer.email1, a.volunteer.email2]) {
		const email = (raw ?? '').trim();
		if (!z.email().safeParse(email).success || seen.has(email.toLowerCase())) continue;
		seen.add(email.toLowerCase());
		out.push({ name, email });
	}
	return out;
}

/**
 * The values available to {{placeholders}} in the volunteer templates:
 *   firstName, lastName, name, role, roleText (" as Supervisor" or ""), eventTitle, eventType,
 *   date, time, endTime, location, locationName, address, note, noteSection, organization
 */
export function buildVars(a: EmailAssignment, options: { organization: string; timeZone: string }): TemplateVars {
	const dateFormat = new Intl.DateTimeFormat('en-CA', { dateStyle: 'full', timeZone: options.timeZone });
	const timeFormat = new Intl.DateTimeFormat('en-CA', { timeStyle: 'short', timeZone: options.timeZone });
	const loc = a.event.location;
	const address = [loc.street, loc.city].filter(Boolean).join(', ');
	const note = a.event.note?.trim() ?? '';

	return {
		firstName: a.volunteer.firstName.trim(),
		lastName: a.volunteer.lastName.trim(),
		name: `${a.volunteer.firstName} ${a.volunteer.lastName}`.trim(),
		role: a.eventRole,
		roleText: a.eventRole ? ` as ${a.eventRole}` : '',
		eventTitle: a.event.title?.trim() || a.event.type,
		eventType: a.event.type,
		date: dateFormat.format(a.event.startTime),
		time: timeFormat.format(a.event.startTime),
		endTime: timeFormat.format(a.event.endTime),
		location: [loc.name, address].filter(Boolean).join(', '),
		locationName: loc.name,
		address,
		note,
		noteSection: note ? `Note: ${note}\n` : '',
		organization: options.organization
	};
}

function settings() {
	return {
		organization: publicEnv.PUBLIC_ORGANIZATION_NAME || 'Open Cupboard',
		timeZone: privateEnv.TIMEZONE || 'America/Toronto'
	};
}

export type DraftResult =
	| { ok: true; draft: { to: Recipient[]; subject: string; body: string } }
	| { ok: false; status: number; message: string };

/** Builds the message from its template. Nothing is sent. */
export async function buildAssignmentEmail(volunteerId: string, assignmentId: string, kind: EmailKind): Promise<DraftResult> {
	const assignment = await prisma.volunteerAssignments.findFirst({
		where: { id: assignmentId, volunteerId },
		include: assignmentEmailInclude
	});
	if (!assignment) return { ok: false, status: 404, message: 'Assignment not found.' };

	const to = recipientsFor(assignment);
	if (to.length === 0) return { ok: false, status: 400, message: 'This volunteer has no email address.' };

	const { subject, body } = await renderTemplate(KINDS[kind].template, buildVars(assignment, settings()));
	return { ok: true, draft: { to, subject, body } };
}

export type SendResult = { ok: true; to: Recipient[] } | { ok: false; status: number; message: string };

/**
 * Sends the message to the volunteer. The addresses always come from the database.
 * If `subject` and `body` are given (the user edited the text) they replace the template text.
 */
export async function sendAssignmentEmail(args: {
	kind: EmailKind;
	volunteerId: string;
	assignmentId: string;
	userId?: string;
	subject?: string;
	body?: string;
}): Promise<SendResult> {
	if (!isMailConfigured()) return { ok: false, status: 503, message: 'Email is not set up on this server.' };

	const built = await buildAssignmentEmail(args.volunteerId, args.assignmentId, args.kind);
	if (!built.ok) return built;

	const subject = (args.subject?.trim() || built.draft.subject).replace(/[\r\n]+/g, ' ').slice(0, MAX_SUBJECT);
	const body = (args.body?.trim() ? args.body : built.draft.body).slice(0, MAX_BODY);
	const emails = built.draft.to.map((r) => r.email);

	try {
		await sendMail({ to: emails, subject, text: body });
	} catch (err) {
		console.error(`Sending ${args.kind} email failed:`, err);
		return { ok: false, status: 502, message: 'The email could not be sent. Please try again later.' };
	}

	// Remember when it was sent (shown in the volunteer's assignment list)
	const column = KINDS[args.kind].column;
	const existing = await prisma.volunteerAssignments.findUnique({
		where: { id: args.assignmentId },
		select: { confirmations: true, reminders: true, cancellations: true }
	});
	const current = existing?.[column];
	const history = Array.isArray(current) ? current : [];
	await prisma.volunteerAssignments.update({
		where: { id: args.assignmentId },
		data: {
			[column]: [...history, { sentAt: new Date().toISOString(), to: emails, sentBy: args.userId ?? null }] as Prisma.InputJsonValue
		}
	});

	return { ok: true, to: built.draft.to };
}
