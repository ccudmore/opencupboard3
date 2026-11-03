<script lang="ts">
	import type { PageProps } from './$types';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Alert, Breadcrumb, BreadcrumbItem, Button, Helper, Input, Label } from 'flowbite-svelte';
	import { ChevronDoubleRightOutline, HomeOutline } from 'flowbite-svelte-icons';
	import { callAction } from '$lib/client/callAction';

	let { data }: PageProps = $props();

	type Found = { kind: 'none' } | { kind: 'volunteer'; volunteerId: string; name: string; archived: boolean } | { kind: 'user'; userId: string; name: string; inactive: boolean };

	let email = $state('');
	let checkedEmail = $state('');
	let found = $state<Found | null>(null);
	let firstName = $state('');
	let lastName = $state('');
	let sendInvite = $state(true);
	let busy = $state(false);
	let error = $state('');

	const field = 'block w-full max-w-full min-w-0';
	const checkClass = 'h-5 w-5 shrink-0 cursor-pointer rounded accent-blue-600 dark:accent-blue-400';

	function reset() {
		found = null;
		checkedEmail = '';
		error = '';
	}

	async function check(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const r = await callAction('lookup', { email });
		busy = false;
		if (!r.ok) return (error = r.message);
		found = r.data.found;
		checkedEmail = r.data.email;
		// A user who already has an account: start from the name on it
		if (found?.kind === 'user') {
			const [first, ...rest] = found.name.trim().split(/\s+/);
			firstName = first ?? '';
			lastName = rest.join(' ');
		} else {
			firstName = '';
			lastName = '';
		}
	}

	async function add(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const r = await callAction('add', { email: checkedEmail, firstName, lastName, sendInvite: String(sendInvite && found?.kind === 'none') });
		busy = false;
		if (!r.ok) return (error = r.message);
		if (r.data.invite === 'sent') toast.success('Volunteer added and invitation sent.');
		else if (r.data.invite === 'failed') toast.warning(`Volunteer added, but the invitation was not sent: ${r.data.inviteMessage}`);
		else toast.success('Volunteer added.');
		await goto(`/volunteers/${r.data.volunteerId}`);
	}
</script>

<svelte:head><title>New volunteer</title></svelte:head>

<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
	<BreadcrumbItem href="/" home>
		{#snippet icon()}<HomeOutline class="me-2 h-4 w-4" />{/snippet}Home
	</BreadcrumbItem>
	<BreadcrumbItem href="/volunteers">
		{#snippet icon()}<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />{/snippet}Volunteers
	</BreadcrumbItem>
	<BreadcrumbItem>
		{#snippet icon()}<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />{/snippet}New
	</BreadcrumbItem>
</Breadcrumb>

<div class="mx-auto w-full max-w-xl space-y-4 p-4 sm:p-6">
	<h1 class="text-2xl font-semibold text-gray-900 dark:text-white">New volunteer</h1>
	<p class="text-sm text-gray-600 dark:text-gray-300">
		Every volunteer has a login, so start with their email address. We check whether they already have an account.
	</p>

	{#if error}<Alert color="red">{error}</Alert>{/if}

	<form class="flex items-end gap-2" onsubmit={check}>
		<div class="min-w-0 grow">
			<Label for="v-email" class="mb-1">Email</Label>
			<Input id="v-email" type="email" required autocomplete="off" bind:value={email} oninput={() => found && reset()} class={field} />
		</div>
		<Button type="submit" color="blue" disabled={busy || !email.trim() || found !== null}>{busy && !found ? 'Checking…' : 'Continue'}</Button>
	</form>

	{#if found?.kind === 'volunteer'}
		<Alert color="yellow">
			<p class="font-medium wrap-break-word">{found.name} is already a volunteer{found.archived ? ' (archived)' : ''}.</p>
			<div class="mt-2"><Button size="xs" color="blue" href={`/volunteers/${found.volunteerId}`}>Open {found.name}</Button></div>
		</Alert>
	{:else if found}
		{#if found.kind === 'user'}
			<Alert color="blue">
				<p class="wrap-break-word">
					<span class="font-medium">{found.name}</span> already has an account with this email. Making them a volunteer adds the Volunteer role and a volunteer profile to that account. No second account is created.
				</p>
				{#if found.inactive}<p class="mt-1">This account is inactive. Reactivate it in Admin &gt; Users so they can sign in.</p>{/if}
			</Alert>
		{:else}
			<Alert color="green">No account has this email yet. One will be created for the volunteer.</Alert>
		{/if}

		<form class="space-y-3" onsubmit={add}>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="min-w-0">
					<Label for="v-first" class="mb-1">First name</Label>
					<Input id="v-first" required maxlength={100} autocomplete="off" bind:value={firstName} class={field} />
				</div>
				<div class="min-w-0">
					<Label for="v-last" class="mb-1">Last name</Label>
					<Input id="v-last" required maxlength={100} autocomplete="off" bind:value={lastName} class={field} />
				</div>
			</div>

			{#if found.kind === 'none'}
				<label class="flex cursor-pointer items-start gap-2 text-gray-900 dark:text-gray-100">
					<input type="checkbox" class="{checkClass} mt-0.5" bind:checked={sendInvite} disabled={!data.emailEnabled} />
					<span>Email them an invitation to choose a password</span>
				</label>
				{#if !data.emailEnabled}
					<Helper>Email is not set up, so no invitation can be sent. You can send one later from their page.</Helper>
				{/if}
			{/if}

			<div class="flex gap-2 pt-1">
				<Button type="submit" color="blue" disabled={busy}>{busy ? 'Adding…' : found.kind === 'user' ? 'Make them a volunteer' : 'Add volunteer'}</Button>
				<Button type="button" outline color="dark" onclick={reset}>Change email</Button>
			</div>
		</form>
	{/if}
</div>
