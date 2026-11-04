<script lang="ts">
	import { Alert, Badge, Button, Input, Label, Modal } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';

	type Account = { id: string; email: string; active: boolean; hasPassword: boolean; onlyVolunteer: boolean; emailEnabled: boolean };

	let {
		account,
		status,
		assignmentCount,
		documentCount
	}: { account: Account | null; status: 'ACTIVE' | 'ARCHIVED'; assignmentCount: number; documentCount: number } = $props();

	// The volunteer page is one big <form>, so this section sits outside it and uses fetch.
	let busy = $state(false);
	let error = $state('');
	let editing = $state(false);
	let newEmail = $state('');
	let confirmArchive = $state(false);
	let deleteOpen = $state(false);

	async function remove() {
		busy = true;
		const r = await callAction('delete', {}); // goes to the volunteer list when it works
		busy = false;
		if (!r.ok) {
			deleteOpen = false;
			error = r.message;
		}
	}

	async function run(action: string, fields: Record<string, string>, done: string) {
		busy = true;
		error = '';
		const r = await callAction(action, fields);
		busy = false;
		if (!r.ok) {
			error = r.message;
			return false;
		}
		toast.success(done);
		editing = false;
		confirmArchive = false;
		await invalidateAll();
		return true;
	}

	async function archive() {
		busy = true;
		error = '';
		const r = await callAction('archive', {});
		busy = false;
		if (!r.ok) return (error = r.message);
		toast.success(r.data.loginDisabled ? 'Volunteer archived and login switched off.' : 'Volunteer archived.');
		confirmArchive = false;
		await invalidateAll();
	}
</script>

<section class="tab-section">
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<h2 class="section-title mb-0">Login and status</h2>
		{#if status === 'ARCHIVED'}<Badge color="yellow">Archived</Badge>{:else}<Badge color="green">Active</Badge>{/if}
	</div>

	{#if !account}
		<Alert color="red">This volunteer's account could not be found.</Alert>
	{:else}
		<div class="mb-3 min-w-0 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
			<div class="hint">Signs in with</div>
			<div class="font-medium break-all text-gray-900 dark:text-white">{account.email}</div>
			<div class="mt-1 hint">
				{account.hasPassword ? 'Has chosen a password.' : 'Has not chosen a password yet.'}
				{#if !account.active}Their login is switched off.{/if}
			</div>
		</div>

		{#if error}<Alert color="red" class="mb-3">{error}</Alert>{/if}

		<p class="mb-3 hint">
			Passwords are never set here. Send a link and they choose their own.
		</p>
		<div class="flex flex-wrap gap-2">
			{#if account.hasPassword}
				<Button type="button" outline color="dark" size="sm" disabled={busy || !account.emailEnabled || !account.active} onclick={() => run('sendLink', { kind: 'reset' }, 'Password reset email sent.')}>
					Send password reset
				</Button>
			{:else}
				<Button type="button" color="blue" size="sm" disabled={busy || !account.emailEnabled || !account.active} onclick={() => run('sendLink', { kind: 'invite' }, 'Invitation sent.')}>
					Send invitation
				</Button>
			{/if}
			{#if account.onlyVolunteer && !editing}
				<Button type="button" outline color="dark" size="sm" disabled={busy} onclick={() => { editing = true; newEmail = account.email; error = ''; }}>Change email</Button>
			{/if}
		</div>
		{#if !account.emailEnabled}
			<p class="mt-2 hint">Email is not set up, so messages can't be sent.</p>
		{/if}
		{#if !account.onlyVolunteer}
			<p class="mt-2 hint">This person has other roles, so their email, roles and login status are managed in Admin &gt; Users.</p>
		{/if}

		{#if editing}
			<form
				class="mt-3 flex items-end gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					run('changeEmail', { email: newEmail }, 'Email changed.');
				}}
			>
				<div class="min-w-0 grow">
					<Label for="acct-email">New login email</Label>
					<Input id="acct-email" type="email" required autocomplete="off" bind:value={newEmail} class="block w-full max-w-full min-w-0" />
				</div>
				<Button type="submit" color="blue" disabled={busy}>Save</Button>
				<Button type="button" outline color="dark" onclick={() => (editing = false)}>Cancel</Button>
			</form>
		{/if}

		<hr class="my-4 border-gray-200 dark:border-gray-700" />

		{#if status === 'ARCHIVED'}
			<p class="mb-3 hint">Archived volunteers are hidden from lists and can't be picked for shifts.</p>
			<Button type="button" color="blue" size="sm" disabled={busy} onclick={() => run('unarchive', {}, 'Volunteer restored.')}>Restore volunteer</Button>
		{:else if confirmArchive}
			<Alert color="yellow">
				<p>
					Archive this volunteer? They are hidden from lists and shift pickers, and their pending sign-ups for upcoming shifts are cancelled.
					{#if account.onlyVolunteer}Their login is switched off.{:else}They keep their login because they have other roles.{/if}
				</p>
				<div class="mt-2 flex gap-2">
					<Button size="xs" color="red" disabled={busy} onclick={archive}>Yes, archive</Button>
					<Button size="xs" outline color="dark" onclick={() => (confirmArchive = false)}>Cancel</Button>
				</div>
			</Alert>
		{:else}
			<Button type="button" outline color="dark" size="sm" disabled={busy} onclick={() => (confirmArchive = true)}>Archive volunteer</Button>
		{/if}
	{/if}

	<hr class="my-4 border-gray-200 dark:border-gray-700" />
	<Button type="button" outline color="red" size="sm" onclick={() => (deleteOpen = true)}>Delete volunteer</Button>
</section>

<Modal title="Delete volunteer" bind:open={deleteOpen} size="xs" autoclose={false}>
	<p class="muted">
		Delete this volunteer? Archiving is usually better: it keeps their history.
		{#if assignmentCount > 0}
			They will also be removed from {assignmentCount} {assignmentCount === 1 ? 'event' : 'events'}, including past ones.
		{/if}
		{#if documentCount > 0}
			Their {documentCount} uploaded {documentCount === 1 ? 'document' : 'documents'} will be deleted too.
		{/if}
		This can't be undone.
	</p>
	{#snippet footer()}
		<Button color="red" disabled={busy} onclick={remove}>Yes, delete</Button>
		<Button outline color="dark" onclick={() => (deleteOpen = false)}>Cancel</Button>
	{/snippet}
</Modal>
