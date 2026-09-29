import type { LayoutServerLoad } from '../../$types';
import { requireRole } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals, url }) => {
    const user = requireRole(locals, url, ['Administrator', 'Volunteer Manager']);
}
