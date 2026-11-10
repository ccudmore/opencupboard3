import { randomBytes } from "node:crypto";
import prisma from "$lib/prisma";
import { auth } from "$lib/server/auth";
import {
  INVITE_DAYS,
  RESET_HOURS,
  resetPageUrl,
  sendResetPasswordEmail,
} from "$lib/server/accountEmail";
import { isMailConfigured } from "$lib/server/email/mailer";

export type LinkResult =
  { ok: true } | { ok: false; status: number; message: string };

/**
 * Emails a person a one-time link to choose a password: an invitation (works for 7 days) or a
 * password reset (works for 1 hour). Managers use this instead of ever setting a password.
 * Uses Better Auth's own reset tokens, so /reset-password finishes the job for both.
 */
export async function sendAccountLink(
  userId: string,
  kind: "invite" | "reset",
): Promise<LinkResult> {
  if (!isMailConfigured())
    return {
      ok: false,
      status: 503,
      message: "Email is not set up, so no message can be sent.",
    };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, status: true },
  });
  if (!user)
    return { ok: false, status: 404, message: "That user no longer exists." };
  if (user.status === "INACTIVE")
    return {
      ok: false,
      status: 409,
      message:
        "This account is inactive. Make it active before sending a message.",
    };

  const ctx = await auth.$context;
  const token = randomBytes(18).toString("base64url");
  const hours = kind === "invite" ? INVITE_DAYS * 24 : RESET_HOURS;
  await ctx.internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: user.id,
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
  });

  const callback = encodeURIComponent(resetPageUrl(kind === "invite"));
  const url = `${ctx.baseURL}/reset-password/${token}?callbackURL=${callback}`;
  try {
    await sendResetPasswordEmail({ name: user.name, email: user.email }, url);
  } catch (err) {
    console.error("Could not send the account email", err);
    return {
      ok: false,
      status: 502,
      message:
        "The email could not be sent. Check the email settings and try again.",
    };
  }
  return { ok: true };
}
