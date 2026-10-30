import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { listFor, unreadCount, markRead, markAllRead, remove, removeAll, removeAllRead } from '$lib/server/notifications';

// The bell in the header talks to this. Everything is about the signed-in user's own notifications.
// (API routes don't go through the (private) layout, so the sign-in is checked here.)

function userId(locals: App.Locals): string {
	if (!locals.user) throw error(401, 'Please sign in.');
	return locals.user.id;
}

/** ?count=1 returns just the unread number (cheap enough to poll); otherwise the list too. */
export async function GET({ locals, url }) {
	const id = userId(locals);
	if (url.searchParams.has('count')) return json({ unread: await unreadCount(id) });
	return json(await listFor(id));
}

const bodySchema = z.object({
	action: z.enum(['read', 'unread', 'delete', 'readAll', 'deleteRead', 'deleteAll']),
	id: z.string().min(1).optional()
});

export async function POST({ locals, request }) {
	const id = userId(locals);
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'Invalid request.');
	const { action, id: notificationId } = parsed.data;

	if (action === 'readAll') await markAllRead(id);
	else if (action === 'deleteRead') await removeAllRead(id);
	else if (action === 'deleteAll') await removeAll(id);
	else {
		if (!notificationId) throw error(400, 'Missing id.');
		const ok = action === 'delete' ? await remove(id, notificationId) : await markRead(id, notificationId, action === 'read');
		if (!ok) throw error(404, 'Notification not found.');
	}
	return json({ unread: await unreadCount(id) });
}