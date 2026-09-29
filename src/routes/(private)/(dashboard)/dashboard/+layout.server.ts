import type { LayoutServerLoad } from '../../$types';
import { requireRole } from '$lib/../auth'; // - craig needs an absolute

export const load: LayoutServerLoad = async ({ locals, url }) => {
    const user = requireRole(locals, url, ['Administrator']);
}
