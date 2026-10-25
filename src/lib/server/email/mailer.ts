import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

/** True when SMTP_HOST and MAIL_FROM are both set. */
export function isMailConfigured(): boolean {
	return Boolean(env.SMTP_HOST && env.MAIL_FROM);
}

let transport: nodemailer.Transporter | undefined;

function getTransport(): nodemailer.Transporter {
	if (!isMailConfigured()) throw new Error('Email is not configured (set SMTP_HOST and MAIL_FROM).');

	transport ??= nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: Number(env.SMTP_PORT || 587),
		// true for port 465; false for 587, which upgrades with STARTTLS
		secure: env.SMTP_SECURE === 'true',
		auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined
	});
	return transport;
}

export async function sendMail(message: { to: string[]; subject: string; text: string }): Promise<void> {
	await getTransport().sendMail({
		from: env.MAIL_FROM,
		replyTo: env.MAIL_REPLY_TO || undefined,
		to: message.to,
		subject: message.subject,
		text: message.text
	});
}
