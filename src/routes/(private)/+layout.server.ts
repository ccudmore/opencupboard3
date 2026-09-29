import type { LayoutServerLoad } from '../$types';
import { error, redirect } from '@sveltejs/kit';

// all pages under (private) must have a logged in user
export const load: LayoutServerLoad = async ({ locals, url }) => {
    const user = locals.user
    // Not logged in at all — send to login, remember where they were headed
    if (!user) {
        console.log('redirect to '+url.pathname)
        throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
    }
}
