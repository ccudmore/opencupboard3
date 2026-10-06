import { z } from 'zod';

const householdSchema = z.object({
    id: z.string(),
    street: z.string().min(1),
    street2: z.string(),
    city: z.string(),
    province: z.string().default('Ontario'),
    country: z.string().default('Canada'),
    postalCode: z.string().toUpperCase().regex(/^[ABCEGHJ-NPRSTVXYabceghj-nprstvxy]\d[ABCEGHJ-NPRSTV-Zabcegh-nprstv-z][ -]?\d[ABCEGHJ-NPRSTV-Zabceghj-nprstv-z]\d$/),
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
            email: z.email('Enter a valid email'),
            phone: z.string().regex(/^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/, 'invalid'),
            relationship: z.string().optional(),
            birthYear: z.int().optional(),
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