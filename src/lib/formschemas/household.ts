import { z } from 'zod';

// Canadian postal code: A1A 1A1
// First letter excludes D, F, I, O, Q, U, W, Z; the other letters exclude D, F, I, O, Q, U
const POSTAL_REGEX = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/;

// Strips everything except digits, and drops a leading country code "1"
const normalizePhone = (value: string): string => {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits;
};

// Uppercases and strips everything except letters and digits
const normalizePostal = (value: string): string =>
  value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export const householdSchema = z.object({
    id: z.string(),
    street: z.string().min(1),
    street2: z.string().optional(),
    city: z.string(),
    province: z.string().default('Ontario'),
    country: z.string().default('Canada'),
    postalCode: z
        .string()
        .trim()
        .optional()
        .transform((val) => (val ? normalizePostal(val) : ''))
        .refine((code) => code === '' || POSTAL_REGEX.test(code), {
            message: 'Enter a valid postal code (e.g. A1A 1A1)'
        })
        .transform((code) => (code ? `${code.slice(0, 3)} ${code.slice(3)}` : '')),
    status: z.string().default('Active'),
    dietaryRestrictions: z.string().array().default([]),
    pets: z.string().optional(),
    howHeard: z.string().optional(),
    notes: z.string().optional(),
    preferredServiceTypes: z.string().array(),
    preferredTimeOfDay: z.string().array(),
    languagesSpoken: z.string().array(),
    uniqueId: z.string().optional().nullable(),
    createdAt: z.date().optional(),
    createdBy: z.string().optional(),
    appointmentBookings: z.array(
        z.object({
            id: z.string().optional(),
            householdId: z.string(),
            appointmentId: z.string(),
            status: z.string(),
            createdAt: z.date(),
            createdBy: z.string().nullable(),
            notificationSent: z.date().nullish().default(null),
            reminderSent: z.date().nullish().default(null),
            appointment: z.object({
                startTime: z.date(),
                endTime: z.date(),
            }),
        })
    ),
    members: z.array(
        z.object({
            id: z.string().optional(),
            firstName: z.string().min(1),   
            lastName: z.string().min(1), 
            idChecked: z.string().optional().nullable(),
            email: z.email('Enter a valid email').optional().or(z.literal('')),
            phone: z
                .string()
                .trim()
                .optional()
                .transform((val) => (val ? normalizePhone(val) : ''))
                .refine((digits) => digits === '' || /^[2-9]\d{2}[2-9]\d{6}$/.test(digits), {
                    message: 'Enter a valid North American phone number (e.g. 613-555-1234)'
                })
                .transform((digits) =>
                    digits ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : ''
                ),
            relationship: z.string().optional(),
            birthYear: z.int().optional().nullable(),
            idCheckDate: z.date().optional().nullable(),
            createdAt: z.date().optional(),
            createdBy: z.string().optional(),
        })
    ),
    datedRequests: z.array(
        z.object({
            id: z.string().optional(),
            requestText: z.string(),
            status: z.string(),
            createdAt: z.date(),
            createdBy: z.string().optional(),
            type: z.string().optional(),
        })
    ),
})

const memberShape = householdSchema.shape.members.element.shape;

export const newHouseholdSchema = householdSchema
    .pick({
        pets: true,
        howHeard: true,
        notes: true,
        languagesSpoken: true,
        street: true,
        street2: true,
        city: true,
        province: true,
        country: true,
        postalCode: true,
        status: true,
        dietaryRestrictions: true,
    })
	.extend({
		firstName: memberShape.firstName,
        lastName: memberShape.lastName,
        email: memberShape.email,
        phone: memberShape.phone,
    })

export type HouseholdSchema = typeof householdSchema;
export type NewHouseholdSchema = typeof newHouseholdSchema;