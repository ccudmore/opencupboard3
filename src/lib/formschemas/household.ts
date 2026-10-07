import { z } from 'zod';

const CA_POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
//const NANP = /^(?:\+?1[ .-]?)?\(?([2-9]\d{2})\)?[ .-]?([2-9]\d{2})[ .-]?(\d{4})$/;
const NANP = /^(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})$/;
const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?([-_\s]?[(]?[0-9]?[)]?([-_\s]?[0-9]+)+)$/
);

export function parseNanp(input: string) {
  const m = input.trim().match(NANP);
  if (!m) return null;
  const [, area, exchange, line] = m;
  // N11 codes (211, 311, 411, 911...) aren't valid area codes or exchanges
  if (area.endsWith('11') || exchange.endsWith('11')) return null;
  return `+1${area}${exchange}${line}`; // E.164
}

export const householdSchema = z.object({
    id: z.string(),
    street: z.string().min(1),
    street2: z.string().optional(),
    city: z.string(),
    province: z.string().default('Ontario'),
    country: z.string().default('Canada'),
    postalCode: z.string().toUpperCase(),
//    postalCode: z.string().toUpperCase().regex(CA_POSTAL),
//        /^[ABCEGHJ-NPRSTVXYabceghj-nprstvxy]\d[ABCEGHJ-NPRSTV-Zabcegh-nprstv-z][ -]?\d[ABCEGHJ-NPRSTV-Zabceghj-nprstv-z]\d$/),
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
            fullName: z.string().min(1), 
            idChecked: z.string().optional().nullable(),
            email: z.string().trim().toLowerCase().email('Enter a valid email').max(254, 'Email is too long'),
//            phone: z.string().regex(/^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/, 'invalid'),
/*
            phone: z.string()
                .trim()
                .regex(NANP, 'Enter a valid phone number, e.g. (613) 555-0123')
                .transform((val) => {
                    const [, area, exchange, line] = val.match(NANP)!;
                    return `+1${area}${exchange}${line}`; // E.164
                }),
                */
               /*
               phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine((v) => parseNanp(v) !== null, {
      message: 'Enter a valid US or Canadian phone number'
    }),
    */
   phone: z
    .string()
    .min(1, { message: 'Phone number is required' })
    .regex(phoneRegex, { message: 'Invalid phone number format' }),
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