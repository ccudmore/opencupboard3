<script lang="ts">
	import { Alert, Button, Helper, Input, Label } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';

	let {
		volunteerId,
		login,
		defaultName = '',
		defaultEmail = ''
	}: {
		/** null for a volunteer who hasn't been saved yet */
		volunteerId: string | null;
		login: { id: string; name: string; email: string } | null;
		defaultName?: string;
		defaultEmail?: string;
	} = $props();

	// The volunteer page is one big <form>, so this section sits outside it and uses fetch.
	let mode = $state<'none' | 'create' | 'link'>('none');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');
	let confirmUnlink = $state(false);

	function open(m: 'create' | 'link') {
		mode = m;
		error = '';
		name = defaultName;
		email = defaultEmail;
		password = '';
	}
	function cancel() {
		mode = 'none';
		error = '';
		password = '';
	}

	async function run(action: string, fields: Record<string, string>, done: string) {
		busy = true;
		error = '';
		const r = await callAction(action, fields);
		busy = false;
		if (!r.ok) {
			error = r.message;
			return;
		}
		toast(done);
		mode = 'none';
		password = '';
		confirmUnlink = false;
		await invalidateAll();
	}
</script>

<section class="rounded-lg bg-white p-4 shadow-md sm:p-5 dark:bg-gray-800">
	<h2 class="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Login</h2>

	{#if !volunteerId}
		<p class="text-sm text-gray-600 dark:text-gray-300">Save the volunteer first, then you can give them a login.</p>
	{:else if login}
		<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">This volunteer can sign in as:</p>
		<div class="mb-3 min-w-0 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
			<div class="font-medium break-words text-gray-900 dark:text-white">{login.name}</div>
			<div class="text-sm break-all text-gray-600 dark:text-gray-300">{login.email}</div>
		</div>
		<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">
			To reset their password, deactivate them or change their roles, use Admin &gt; Users.
		</p>
		{#if confirmUnlink}
			<Alert color="yellow" class="mb-3">
				Disconnect this login from the volunteer? The login itself is not deleted.
				<div class="mt-2 flex gap-2">
					<Button size="xs" color="red" disabled={busy} onclick={() => run('unlinkLogin', {}, 'Login disconnected.')}>Yes, disconnect</Button>
					<Button size="xs" outline color="dark" onclick={() => (confirmUnlink = false)}>Cancel</Button>
				</div>
			</Alert>
		{:else}
			<Button type="button" outline color="dark" size="sm" onclick={() => (confirmUnlink = true)}>Disconnect login</Button>
		{/if}
	{:else}
		<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">
			This volunteer has no login yet. A login lets them sign in with the Volunteer role.
		</p>

		{#if mode === 'none'}
			<div class="flex flex-wrap gap-2">
				<Button type="button" color="dark" size="sm" onclick={() => open('create')}>Create a login</Button>
				<Button type="button" outline color="dark" size="sm" onclick={() => open('link')}>Link an existing user</Button>
			</div>
		{:else}
			<div class="space-y-3">
				{#if mode === 'create'}
					<div>
						<Label for="login-name" class="mb-2">Name</Label>
						<Input id="login-name" autocomplete="off" bind:value={name} />
					</div>
				{/if}
				<div>
					<Label for="login-email" class="mb-2">{mode === 'create' ? 'Email (they sign in with this)' : 'Email of the existing user'}</Label>
					<Input id="login-email" type="email" autocomplete="off" bind:value={email} />
				</div>
				{#if mode === 'create'}
					<div>
						<Label for="login-password" class="mb-2">Temporary password</Label>
						<Input id="login-password" type="password" autocomplete="new-password" bind:value={password} />
						<Helper class="mt-1">At least 8 characters. Tell the volunteer to change it under Change password after signing in.</Helper>
					</div>
				{/if}
				{#if error}<p class="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>{/if}
				<div class="flex flex-wrap gap-2">
					{#if mode === 'create'}
						<Button type="button" color="dark" disabled={busy} onclick={() => run('createLogin', { name, email, password }, 'Login created.')}>
							{busy ? 'Creating…' : 'Create login'}
						</Button>
					{:else}
						<Button type="button" color="dark" disabled={busy} onclick={() => run('linkLogin', { email }, 'Login linked.')}>
							{busy ? 'Linking…' : 'Link user'}
						</Button>
					{/if}
					<Button type="button" outline color="dark" onclick={cancel}>Cancel</Button>
				</div>
			</div>
		{/if}
	{/if}
</section>
