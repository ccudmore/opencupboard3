<script lang="ts">
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { Alert, Button, Card, Helper, Input, Label, Spinner, Toggle } from 'flowbite-svelte';
	
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

<PageBreadcrumb items={[{ label: 'Change password', href: '/changepassword' }]} bar />

<div class="page-content">
	<div class="mx-auto w-full max-w-md min-w-0">
		<Card class="max-w-none p-4 sm:p-6">
			<h1 class="mb-1 text-xl font-semibold text-gray-900 dark:text-white">Change password</h1>
			{#if data.email}
				<p class="mb-4 wrap-break-word hint">Signed in as {data.email}</p>
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
						<Label for="currentPassword">Current password</Label>
						<Input
							id="currentPassword"
							name="currentPassword"
							type={inputType}
							autocomplete="current-password"
							bind:value={$form.currentPassword}
							color={$errors.currentPassword ? 'red' : undefined}
						/>
						{#if $errors.currentPassword}<Helper color="red" class="field-help">{$errors.currentPassword.join(', ')}</Helper>{/if}
					</div>

					<div>
						<Label for="newPassword">New password</Label>
						<Input
							id="newPassword"
							name="newPassword"
							type={inputType}
							autocomplete="new-password"
							bind:value={$form.newPassword}
							color={$errors.newPassword || tooShort ? 'red' : undefined}
						/>
						{#if $errors.newPassword}
							<Helper color="red" class="field-help">{$errors.newPassword.join(', ')}</Helper>
						{:else if tooShort}
							<Helper color="red" class="field-help">Use at least {MIN_PASSWORD_LENGTH} characters</Helper>
						{:else}
							<Helper class="field-help">At least {MIN_PASSWORD_LENGTH} characters. A few unrelated words make a good password.</Helper>
						{/if}
					</div>

					<div>
						<Label for="confirmPassword">Confirm new password</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type={inputType}
							autocomplete="new-password"
							bind:value={$form.confirmPassword}
							color={$errors.confirmPassword || mismatch ? 'red' : undefined}
						/>
						{#if $errors.confirmPassword}
							<Helper color="red" class="field-help">{$errors.confirmPassword.join(', ')}</Helper>
						{:else if mismatch}
							<Helper color="red" class="field-help">The passwords do not match</Helper>
						{/if}
					</div>

					<Toggle bind:checked={showPasswords} color="green">Show passwords</Toggle>

					<p class="hint">Any other devices you are signed in on will be signed out.</p>

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
