import type { Handle } from '@sveltejs/kit';

import { auth } from "./auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'
import { redirect, error } from '@sveltejs/kit';
import prisma from "$lib/prisma"
import { sequence } from '@sveltejs/kit/hooks';

function haveCommonElement(arr1: string[], arr2: string[]): boolean {
  const set2 = new Set(arr2);
  return arr1.some(element => set2.has(element));
}

async function handleAuthentication({event, resolve} : {event:any, resolve:any}) {
    const authSession = await auth.api.getSession({ headers: event.request.headers });
    if (authSession) {
        const roleRows = await prisma.userRole.findMany({
            where: { userId: authSession.user.id },
            select: { role: { select: { name: true, id: true } } }
        });
        event.locals.user = {
            id: authSession.user.id,
            name: authSession.user.name,
            email: authSession.user.email,
            roles: roleRows.map((r) => r.role.name),
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
    const publicRoutes = ['/login'] 

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
    } else {
        console.log('page doesnt need authentication or its login - let it pass')
    }

    return resolve(event)
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleAuthentication, authorizationHandle, handleBetterAuth);