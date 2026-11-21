import { defineEnvVars } from '@sveltejs/kit/env';
// A setting the app cannot safely run without. In development a fallback is allowed,
// in a production build or run it must be set.
const required =
	(name: string, devFallback?: string) =>
	(input: string | undefined): string => {
		const value = input?.trim();
		if (value) return value;
		if (devFallback !== undefined && process.env.NODE_ENV !== 'production') return devFallback;
		throw new Error(`${name} must be set`);
	};

export const variables = defineEnvVars({
	CSP_ENFORCE: { schema: (input) => input },
	TIMEZONE: { 
		schema: (input: string | undefined) => input?.trim() || 'America/Toronto'
	},
	LOGO_DARK_PATH: { schema: (input) => input },
	LOGO_PATH: { schema: (input) => input },
	ORGANIZATION_NAME: { public: true, 
		schema: (input: string | undefined) => input?.trim() || 'Open Cupboard'
	},
	BETTER_AUTH_URL: { public: false,
		 schema: required('BETTER_AUTH_URL', 'http://localhost:5173')
	},
	BETTER_AUTH_SECRET: {
		schema: (input: string | undefined): string => {
			const value = required('BETTER_AUTH_SECRET', 'dev-only-secret-not-for-production-use-0000')(input);
			if (process.env.NODE_ENV === 'production' && value.length < 32) {
				throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
			}
			return value;
		}
	},
	DATABASE_URL: { schema: (input) => input },
	ID_RENEWAL_PERIOD_MONTHS: { public: true, 
		schema: (input: string | undefined) => {
			const months = Number(input);
			return Number.isFinite(months) && months > 0 ? months : 12; // 12 when unset or invalid
		}
 	},
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
	EMAIL_TEMPLATE_DIR: { schema: (input) => input },
	DATE_LOCALIZATION: {  public: true,
		schema: (input: string | undefined) => input?.trim() || 'en-CA'
	},
	APPOINTMENT_FREQUENCY_DAYS: { public: true,
		schema: (input: string | undefined) => {
			const days = Number(input);
			return Number.isFinite(days) && days > 0 ? days : 28; // 28 when unset or invalid
		}
	},
});
