import prisma from '$lib/prisma';
import { UserStatus } from '$prisma/enums';

/**
 * Notifications: short messages for one person, shown under the bell in the header.
 *
 * Anything on the server can send one:
 *
 *   await notify(userId, { subject: 'Your shift was approved', body: 'Saturday at 9:00...', link: '/volunteer' });
 *   await notifyPermission('manage-volunteers', { subject: 'Sam signed up', link: '/volunteers/shifts' });
 *   await notifyVolunteer(volunteerId, { subject: '...' });   // the login linked to that volunteer, if any
 *
 * `link` is a path on this site (for example /households/abc or /volunteers/shifts); the person
 * gets a button that takes them straight there. Sending never throws: a failed notification
 * must not break the thing that caused it, so problems are logged and the count returned is 0.
 */

export const MAX_SUBJECT = 200;
export const MAX_BODY = 2000;
export const MAX_LINK = 500;

export type NotificationInput = {
	subject: string;
	/** more detail, shown when the person opens the notification */
	body?: string | null;
	/** a path on this site such as /volunteers/shifts. Anything else is dropped. */
	link?: string | null;
	/** who or what caused it (a user id or a service name), for your own records */
	createdBy?: string | null;
};

/** Only paths on this site: starts with one "/" (not "//") and has no scheme or backslash. */
export function safeLink(link: string | null | undefined): string | null {
	const l = (link ?? '').trim();
	if (!l || l.length > MAX_LINK) return null;
	if (!l.startsWith('/') || l.startsWith('//') || l.includes('\\')) return null;
	return l;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Sends a notification to one user or several. Inactive users are skipped. Returns how many were sent. */
export async function notify(target: string | string[], input: NotificationInput): Promise<number> {
	try {
		const subject = clip(input.subject.trim(), MAX_SUBJECT);
		if (!subject) return 0;
		const ids = [...new Set((Array.isArray(target) ? target : [target]).filter(Boolean))];
		if (ids.length === 0) return 0;

		const users = await prisma.user.findMany({ where: { id: { in: ids }, status: UserStatus.ACTIVE }, select: { id: true } });
		if (users.length === 0) return 0;

		const body = input.body?.trim() ? clip(input.body.trim(), MAX_BODY) : null;
		const link = safeLink(input.link);
		await prisma.notification.createMany({
			data: users.map((u) => ({ userId: u.id, subject, body, link, createdBy: input.createdBy ?? null }))
		});
		return users.length;
	} catch (err) {
		console.error('Could not send a notification:', err);
		return 0;
	}
}

/** Sends a notification to every active user who has any of these permissions (through an active role). */
export async function notifyPermission(
	permissions: string | string[],
	input: NotificationInput,
	options: { exceptUserId?: string } = {}
): Promise<number> {
	try {
		const ids = Array.isArray(permissions) ? permissions : [permissions];
		const users = await prisma.user.findMany({
			where: {
				status: UserStatus.ACTIVE,
				...(options.exceptUserId ? { id: { not: options.exceptUserId } } : {}),
				roles: { some: { role: { status: 'ACTIVE', permissions: { some: { permissionId: { in: ids } } } } } }
			},
			select: { id: true }
		});
		return notify(users.map((u) => u.id), input);
	} catch (err) {
		console.error('Could not send notifications:', err);
		return 0;
	}
}

/** Sends a notification to the login linked to a volunteer. Nothing happens if they have no login. */
export async function notifyVolunteer(volunteerId: string, input: NotificationInput): Promise<number> {
	try {
		const v = await prisma.volunteer.findUnique({ where: { id: volunteerId }, select: { userId: true } });
		return v?.userId ? notify(v.userId, input) : 0;
	} catch (err) {
		console.error('Could not send a notification:', err);
		return 0;
	}
}

// ---------------------------------------------------------------- what the bell uses

const listSelect = { id: true, subject: true, body: true, link: true, readAt: true, createdAt: true } as const;

export async function unreadCount(userId: string) {
	return prisma.notification.count({ where: { userId, readAt: null } });
}

/** The newest notifications first (read and unread), plus how many are unread in all. */
export async function listFor(userId: string, limit = 50) {
	const [items, unread] = await Promise.all([
		prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit, select: listSelect }),
		unreadCount(userId)
	]);
	return { items, unread };
}

/** Every change is limited to the person's own notifications. */
export async function markRead(userId: string, id: string, read: boolean) {
	const { count } = await prisma.notification.updateMany({ where: { id, userId }, data: { readAt: read ? new Date() : null } });
	return count > 0;
}

export async function markAllRead(userId: string) {
	await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

export async function remove(userId: string, id: string) {
	const { count } = await prisma.notification.deleteMany({ where: { id, userId } });
	return count > 0;
}

export async function removeAllRead(userId: string) {
	await prisma.notification.deleteMany({ where: { userId, readAt: { not: null } } });
}
