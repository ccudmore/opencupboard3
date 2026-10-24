import type { Handle } from '@sveltejs/kit';

import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'
import prisma from "$lib/prisma"
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';

type RolePermission = { permissionId: string };
type RoleEntry = { role: { permissions: RolePermission[] } };

function uniquePermissionIds(data: RoleEntry[]): string[] {
  return [...new Set(data.flatMap((d) => d.role.permissions.map((p) => p.permissionId)))];
}

const CSP_HEADER = env.CSP_ENFORCE === 'true'
	? 'Content-Security-Policy'
	: 'Content-Security-Policy-Report-Only';

async function handleAuthentication({ event, resolve }: Parameters<Handle>[0]) {
    // don't touch the database for public content
	const path = event.url.pathname;
	if (path === '/healthz' || path.startsWith('/logo/')) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

    const authSession = await auth.api.getSession({ headers: event.request.headers });
    if (authSession) {
        const roleRows = await prisma.userRole.findMany({
            where: { userId: authSession.user.id },
            select: { role: { select: { name: true, id: true, permissions: true } } }
        });
        event.locals.user = {
            id: authSession.user.id,
            name: authSession.user.name,
            email: authSession.user.email,
            image: authSession.user.image??'',
            roles: roleRows.map((r) => r.role.name),
            permissions: uniquePermissionIds(roleRows),
        };
        event.locals.session = {
            id: authSession.session.id,
            expiresAt: authSession.session.expiresAt
        };
    } else {
        event.locals.user = null;
        event.locals.session = null;
    }
    return resolve(event)
}
// Start with report-only; see "Rolling out the CSP" below.
const CSP = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline'",
	"worker-src 'self' blob:",
	"style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.googleusercontent.com",
	"connect-src 'self' https://nominatim.openstreetmap.org https://api.maptiler.com",
	"font-src 'self' data:",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'"
].join('; ');

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	try {
		const h = response.headers;
		h.set('X-Content-Type-Options', 'nosniff');
		h.set('X-Frame-Options', 'DENY');
		h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
		h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

		// Don't override a stricter CSP a route sets itself (the /logo route does).
		if (!h.has('Content-Security-Policy')) {
			h.set('Content-Security-Policy-Report-Only', CSP);
        	h.set(CSP_HEADER, CSP);
		}

		// Only meaningful over HTTPS. nginx terminates TLS, so key off the public URL.
		if (env.BETTER_AUTH_URL?.startsWith('https://')) {
			h.set('Strict-Transport-Security', 'max-age=31536000');
		}
	} catch {
		// Some responses (for example ones passed through from fetch) have immutable headers.
	}

	return response;
};

// Authorization is now done in the +layout.server.ts at the route group level
/*
async function authorizationHandle({event, resolve} : {event:any, resolve:any}) {
    // Get the list of the names of all roles that have a permission to allow access to this path
    const rolesThatContainPathPermissions = (await prisma.permission.findMany({
        where: {
            protectedRoutes: {
                has: String(event.url.pathname).toLocaleLowerCase(),
            },
        },
        select: {
            roles: {
                select: { role: { select: { name: true,  } } }
            }
        }
    })).flatMap((item) => item.roles.map((role) => role.role.name));

    // static list of routes that will never need authentication
    const publicRoutes = ['/login', '/register', '/public' ] 

    // If the path has at least one role requirement & its not on the static public link, check if the user can access it
    if (rolesThatContainPathPermissions.length > 0 && ! publicRoutes.includes(event.url.pathname)) {
        if (event.locals.user == null) {
            // if the user isn't autenticated, redirect to authentication
            const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
            throw redirect(303, `/login?redirectTo=${redirectTo}`);
        } else {
            // if the user is authenticated, see if they have one of the roles that the path could use
            if (!haveCommonElement(rolesThatContainPathPermissions, event.locals.user.roles)) {        
                throw error(403, `This page requires one of "${rolesThatContainPathPermissions.join(",")}" permission`);
            }
        }
    }

    return resolve(event)
}
*/

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

//export const handle: Handle = sequence(handleAuthentication, handleBetterAuth);
export const handle: Handle = sequence(handleSecurityHeaders, handleAuthentication, handleBetterAuth);
