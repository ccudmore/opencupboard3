import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasPermission, requirePermission } from '$lib/utils';
import { isInline } from '$lib/server/documentTypes';
import { receiptFor } from '$lib/server/expenses';

/** Opens (or with ?download=1 downloads) a receipt. Only for who submitted the expense and expense managers. */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const permissions = locals?.user?.permissions;
	requirePermission(permissions, url, ['submit-expenses', 'manage-expenses']);
	if (!locals.user) throw error(401, 'Please sign in');

	const receipt = await receiptFor(params.receiptId, locals.user.id, !!hasPermission(permissions, ["manage-expenses"]));
	if (!receipt) throw error(404, 'Receipt not found');

	const showInBrowser = isInline(receipt.contentType) && url.searchParams.get('download') !== '1';
	const asciiName = receipt.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\;]/g, '_');
	const disposition = `${showInBrowser ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(receipt.name)}`;

	return new Response(new Uint8Array(receipt.content), {
		headers: {
			'Content-Type': receipt.contentType,
			'Content-Length': String(receipt.content.byteLength),
			'Content-Disposition': disposition,
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'private, no-store',
			'Content-Security-Policy':
				receipt.contentType === 'application/pdf'
					? "frame-ancestors 'none'"
					: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'"
		}
	});
};
