<script lang="ts">
	import { signIn } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Section, Register } from "flowbite-svelte-blocks";
	import { Button, Checkbox, Label, Input } from "flowbite-svelte";

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	const redirectTo = page.url.searchParams.get('redirectTo') || '/dashboard';

	async function handlePasswordLogin(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		loading = true;

		const { error } = await signIn.email({ email, password });
		loading = false;
		if (error) {
			errorMessage = error.message ?? 'Sign in failed';
			return;
		}
		await goto(redirectTo);
	}

	function handleGoogleLogin() {
		signIn.social({ provider: 'google', callbackURL: redirectTo });
	}

	function handleMicrosoftLogin() {
		signIn.social({ provider: 'microsoft', callbackURL: redirectTo });
	}
</script>

<Section name="login">
  <Register href="/">
    {#snippet top()}
      <img class="mr-2 h-8 w-8" src="/images/logo.svg" alt="logo" />
      Flowbite
    {/snippet}
    <div class="space-y-4 p-6 sm:p-8 md:space-y-6">
      <form class="flex flex-col space-y-6" onsubmit={handlePasswordLogin}>
        <h3 class="p-0 text-xl font-medium text-gray-900 dark:text-white">Change Password</h3>
        <Label class="space-y-2">
          <span>Your email</span>
          <Input type="email" name="email" placeholder="name@company.com" required bind:value={email} />
        </Label>
        <Label class="space-y-2">
          <span>Your password</span>
          <Input type="password" name="password" placeholder="•••••" required bind:value={password} />
        </Label>
		<!-- craig switch this to toaster -->
		{#if errorMessage}
			<p class="error text-sm font-light text-gray-500 dark:text-gray-400">{errorMessage}</p>
		{/if}
        <Button type="submit" disabled={loading} class="w-full1">Sign in</Button> <!-- needs styling -->
        <p class="text-sm font-light text-gray-500 dark:text-gray-400">
          Don’t have an account yet? <a href="/register" class="text-primary-600 dark:text-primary-500 font-medium hover:underline">Sign up</a>
        </p>
      </form>
		<button type="button" onclick={handleGoogleLogin}>Continue with Google</button>
		<button type="button" onclick={handleMicrosoftLogin}>Continue with Microsoft</button>

    </div>
  </Register>
</Section>