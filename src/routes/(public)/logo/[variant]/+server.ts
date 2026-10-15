import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import type { RequestHandler } from './$types';

const TYPES: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml'
};

export const GET: RequestHandler = async ({ params }) => {
	if (params.variant !== 'light' && params.variant !== 'dark') error(404, 'Not found');
	const dark = params.variant === 'dark';

	// Dark uses LOGO_DARK_PATH if set, otherwise the normal logo
	const path = (dark ? env.LOGO_DARK_PATH : undefined) || env.LOGO_PATH;
	if (!path) redirect(302, dark ? '/images/default-logo-dark.svg' : '/images/default-logo.svg');

	try {
		const [data, info] = await Promise.all([readFile(path), stat(path)]);
		return new Response(data, {
			headers: {
				'Content-Type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
				'Cache-Control': 'public, max-age=300',
				'Last-Modified': info.mtime.toUTCString(),
				'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
			}
		});
	} catch {
		error(404, 'Logo not found');
	}
};