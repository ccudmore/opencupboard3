<script lang="ts">
	import { Alert, Button, Input, Label } from 'flowbite-svelte';
	import { LockSolid } from 'flowbite-svelte-icons';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	// Better Auth sends people here as /reset-password?token=... (or ?error=INVALID_TOKEN)
	const token = page.url.searchParams.get('token') ?? '';
	const invalid = !token || page.url.searchParams.has('error');
	const invite = page.url.searchParams.has('invite');

	let password = $state('');
	let confirm = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let done = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		if (password.length < 8) return (errorMessage = 'Use at least 8 characters.');
		if (password !== confirm) return (errorMessage = 'The two passwords do not match.');
		loading = true;
		const { error } = await authClient.resetPassword({ newPassword: password, token });
		loading = false;
		if (error) {
			errorMessage = error.message ?? 'This link is no longer valid. Ask for a new one.';
			return;
		}
		done = true;
		setTimeout(() => goto('/login'), 1500);
	}
</script>

<svelte:head><title>{invite ? 'Choose a password' : 'Reset password'}</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-white p-4 sm:p-8 dark:bg-gray-900">
	<div class="w-full max-w-sm space-y-6">
		<div class="space-y-1">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{invite ? 'Welcome! Choose a password' : 'Choose a new password'}</h1>
		</div>

		{#if invalid}
			<Alert color="red">
				This link has expired or was already used.
				{#if invite}Ask the person who invited you to send a new one, or use "Forgot password" on the sign in page.
				{:else}<a href="/forgot-password" class="font-medium underline">Ask for a new link</a>.{/if}
			</Alert>
		{:else if done}
			<Alert color="green">Your password is saved. Taking you to sign in…</Alert>
		{:else}
			{#if errorMessage}<Alert color="red">{errorMessage}</Alert>{/if}
			<form class="space-y-4" onsubmit={submit}>
				<div>
					<Label for="pw">New password</Label>
					<Input id="pw" type="password" required autocomplete="new-password" minlength={8} maxlength={128} class="ps-10" bind:value={password}>
						{#snippet left()}<LockSolid class="h-4 w-4 text-gray-500 dark:text-gray-400" />{/snippet}
					</Input>
				</div>
				<div>
					<Label for="pw2">Type it again</Label>
					<Input id="pw2" type="password" required autocomplete="new-password" maxlength={128} class="ps-10" bind:value={confirm}>
						{#snippet left()}<LockSolid class="h-4 w-4 text-gray-500 dark:text-gray-400" />{/snippet}
					</Input>
				</div>
				<Button type="submit" color="blue" class="w-full" disabled={loading}>{loading ? 'Saving…' : 'Save password'}</Button>
			</form>
		{/if}

		<p class="text-center text-sm"><a href="/login" class="text-blue-700 hover:underline dark:text-blue-400">Back to sign in</a></p>
	</div>
</div>
