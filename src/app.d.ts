import type { AppPermission, AuthedUser } from '$lib/server/permissions';

declare global {
	namespace App {
		// interface Error {}
        interface Locals {
            user: AuthedUser | null;
            session: { id: string; expiresAt: Date } | null;
//            permissions: Set<AppPermission> | null;
            permissions: String[] | null;

		}		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
