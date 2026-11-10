import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { isMailConfigured, sendMail } from "./email/mailer";
import { renderTemplate } from "./email/templates";

/** How long an invitation link works. A password reset link works for one hour. */
export const INVITE_DAYS = 7;
export const RESET_HOURS = 1;

/** Marks a reset link that is really an invitation, so the email can say so. */
export const INVITE_MARKER = "invite=1";

type Person = { name: string; email: string };

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || "there";

async function send(
  template: string,
  person: Person,
  link: string,
  extra: Record<string, string> = {},
) {
  if (!isMailConfigured())
    throw new Error("Email is not configured (set SMTP_HOST and MAIL_FROM).");
  const { subject, body } = await renderTemplate(template, {
    firstName: firstNameOf(person.name),
    name: person.name,
    link,
    organization: publicEnv.PUBLIC_ORGANIZATION_NAME || "Open Cupboard",
    ...extra,
  });
  await sendMail({ to: [person.email], subject, text: body });
}

/**
 * Called by Better Auth for a password reset. The same mechanism carries invitations: the link's
 * callback address says which. The link points at /reset-password, where the person chooses a password.
 */
export async function sendResetPasswordEmail(person: Person, url: string) {
  const invite = decodeURIComponent(url).includes(INVITE_MARKER);
  await send(invite ? "account-invite" : "password-reset", person, url, {
    days: String(INVITE_DAYS),
  });
}

/** Where the emailed link lands after Better Auth checks the token. */
export const resetPageUrl = (invite: boolean) =>
  `${(env.BETTER_AUTH_URL ?? "").replace(/\/$/, "")}/reset-password${invite ? `?${INVITE_MARKER}` : ""}`;
