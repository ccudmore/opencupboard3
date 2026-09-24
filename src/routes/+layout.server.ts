import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
console.log('CRAIG10');
console.log(locals.user)
	return {
		user: locals.user
//		session: await locals.auth()
	};
};
