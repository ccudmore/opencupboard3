import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { env } from '$env/dynamic/private';
import prisma from "$lib/prisma"
import { error, redirect } from '@sveltejs/kit';

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,

	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google", "microsoft", ],
			allowDifferentEmails: false,
			updateUserInfoOnLink: true,
		},
	},
	encryptOAuthTokens: true,

	database: prismaAdapter(prisma, {
		provider: 'postgresql'
	}),

	// Username/password stored in our own database (the "credential"
	// provider under the hood — passwords are hashed by Better Auth and
	// stored on the Account row, never in plaintext).
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		autoSignIn: true,
		disableSignUp: true,
	},

	socialProviders: {
		google: {
			prompt: "select_account",
			clientId: env.GOOGLE_CLIENT_ID as string,
			clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      		scope: ["openid", "email", "profile"],
			disableImplicitSignUp: true,
			disableSignUp: true,
  			mapProfileToUser: (profile) => {
    			return {
      				image: profile.picture ?? "/images/default-avatar.png",
    			};
  			},			
		},
		microsoft: {
			prompt: "select_account",
			clientId: env.MICROSOFT_CLIENT_ID as string,
			clientSecret: env.MICROSOFT_CLIENT_SECRET as string,
			disableImplicitSignUp: true,
			disableSignUp: true,
			// "common" allows both personal and work/school Microsoft accounts.
			// Set MICROSOFT_TENANT_ID to a specific tenant GUID to restrict it.
			tenantId: env.MICROSOFT_TENANT_ID || 'common',
		}
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24 // refresh once per day of activity
	},

	// Lets the app see user.status (ACTIVE or INACTIVE) on the session
	user: {
		additionalFields: {
			status: { type: 'string', required: false, defaultValue: 'ACTIVE', input: false }
		}
	},

	databaseHooks: {
		session: {
			create: {
				// An inactive user can't sign in, whichever way they try
				before: async (session) => {
					const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { status: true } });
					if (user?.status === 'INACTIVE') return false;
				}
			}
		}
	}
});

export type Session = typeof auth.$Infer.Session;
