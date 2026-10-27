import { z } from 'zod';
import { ALL_ROLES } from '$lib/volunteerRoles';

// Same rules as the household form: Canadian postal codes and North American phone numbers.
const POSTAL_REGEX = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/;

const normalizePostal = (value: string): string => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const normalizePhone = (value: string): string => {
	let digits = value.replace(/\D/g, '');
	if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
	return digits;
};

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** Optional text: trimmed, and empty becomes null. */
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((v) => v || null);

const optionalEmail = z
	.union([z.literal(''), z.email('Enter a valid email')])
	.nullish()
	.transform((v) => (v ? v.toLowerCase() : null));

const optionalPhone = z
	.string()
	.trim()
	.nullish()
	.transform((v) => (v ? normalizePhone(v) : ''))
	.refine((digits) => digits === '' || /^[2-9]\d{2}[2-9]\d{6}$/.test(digits), {
		message: 'Enter a valid North American phone number (e.g. 613-555-1234)'
	})
	.transform((digits) => (digits ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : null));

const optionalPostal = z
	.string()
	.trim()
	.nullish()
	.transform((v) => (v ? normalizePostal(v) : null))
	.refine((code) => code === null || POSTAL_REGEX.test(code), { message: 'Enter a valid postal code (e.g. A1A 1A1)' })
	.transform((code) => (code ? `${code.slice(0, 3)} ${code.slice(3)}` : null));

/** Stored in volunteer.availability (a JSON column). */
export const availabilitySchema = z.object({
	days: z.array(z.enum(WEEKDAYS)),
	notes: z.string().trim().max(1000)
});

/** One row of volunteer.trainingCourses. `completed` is a date as YYYY-MM-DD, or empty. */
export const trainingCourseSchema = z.object({
	name: z.string().trim().min(1, 'Enter the course name').max(200),
	completed: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date')])
});

export const volunteerSchema = z.object({
	firstName: z.string().trim().min(1, 'Enter a first name').max(100),
	lastName: z.string().trim().min(1, 'Enter a last name').max(100),
	street: optionalText(200),
	city: optionalText(100),
	postalCode: optionalPostal,
	province: z.string().trim().min(1).max(100).default('Ontario'),
	country: z.string().trim().min(1).max(100).default('Canada'),
	email1: optionalEmail,
	email2: optionalEmail,
	phone1: optionalPhone,
	phone2: optionalPhone,
	availability: availabilitySchema.default({ days: [], notes: '' }),
	trainingCourses: z.array(trainingCourseSchema).default([]),
	// The roles this volunteer may sign up for (see ALL_ROLES)
	skills: z.array(z.string().refine((r) => ALL_ROLES.includes(r), 'Unknown skill')).default([])
});

export type VolunteerSchema = typeof volunteerSchema;

/**
 * The JSON columns are not checked by the database, so read them defensively:
 * anything that doesn't match comes back empty instead of breaking the page.
 */
export function readAvailability(json: unknown): z.infer<typeof availabilitySchema> {
	const parsed = availabilitySchema.safeParse(json);
	return parsed.success ? parsed.data : { days: [], notes: '' };
}

export function readTrainingCourses(json: unknown): z.infer<typeof trainingCourseSchema>[] {
	const parsed = z.array(trainingCourseSchema).safeParse(json);
	return parsed.success ? parsed.data : [];
}

