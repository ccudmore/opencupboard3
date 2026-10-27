import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { verifyPassword } from 'better-auth/crypto';
import prisma from '$lib/prisma';
import { emailSchema, iconSchema } from '$lib/formschemas/usersettings';
import { avatarFor, avatarValue } from '$lib/avatars';

// Anyone who is signed in can change their own email address and icon (the (private) layout requires a sign-in).

async function credential(userId: string) {
	return prisma.account.findFirst({ where: { userId, providerId: 'credential' }, select: { password: true } });
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	return {
		emailForm: await superValidate({ email: user.email, password: '' }, zod4(emailSchema), { id: 'email' }),
		iconForm: await superValidate({ icon: avatarFor(user.image)?.key ?? '' }, zod4(iconSchema), { id: 'icon' }),
		// People who sign in with Google or Microsoft keep their email with that provider
		hasPassword: !!(await credential(user.id))?.password
	};
};

export const actions: Actions = {
	email: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const form = await superValidate(request, zod4(emailSchema), { id: 'email' });
		form.data.password = '';
		if (!form.valid) return fail(400, { form });

		const account = await credential(locals.user.id);
		if (!account?.password) {
			return message(form, 'Your email is managed by your Google or Microsoft account.', { status: 400 });
		}
		// Re-check the password so a borrowed, signed-in browser cannot take over the account
		const submitted = (await request.clone().formData()).get('password');
		const ok = typeof submitted === 'string' && (await verifyPassword({ hash: account.password, password: submitted }));
		if (!ok) return setError(form, 'password', 'That password is not correct');

		const email = form.data.email;
		if (email === locals.user.email.toLowerCase()) return message(form, 'That is already your email address.');

		const taken = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, NOT: { id: locals.user.id } }, select: { id: true } });
		if (taken) return setError(form, 'email', 'That email address is already in use');

		await prisma.user.update({ where: { id: locals.user.id }, data: { email } });
		return message(form, 'Your email address has been updated. Use it the next time you sign in.');
	},

	icon: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const form = await superValidate(request, zod4(iconSchema), { id: 'icon' });
		if (!form.valid) return fail(400, { form });
		await prisma.user.update({ where: { id: locals.user.id }, data: { image: avatarValue(form.data.icon) } });
		return message(form, 'Your icon has been updated.');
	}
};
