import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import {
  SMTP_HOST,
  MAIL_FROM,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASSWORD,
  MAIL_REPLY_TO
} from "$app/env/private";

/** True when SMTP_HOST and MAIL_FROM are both set. */
export function isMailConfigured(): boolean {
  return Boolean(SMTP_HOST && MAIL_FROM);
}

let transport: Transporter | undefined;

function getTransport(): Transporter {
  if (!isMailConfigured())
    throw new Error("Email is not configured (set SMTP_HOST and MAIL_FROM).");

  transport ??= nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    // true for port 465; false for 587, which upgrades with STARTTLS
    secure: SMTP_SECURE === "true",
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined
  });
  return transport;
}

export async function sendMail(message: {
  to: string[];
  subject: string;
  text: string;
}): Promise<void> {
  await getTransport().sendMail({
    from: MAIL_FROM,
    replyTo: MAIL_REPLY_TO || undefined,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
