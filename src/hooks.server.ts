import type { Handle } from '@sveltejs/kit';

import { auth } from "./auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'
import { redirect, error } from '@sveltejs/kit';
import prisma from "$lib/prisma"
import { sequence } from '@sveltejs/kit/hooks';

async function authorizationHandle({event, resolve} : {event:any, resolve:any}) {
         const authSession = await auth.api.getSession({ headers: event.request.headers });
        if (authSession) {
            const roleRows = await prisma.userRole.findMany({
                        where: { userId: authSession.user.id },
                        select: { role: { select: { name: true, permissions: {select: { permission: {select: {name: true, protectedRoutes: true, action: true}}}} } } }
            });
        
//            console.log('CRAIG5')
//            console.log(roleRows)
//            console.log(roleRows[0].role.permissions[0])

            const uniqueProtectedRoutes: string[] = [
  ...new Set(
    roleRows.flatMap(({ role }) =>
      role.permissions.flatMap((p) => p.permission.protectedRoutes)
    )
  ),
];
console.log('CRAIG6')
console.log(uniqueProtectedRoutes)
console.log(event.url.pathname)
        /*
        interface PermissionObj {
            id: number;
            name: string;
        }
        const uniquePermissions: PermissionObj[] = [
  ...new Map(
    roleRows
      .flatMap(({ role }) => role.permissions)
      .map((p) => [p.name, p] as const)
  ).values(),

];
console.log(uniquePermissions)
*/

            // check in the database for the user and get their roles based on authSession.user.id
            const rolesList = roleRows.map((r) => r.role.name)
            event.locals.user = {
                id: authSession.user.id,
                name: authSession.user.name,
                email: authSession.user.email,
                roles: rolesList,
                permissions: [{name: 'abc', path: '/route', action: 'read'}]
            };
            event.locals.session = {
                id: authSession.session.id,
                expiresAt: authSession.session.expiresAt
            };
//            console.log("craig4")
//            console.log(event.locals)
        } else {
            event.locals.user = null;
            event.locals.session = null;
        }

        // now check permissions and if not logged in or not authorized
        //const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
        //throw redirect(303, `/login?redirectTo=${redirectTo}`);
        //throw error(403, `This page requires the "${rule.permission}" permission`);

    return svelteKitHandler({ event, resolve, auth, building });
}

export const handle: Handle = sequence(authorizationHandle);