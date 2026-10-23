import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { env } from '$env/dynamic/private';
import prisma from "$lib/prisma"
import { error, redirect } from '@sveltejs/kit';
import { requested } from '$app/server';

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
			disableImplicitSignup: true,
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
			disableImplicitSignup: true,
			// "common" allows both personal and work/school Microsoft accounts.
			// Set MICROSOFT_TENANT_ID to a specific tenant GUID to restrict it.
			tenantId: env.MICROSOFT_TENANT_ID || 'common',
		}
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24 // refresh once per day of activity
	}
});

export type Session = typeof auth.$Infer.Session;
