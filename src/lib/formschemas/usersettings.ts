import { z } from 'zod';
import { AVATAR_KEYS } from '$lib/avatars';

export const emailSchema = z.object({
	email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
	password: z.string().min(1, 'Enter your password to confirm')
});

export const iconSchema = z.object({
	icon: z.string().refine((k) => AVATAR_KEYS.includes(k), 'Choose one of the icons')
});