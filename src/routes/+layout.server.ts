// This is a dummy file for now - may use it later
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    const user = locals.user
	return {
		user: locals.user
	};
};
