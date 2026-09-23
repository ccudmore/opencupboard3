import type { Handle } from '@sveltejs/kit';

import { auth } from "./auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'
import { redirect, error } from '@sveltejs/kit';


//export async function handle({ event, resolve }) {
    export const handle: Handle = async ({ event, resolve }) => {
        console.log("craig1")
        const authSession = await auth.api.getSession({ headers: event.request.headers });
        console.log("craig2")
        if (authSession) {
        console.log("craig3")
            // check in the database for the user and get their roles based on authSession.user.id
            event.locals.user = {
                id: authSession.user.id,
                name: authSession.user.name,
                email: authSession.user.email,
                roles: ['admin', 'user'],  
//                roles: roleRows.map((r) => r.role.name)
                };
            event.locals.session = {
                id: authSession.session.id,
                expiresAt: authSession.session.expiresAt
            };
            event.locals.permissions = ['read', 'write', 'delete']; // Example permissions, replace with actual permissions from your database
            console.log("craig4")
            console.log(event.locals)
        } else {
            event.locals.user = null;
            event.locals.session = null;
            event.locals.permissions = null;
        }

        // now check permissions and if not logged in or not authorized
        //const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
        //throw redirect(303, `/login?redirectTo=${redirectTo}`);
        //throw error(403, `This page requires the "${rule.permission}" permission`);

    return svelteKitHandler({ event, resolve, auth, building });
}
