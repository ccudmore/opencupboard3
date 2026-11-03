import type { PageServerLoad } from './$types';
import { isMailConfigured } from '$lib/server/email/mailer';

export const load: PageServerLoad = async () => ({ emailEnabled: isMailConfigured() });
