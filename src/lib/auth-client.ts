import { createAuthClient } from "better-auth/svelte";
//import { BETTER_AUTH_URL } from "$app/env/private";

//export const authClient = createAuthClient({ baseURL: BETTER_AUTH_URL  });
export const authClient = createAuthClient();
// { baseURL: BETTER_AUTH_URL  });
export const { signIn, signUp, signOut, useSession } = authClient;
