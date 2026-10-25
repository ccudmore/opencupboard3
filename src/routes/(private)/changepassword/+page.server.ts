import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import prisma from '$lib/prisma';
import { changePasswordSchema } from '$lib/formschemas/password';

// Anyone who is signed in may change their own password (the (private) layout requires a sign-in).

/** People who only sign in with Google or Microsoft have no password to change. */
async function hasPassword(userId: string) {
	return (await prisma.account.count({ where: { userId, providerId: 'credential' } })) > 0;
}

export const load: PageServerLoad = async ({ locals }) => {
	return {
		form: await superValidate(zod4(changePasswordSchema)),
		hasPassword: await hasPassword(locals.user?.id ?? ''),
		email: locals.user?.email ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Please sign in again.' });

		const form = await superValidate(request, zod4(changePasswordSchema));
		// Never send passwords back to the browser, whatever happens next
		const clearPasswords = () => {
			form.data.currentPassword = '';
			form.data.newPassword = '';
			form.data.confirmPassword = '';
		};
		if (!form.valid) {
			clearPasswords();
			return fail(400, { form });
		}

		if (!(await hasPassword(locals.user.id))) {
			clearPasswords();
			return message(form, 'Your account signs in with Google or Microsoft, so it has no password to change.', { status: 400 });
		}

		try {
			await auth.api.changePassword({
				body: {
					currentPassword: form.data.currentPassword,
					newPassword: form.data.newPassword,
					revokeOtherSessions: true // anyone else signed in with the old password is signed out
				},
				headers: request.headers
			});
		} catch (err) {
			clearPasswords();
			if (err instanceof APIError && err.body?.code === 'INVALID_PASSWORD') {
				return setError(form, 'currentPassword', 'That is not your current password');
			}
			console.error('Changing password failed:', err);
			return message(form, 'Could not change the password. Please try again.', { status: 500 });
		}

		clearPasswords();
		return message(form, 'Your password has been changed. Your other sessions were signed out.');
	}
};
