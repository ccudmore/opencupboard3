<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { Alert, Breadcrumb, BreadcrumbItem, Button, Card, Helper, Input, Label, Spinner, Toggle } from 'flowbite-svelte';
	import { HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';
	import { changePasswordSchema, MIN_PASSWORD_LENGTH } from '$lib/formschemas/password';

	let { data } = $props();

	// superForm only needs the initial value; it manages its own state afterwards
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, message }: any = superForm(data.form, {
		validators: zod4Client(changePasswordSchema),
		resetForm: true,
		onUpdated({ form }) {
			if (form.message && form.valid) toast(form.message);
		},
		onError({ result }) {
			toast(`Error: ${result.error.message}`);
		}
	});

	let showPasswords = $state(false);
	const inputType = $derived(showPasswords ? 'text' : 'password');

	const mismatch = $derived($form.confirmPassword !== '' && $form.newPassword !== $form.confirmPassword);
	const tooShort = $derived($form.newPassword !== '' && $form.newPassword.length < MIN_PASSWORD_LENGTH);
	// A failed attempt returns a message; a successful one is also a message, so tell them apart by validity
	const failed = $derived(!!$message && !String($message).startsWith('Your password has been changed'));
</script>

<svelte:head>
	<title>Change password</title>
</svelte:head>

<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
	<BreadcrumbItem href="/" home>
		{#snippet icon()}
			<HomeOutline class="me-2 h-4 w-4" />
		{/snippet}Home
	</BreadcrumbItem>
	<BreadcrumbItem href="/changepassword">
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}
		Change password
	</BreadcrumbItem>
</Breadcrumb>

<div class="bg-gray-50 p-3 sm:p-5 dark:bg-gray-900">
	<div class="mx-auto w-full max-w-md min-w-0">
		<Card class="max-w-none p-4 sm:p-6">
			<h1 class="mb-1 text-xl font-semibold text-gray-900 dark:text-white">Change password</h1>
			{#if data.email}
				<p class="mb-4 text-sm break-words text-gray-600 dark:text-gray-300">Signed in as {data.email}</p>
			{/if}

			{#if !data.hasPassword}
				<Alert color="blue">
					Your account signs in with Google or Microsoft, so there is no password to change here. If you would like to sign in
					with a password as well, ask an administrator to set one for you.
				</Alert>
			{:else}
				<form method="POST" use:enhance class="space-y-4">
					{#if $message}
						<Alert color={failed ? 'red' : 'green'} role={failed ? 'alert' : 'status'}>{$message}</Alert>
					{/if}

					<div>
						<Label for="currentPassword" class="mb-2">Current password</Label>
						<Input
							id="currentPassword"
							name="currentPassword"
							type={inputType}
							autocomplete="current-password"
							bind:value={$form.currentPassword}
							color={$errors.currentPassword ? 'red' : undefined}
						/>
						{#if $errors.currentPassword}<Helper color="red" class="mt-1">{$errors.currentPassword.join(', ')}</Helper>{/if}
					</div>

					<div>
						<Label for="newPassword" class="mb-2">New password</Label>
						<Input
							id="newPassword"
							name="newPassword"
							type={inputType}
							autocomplete="new-password"
							bind:value={$form.newPassword}
							color={$errors.newPassword || tooShort ? 'red' : undefined}
						/>
						{#if $errors.newPassword}
							<Helper color="red" class="mt-1">{$errors.newPassword.join(', ')}</Helper>
						{:else if tooShort}
							<Helper color="red" class="mt-1">Use at least {MIN_PASSWORD_LENGTH} characters</Helper>
						{:else}
							<Helper class="mt-1">At least {MIN_PASSWORD_LENGTH} characters. A few unrelated words make a good password.</Helper>
						{/if}
					</div>

					<div>
						<Label for="confirmPassword" class="mb-2">Confirm new password</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type={inputType}
							autocomplete="new-password"
							bind:value={$form.confirmPassword}
							color={$errors.confirmPassword || mismatch ? 'red' : undefined}
						/>
						{#if $errors.confirmPassword}
							<Helper color="red" class="mt-1">{$errors.confirmPassword.join(', ')}</Helper>
						{:else if mismatch}
							<Helper color="red" class="mt-1">The passwords do not match</Helper>
						{/if}
					</div>

					<Toggle bind:checked={showPasswords} color="green">Show passwords</Toggle>

					<p class="text-sm text-gray-600 dark:text-gray-300">Any other devices you are signed in on will be signed out.</p>

					<div class="flex flex-wrap gap-2">
						<Button type="submit" color="dark" disabled={$submitting}>
							{#if $submitting}<Spinner class="me-2" size="4" />Changing…{:else}Change password{/if}
						</Button>
						<Button type="button" outline color="dark" href="/">Cancel</Button>
					</div>
				</form>
			{/if}
		</Card>
	</div>
</div>
