import type { LayoutServerLoad } from '../../$types';
import { requirePermission } from '$lib/utils';

export const load: LayoutServerLoad = async ({ locals, url }) => {
    requirePermission(locals?.user?.permissions, url, ['manage-inventory']);
}
