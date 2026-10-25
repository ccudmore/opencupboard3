import { z } from 'zod';

// Must match minPasswordLength in src/lib/server/auth.ts
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Enter your current password'),
		newPassword: z
			.string()
			.min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
			.max(MAX_PASSWORD_LENGTH, `Use at most ${MAX_PASSWORD_LENGTH} characters`),
		confirmPassword: z.string()
	})
	.refine((v) => v.newPassword === v.confirmPassword, {
		message: 'The passwords do not match',
		path: ['confirmPassword']
	})
	.refine((v) => v.newPassword !== v.currentPassword, {
		message: 'Choose a password that is different from your current one',
		path: ['newPassword']
	});

export type ChangePasswordSchema = typeof changePasswordSchema;
