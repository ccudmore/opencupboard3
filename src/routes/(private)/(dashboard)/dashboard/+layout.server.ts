//    import { error, redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from '../../$types';
import { requireRole } from '../../../../auth'; // - craig needs an absolute

export const load: LayoutServerLoad = async ({ locals, url }) => {
    console.log('craig - in dashboard layout check')
    const user = requireRole(locals, url, ['Admin', 'User']);
    console.log('CRAIG3 - in (private)/(dashboard)/dashboard/layout.server.ts')
    console.log(user)
}
