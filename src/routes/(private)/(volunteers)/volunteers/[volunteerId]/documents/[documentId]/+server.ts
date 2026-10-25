import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';
import { requirePermission } from '$lib/utils';
import { isInline } from '$lib/server/documentTypes';

/** Opens (or with ?download=1 downloads) a volunteer's document. Only for manage-volunteers. */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	requirePermission(locals?.user?.permissions, url, ['manage-volunteers']);

	// Look it up by both ids, so a document can't be fetched through another volunteer's URL
	const doc = await prisma.volunteerDocument.findFirst({
		where: { id: params.documentId, volunteerId: params.volunteerId }
	});
	if (!doc) throw error(404, 'Document not found');

	const showInBrowser = isInline(doc.contentType) && url.searchParams.get('download') !== '1';
	const asciiName = doc.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\;]/g, '_');
	const disposition = `${showInBrowser ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`;

	return new Response(new Uint8Array(doc.content), {
		headers: {
			'Content-Type': doc.contentType,
			'Content-Length': String(doc.content.byteLength),
			'Content-Disposition': disposition,
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'private, no-store',
			// Set here so the app-wide policy (which blocks <object>) doesn't get in the way of the
			// browser's own PDF viewer. Nothing else is allowed to run or load from these files.
			'Content-Security-Policy':
				doc.contentType === 'application/pdf'
					? "frame-ancestors 'none'"
					: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'"
		}
	});
};
