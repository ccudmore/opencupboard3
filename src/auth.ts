import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { env } from '$env/dynamic/private';
import prisma from "$lib/prisma"

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,

	database: prismaAdapter(prisma, {
		provider: 'postgresql'
	}),

	// Username/password stored in our own database (the "credential"
	// provider under the hood — passwords are hashed by Better Auth and
	// stored on the Account row, never in plaintext).
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		autoSignIn: true
	},

	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID as string,
			clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      		scope: ["openid", "email", "profile"],
  			mapProfileToUser: (profile) => {
				console.log('CRAIG0')
				console.log(profile.picture)
    			return {
      				image: profile.picture ?? "/default-avatar.png",
    			};
  			},			
		},
		microsoft: {
			clientId: env.MICROSOFT_CLIENT_ID as string,
			clientSecret: env.MICROSOFT_CLIENT_SECRET as string,
			// "common" allows both personal and work/school Microsoft accounts.
			// Set MICROSOFT_TENANT_ID to a specific tenant GUID to restrict it.
			tenantId: env.MICROSOFT_TENANT_ID || 'common'
		}
	},

	// Every new user (password or OAuth signup) starts as a plain "user".
	// Promote people to "manager"/"admin" via the admin console or directly
	// in the database/Prisma Studio.
	// craig - needs to fix this
	/*
	user: {
		additionalFields: {
			role: {
				type: 'string[]',
				defaultValue: ['login'],
				input: false // never trust a client-supplied role at signup
			}
		}
	},
	*/

	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24 // refresh once per day of activity
	}
});

export type Session = typeof auth.$Infer.Session;
