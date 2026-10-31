<script lang="ts">
	import type { Service, Site } from './types';
	import { callAction } from '$lib/client/callAction';
	import { toast } from 'svelte-sonner';
	import EmailPrompts from '$lib/components/EmailPrompts.svelte';
	import { Badge, Button, Input, Label, Modal } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { getActionRunner } from '$lib/client/actionRunner.svelte';

	let {
		service,
		sites,
		timeZone,
		emailEnabled,
		onopen,
		canManageVolunteers
	}: {
		service: Service;
		sites: Site[];
		timeZone: string;
		emailEnabled: boolean;
		onopen: (id: string) => void;
		canManageVolunteers: boolean;
	} = $props();

	const runner = getActionRunner();
	const { run } = runner;

	// svelte-ignore state_referenced_locally
	let needs = $state<Record<string, number>>(Object.fromEntries(service.roles.map((r) => [r.role, r.required])));

	// svelte-ignore state_referenced_locally
	let savedNeeds = JSON.stringify(service.roles.map((r) => r.required));
	$effect(() => {
		const now = JSON.stringify(service.roles.map((r) => r.required));
		if (now === savedNeeds) return;
		savedNeeds = now;
		needs = Object.fromEntries(service.roles.map((r) => [r.role, r.required]));
	});
	const needsChanged = $derived(service.roles.some((r) => (needs[r.role] ?? 0) !== r.required));
	const saveNeeds = () => run('needs', 'setNeeds', { eventId: service.id, counts: JSON.stringify(needs) }, 'Volunteer counts saved.');

	let addingRole = $state('');
	let volunteerQuery = $state('');
	let volunteerResults = $state<{ id: string; name: string }[]>([]);
	let volunteerBusy = $state(false);

	async function searchVolunteers() {
		if (!addingRole) return;
		volunteerBusy = true;
		const r = await callAction('searchVolunteers', { eventId: service.id, role: addingRole, q: volunteerQuery });
		volunteerBusy = false;
		if (!r.ok) return void toast(r.message);
		volunteerResults = r.data.volunteers;
	}
	function startAdding(role: string) {
		addingRole = addingRole === role ? '' : role;
		volunteerQuery = '';
		volunteerResults = [];
		if (addingRole) void searchVolunteers();
	}
	let volunteerTimer: ReturnType<typeof setTimeout> | undefined;
	function onVolunteerInput() {
		clearTimeout(volunteerTimer);
		volunteerTimer = setTimeout(searchVolunteers, 250);
	}

	async function addVolunteer(volunteerId: string, name: string) {
		const data = await run(`vol:${volunteerId}`, 'addVolunteer', { eventId: service.id, volunteerId, role: addingRole }, `${name} added as ${addingRole}.`);
		if (!data) return;
		addingRole = '';
		await volunteerPrompts?.start(data.assignmentId, 'confirmation', true);
	}

	let removeTarget = $state<Service['volunteers'][number] | null>(null);
	async function removeVolunteer() {
		const v = removeTarget;
		if (!v) return;
		const ok = await run('remove-vol', 'removeVolunteer', { assignmentId: v.assignmentId }, `${v.name} removed.`);
		if (ok) {
			removeTarget = null;
			await volunteerPrompts?.start(v.assignmentId, 'cancellation', true);
		}
	}

	const sectionClass = 'rounded-lg border border-gray-200 p-3 sm:p-4 dark:border-gray-700';
	const headingClass = 'mb-3 text-base font-semibold text-gray-900 dark:text-white';
	const cancelled = $derived(service.status === 'CANCELLED');
	const editable = $derived(!service.past && !cancelled);

	let volunteerPrompts: ReturnType<typeof EmailPrompts> | undefined = $state();
</script>

{#if canManageVolunteers}
	<section class={sectionClass}>
		<h3 class={headingClass}>Volunteers</h3>
		<div class="space-y-4">
			{#each service.roles as r (r.role)}
				{@const people = service.volunteers.filter((v) => v.role === r.role)}
				<div>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						<label for={`need-${service.id}-${r.role}`} class="w-40 text-sm font-medium text-gray-900 dark:text-white">{r.role}</label>
						<Input id={`need-${service.id}-${r.role}`} type="number" min="0" max="50" class="w-24" bind:value={needs[r.role]} />
						<span class="text-sm text-gray-600 dark:text-gray-300">needed · {r.filled} filled</span>
					</div>
					<ul class="mt-1 ms-1 space-y-1">
						{#each people as v (v.assignmentId)}
							<li class="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
								<a href={`/volunteers/${v.volunteerId}`} class="text-blue-700 hover:underline dark:text-blue-400">{v.name}</a>
								{#if v.status === 'PENDING'}<Badge color="yellow">Waiting for approval</Badge>{/if}
								{#if editable}<Button size="xs" outline color="dark" onclick={() => (removeTarget = v)}>Remove</Button>{/if}
							</li>
						{/each}
					</ul>
					{#if editable}
						<Button size="xs" outline color="dark" class="mt-2" onclick={() => startAdding(r.role)}>
							<PlusOutline class="me-1 h-3.5 w-3.5" />{addingRole === r.role ? 'Close' : `Add a ${r.role}`}
						</Button>
					{/if}
					{#if addingRole === r.role}
						<div class="mt-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
							<Label for={`vol-q-${service.id}`} class="mb-1">Volunteers with the {r.role} skill</Label>
							<Input id={`vol-q-${service.id}`} placeholder="Search by name" autocomplete="off" bind:value={volunteerQuery} oninput={onVolunteerInput} />
							{#if volunteerBusy}<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">Searching…</p>{/if}
							{#if !volunteerBusy && volunteerResults.length === 0}
								<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">No available volunteers with this skill. Skills are set on each volunteer's page.</p>
							{/if}
							<ul class="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
								{#each volunteerResults as v (v.id)}
									<li class="flex items-center justify-between gap-2 py-2">
										<span class="min-w-0 wrap-break-word text-gray-900 dark:text-white">{v.name}</span>
										<Button size="xs" color="dark" disabled={runner.busy === `vol:${v.id}`} onclick={() => addVolunteer(v.id, v.name)}>Add</Button>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/each}
		</div>
		<div class="mt-4">
			<Button size="sm" color="dark" disabled={!needsChanged || runner.busy === 'needs'} onclick={saveNeeds}>{runner.busy === 'needs' ? 'Saving…' : 'Save volunteer counts'}</Button>
		</div>
	</section>
{/if}

<Modal title="Remove this volunteer?" open={removeTarget !== null} onclose={() => (removeTarget = null)} size="xs">
	<p class="text-gray-600 dark:text-gray-300">Remove {removeTarget?.name} from this service date? You'll be asked whether to send them a cancellation email.</p>
	{#snippet footer()}
		<Button color="red" disabled={runner.busy === 'remove-vol'} onclick={removeVolunteer}>Yes, remove</Button>
		<Button outline color="dark" onclick={() => (removeTarget = null)}>Keep</Button>
	{/snippet}
</Modal>
<EmailPrompts bind:this={volunteerPrompts} {emailEnabled} previewAction="previewVolunteerEmail" sendAction="sendVolunteerEmail" idField="assignmentId" audience="volunteer" />