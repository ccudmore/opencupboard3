import { defineEnvVars } from '@sveltejs/kit/env';

// @migration-task Review dynamic environment variables. They accept missing values (`undefined`), add stricter validation where a value is required.
export const variables = defineEnvVars({
	CSP_ENFORCE: { schema: (input) => input },
	BETTER_AUTH_URL: { schema: (input) => input },
	TIMEZONE: { schema: (input) => input },
	LOGO_DARK_PATH: { schema: (input) => input },
	LOGO_PATH: { schema: (input) => input },
	PUBLIC_ORGANIZATION_NAME: { public: true, schema: (input) => input },
	PUBLIC_BETTER_AUTH_URL: { public: true, schema: (input) => input },
	DATABASE_URL: { schema: (input) => input },
	PUBLIC_ID_RENEWAL_PERIOD_MONTHS: { public: true, schema: (input) => input },
	BETTER_AUTH_SECRET: { schema: (input) => input },
	GOOGLE_CLIENT_ID: { schema: (input) => input },
	GOOGLE_CLIENT_SECRET: { schema: (input) => input },
	MICROSOFT_CLIENT_ID: { schema: (input) => input },
	MICROSOFT_CLIENT_SECRET: { schema: (input) => input },
	MICROSOFT_TENANT_ID: { schema: (input) => input },
	MAX_UPLOAD_MB: { schema: (input) => input },
	SMTP_HOST: { schema: (input) => input },
	MAIL_FROM: { schema: (input) => input },
	SMTP_PORT: { schema: (input) => input },
	SMTP_SECURE: { schema: (input) => input },
	SMTP_USER: { schema: (input) => input },
	SMTP_PASSWORD: { schema: (input) => input },
	MAIL_REPLY_TO: { schema: (input) => input },
	EMAIL_TEMPLATE_DIR: { schema: (input) => input }
});
