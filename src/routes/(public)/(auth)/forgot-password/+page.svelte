<script lang="ts">
	import type { PageProps } from './$types';
	import { Alert, Button, Input, Label } from 'flowbite-svelte';
	import { EnvelopeSolid } from 'flowbite-svelte-icons';
	import { authClient } from '$lib/auth-client';
	import { page } from '$app/state';

	let { data }: PageProps = $props();
	let email = $state('');
	let sent = $state(false);
	let loading = $state(false);
	let errorMessage = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		loading = true;
		const { error } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${page.url.origin}/reset-password` });
		loading = false;
		// The same answer whether or not the address has an account, so this can't be used to find out who does
		if (error && error.status !== 404) errorMessage = 'Something went wrong. Please try again.';
		else sent = true;
	}
</script>

<svelte:head><title>Forgot password</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-white p-4 sm:p-8 dark:bg-gray-900">
	<div class="w-full max-w-sm space-y-6">
		<div class="space-y-1">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Forgot your password?</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400">Enter your email and we will send you a link to choose a new one.</p>
		</div>

		{#if !data.emailEnabled}
			<Alert color="yellow">Email is not set up for this site. Ask an administrator to reset your password.</Alert>
		{:else if sent}
			<Alert color="green">If an account has that email address, a message is on its way. The link works for one hour.</Alert>
		{:else}
			{#if errorMessage}<Alert color="red">{errorMessage}</Alert>{/if}
			<form class="space-y-4" onsubmit={submit}>
				<div>
					<Label for="email" class="mb-2">Email</Label>
					<Input id="email" type="email" required autocomplete="email" placeholder="you@example.com" class="ps-10" bind:value={email}>
						{#snippet left()}<EnvelopeSolid class="h-4 w-4 text-gray-500 dark:text-gray-400" />{/snippet}
					</Input>
				</div>
				<Button type="submit" color="blue" class="w-full" disabled={loading}>{loading ? 'Sending…' : 'Send the link'}</Button>
			</form>
		{/if}

		<p class="text-center text-sm"><a href="/login" class="text-blue-700 hover:underline dark:text-blue-400">Back to sign in</a></p>
	</div>
</div>
