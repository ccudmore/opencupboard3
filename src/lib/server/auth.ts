import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import {
  BETTER_AUTH_URL,
  BETTER_AUTH_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET,
  MICROSOFT_TENANT_ID,
  AUTH_SESSION_DAYS
} from "$app/env/private";

import prisma from "#lib/prisma.ts";
import { error, redirect } from "@sveltejs/kit";
import { sendResetPasswordEmail, RESET_HOURS } from "#lib/server/accountEmail.ts";

export const auth = betterAuth({
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "microsoft"],
      allowDifferentEmails: false,
      updateUserInfoOnLink: true,
    },
  },
  encryptOAuthTokens: true,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Username/password stored in our own database (the "credential"
  // provider under the hood — passwords are hashed by Better Auth and
  // stored on the Account row, never in plaintext).
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    disableSignUp: true,
    // "Forgot password" and volunteer invitations both email a link to /reset-password
    resetPasswordTokenExpiresIn: 60 * 60 * RESET_HOURS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendResetPasswordEmail(
          { name: user.name, email: user.email },
          url,
        );
      } catch (err) {
        console.error("Could not send the password email", err);
      }
    },
  },

  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: GOOGLE_CLIENT_ID as string,
      clientSecret: GOOGLE_CLIENT_SECRET as string,
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
      clientId: MICROSOFT_CLIENT_ID as string,
      clientSecret: MICROSOFT_CLIENT_SECRET as string,
      disableImplicitSignUp: true,
      disableSignUp: true,
      // "common" allows both personal and work/school Microsoft accounts.
      // Set MICROSOFT_TENANT_ID to a specific tenant GUID to restrict it.
      tenantId: MICROSOFT_TENANT_ID || "common"
    }
  },
  session: {
    expiresIn: Math.round(60 * 60 * 24 * AUTH_SESSION_DAYS), // AUTH_SESSION_DAYS, default 7
    // refresh once per day of activity (or more often if the lifetime is under a day)
    updateAge: Math.min(60 * 60 * 24, Math.round(60 * 60 * 24 * AUTH_SESSION_DAYS))
  },

  // Lets the app see user.status (ACTIVE or INACTIVE) on the session
  user: {
    additionalFields: {
      status: {
        type: "string",
        required: false,
        defaultValue: "ACTIVE",
        input: false,
      },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // An inactive user can't sign in, whichever way they try
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });
          if (user?.status === "INACTIVE") return false;
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
