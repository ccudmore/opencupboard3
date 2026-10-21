import type { LayoutServerLoad } from '../../$types';
import { requirePermission } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals, url }) => {
    const user = requirePermission(locals, url, ['manage-donors']);
}
