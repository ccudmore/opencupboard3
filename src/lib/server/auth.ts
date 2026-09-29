import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { env } from '$env/dynamic/private';
import prisma from "$lib/prisma"
import { error, redirect } from '@sveltejs/kit';

function uploadImageToStorage(img: string) {
	return null
}
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
		autoSignIn: true
	},

	socialProviders: {
		google: {
			prompt: "select_account",
			clientId: env.GOOGLE_CLIENT_ID as string,
			clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      		scope: ["openid", "email", "profile"],
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


function haveCommonElement(arr1: string[], arr2: string[]): boolean {
  const set2 = new Set(arr2);
  return arr1.some(element => set2.has(element));
}

export function requireRole( locals: App.Locals, url: URL, allowedRoles: string[]) {
  const user = locals.user;

  if (!user) {
    throw redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }

  if (!haveCommonElement(allowedRoles, user.roles)) {
    throw error(403, 'You do not have permission to view this page');
  }

  return user;
}

//export type Session = typeof auth.$Infer.Session;
