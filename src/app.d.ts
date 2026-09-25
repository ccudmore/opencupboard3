import type { AppPermission, AuthedUser } from '$lib/server/permissions';
export type AuthedUser = {
        id: string;
        name: string;
        email: string;
        roles: string[];
		permissions: {path: string, name: string, action: string}[]
//		permissions: string[];
};

declare global {
	namespace App {
		// interface Error {}
        interface Locals {
            user: AuthedUser | null;
            session: { id: string; expiresAt: Date } | null;
		}		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};