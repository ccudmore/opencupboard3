import type { RequestHandler } from './$types';

// Liveness check for the Docker HEALTHCHECK.
// Deliberately does not touch the database or require a login.
export const GET: RequestHandler = () => {
	return new Response('ok', {
		status: 200,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-store'
		}
	});
};