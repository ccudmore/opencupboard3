import { createAuthClient } from "better-auth/svelte";
import { BETTER_AUTH_URL } from "$app/env/public";

export const authClient = createAuthClient({ baseURL: BETTER_AUTH_URL  });
export const { signIn, signUp, signOut, useSession } = authClient;
