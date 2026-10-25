<script lang="ts">
	import {
		Badge,
		Button,
		Drawer,
		Helper,
		Input,
		Label,
		Modal,
		Select,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';
	import { volunteerAssignmentStatusOptions } from '$lib/labels';
	import { rolesFor } from '$lib/volunteerRoles';
	import { VolunteerAssignmentsStatus } from '$prisma/browser';
	import EmailPrompts, { type EmailKind } from '$lib/components/EmailPrompts.svelte';

	type Assignment = {
		id: string;
		eventId: string;
		title: string;
		type: string;
		startTime: Date;
		endTime: Date;
		location: string;
		role: string;
		status: string;
		confirmations: unknown;
		reminders: unknown;
		cancellations: unknown;
	};
	type EventChoice = { id: string; title: string; type: string; startTime: Date; endTime: Date; location: string };

	let {
		volunteerId,
		assignments,
		events,
		emailEnabled
	}: {
		/** null for a volunteer who hasn't been saved yet */
		volunteerId: string | null;
		assignments: Assignment[];
		events: EventChoice[];
		emailEnabled: boolean;
	} = $props();

	let emailPrompts: ReturnType<typeof EmailPrompts> | undefined = $state();

	const MAX_SHOWN = 100; // events listed at once in the picker

	// ------------------------------------------------------------------ formatting

	const fmtDate = (d: Date) =>
		new Date(d).toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
	const fmtTime = (d: Date) => new Date(d).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
	const fmtDateTime = (d: Date) =>
		new Date(d).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	const statusName = (value: string) => volunteerAssignmentStatusOptions.find((o) => o.value === value)?.name ?? value;

	function statusColor(status: string): 'green' | 'yellow' | 'red' | 'gray' | 'blue' {
		switch (status) {
			case VolunteerAssignmentsStatus.ACTIVE:
				return 'green';
			case VolunteerAssignmentsStatus.PENDING:
				return 'yellow';
			case VolunteerAssignmentsStatus.NO_SHOW:
				return 'red';
			case VolunteerAssignmentsStatus.COMPLETE:
				return 'blue';
			default:
				return 'gray';
		}
	}

	// Selectable cards, written out so they read clearly in light and dark mode
	const choiceOn =
		'border-primary-600 bg-primary-50 text-gray-900 ring-2 ring-primary-600 dark:border-primary-400 dark:bg-gray-700 dark:text-white dark:ring-primary-400';
	const choiceOff =
		'border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
	const choiceDisabled =
		'border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400';
	const radioClass = 'h-5 w-5 shrink-0 cursor-pointer accent-primary-600 dark:accent-primary-400';

	// ------------------------------------------------------------------ emails

	type ListedKind = 'confirmation' | 'reminder';
	const KINDS: { kind: ListedKind; label: string; sent: string }[] = [
		{ kind: 'confirmation', label: 'Confirmation', sent: 'Confirmation sent' },
		{ kind: 'reminder', label: 'Reminder', sent: 'Reminder sent' }
	];

	/** Every time this kind of email was sent, oldest first. */
	function sentList(a: Assignment, kind: EmailKind): { sentAt: Date; to: string[] }[] {
		const raw = kind === 'confirmation' ? a.confirmations : kind === 'reminder' ? a.reminders : a.cancellations;
		if (!Array.isArray(raw)) return [];
		return (raw as { sentAt?: string; to?: string[] }[])
			.filter((e) => e && e.sentAt)
			.map((e) => ({ sentAt: new Date(e.sentAt as string), to: Array.isArray(e.to) ? e.to : [] }));
	}

	/** The groups shown in the details: confirmations, reminders, and cancellations once one was sent. */
	function sentGroups(a: Assignment): { kind: EmailKind; label: string }[] {
		const groups: { kind: EmailKind; label: string }[] = KINDS.map((k) => ({ kind: k.kind, label: k.label }));
		if (sentList(a, 'cancellation').length > 0) groups.push({ kind: 'cancellation', label: 'Cancellation' });
		return groups;
	}

	const canEmail = (a: Assignment) => emailEnabled && a.status === VolunteerAssignmentsStatus.ACTIVE;
	const emailTitle = (a: Assignment) =>
		!emailEnabled
			? 'Email is not set up on this server'
			: a.status !== VolunteerAssignmentsStatus.ACTIVE
				? 'Only active assignments can be emailed'
				: '';

	/** A Send button in the list or the drawer. */
	function sendFrom(event: MouseEvent | undefined, a: Assignment, kind: ListedKind) {
		event?.stopPropagation(); // don't open the edit drawer
		void emailPrompts?.start(a.id, kind, false);
	}

	// ------------------------------------------------------------------ add to an event

	let newOpen = $state(false);
	let filter = $state('');
	let chosenEvent = $state<string | null>(null);
	let newRole = $state('');
	let saving = $state(false);
	let newError = $state('');

	const assignedEventIds = $derived(new Set(assignments.map((a) => a.eventId)));
	const matching = $derived.by(() => {
		const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
		return events.filter((e) => {
			const text = `${e.title} ${e.type} ${e.location} ${fmtDate(e.startTime)}`.toLowerCase();
			return words.every((w) => text.includes(w));
		});
	});
	const chosen = $derived(events.find((e) => e.id === chosenEvent) ?? null);
	const chosenRoles = $derived(chosen ? rolesFor(chosen.type) : []);
	const canAdd = $derived(!saving && chosen !== null && (chosenRoles.length === 0 || newRole !== ''));

	function openNew() {
		filter = '';
		chosenEvent = null;
		newRole = '';
		newError = '';
		newOpen = true;
	}

	function pickEvent(id: string) {
		chosenEvent = id;
		newRole = '';
		newError = '';
	}

	async function addToEvent() {
		if (!canAdd || !chosen) return;
		saving = true;
		newError = '';

		const result = await callAction('createAssignment', { eventId: chosen.id, role: newRole });
		saving = false;

		if (!result.ok) {
			newError = result.message;
			return;
		}
		newOpen = false;
		await invalidateAll();
		toast('Added to the event');
		await emailPrompts?.start(result.data.assignmentId, 'confirmation', true);
	}

	// ------------------------------------------------------------------ edit

	let editOpen = $state(false);
	let editing = $state<Assignment | null>(null);
	let editStatus = $state<string>(VolunteerAssignmentsStatus.ACTIVE);
	let editRole = $state('');
	let editError = $state('');
	let editBusy = $state(false);
	let confirmDeleteOpen = $state(false);

	/** The roles to choose from; a role saved earlier that is no longer offered is kept so it isn't lost. */
	const editRoleItems = $derived.by(() => {
		if (!editing) return [];
		const roles = rolesFor(editing.type);
		if (editing.role && !roles.includes(editing.role)) roles.push(editing.role);
		return roles.length === 0 ? [] : [{ value: '', name: 'No role' }, ...roles.map((r) => ({ value: r, name: r }))];
	});

	function openEdit(a: Assignment) {
		editing = a;
		editStatus = a.status;
		editRole = a.role;
		editError = '';
		editOpen = true;
	}

	async function saveEdit() {
		if (!editing) return;
		const id = editing.id;
		const cancelling = editStatus === VolunteerAssignmentsStatus.CANCELLED && editing.status !== VolunteerAssignmentsStatus.CANCELLED;
		editBusy = true;
		editError = '';

		const result = await callAction('updateAssignment', { assignmentId: id, status: editStatus, role: editRole });
		editBusy = false;

		if (!result.ok) {
			editError = result.message;
			return;
		}
		editOpen = false;
		await invalidateAll();
		toast('Assignment updated');
		// Cancelled: offer to tell the volunteer
		if (cancelling) await emailPrompts?.start(id, 'cancellation', true);
	}

	async function deleteEditing() {
		if (!editing) return;
		editBusy = true;

		const result = await callAction('deleteAssignment', { assignmentId: editing.id });
		editBusy = false;

		if (!result.ok) {
			confirmDeleteOpen = false;
			editError = result.message;
			return;
		}
		confirmDeleteOpen = false;
		editOpen = false;
		await invalidateAll();
		toast('Removed from the event');
	}
</script>

{#snippet sentBadges(a: Assignment)}
	<div class="flex flex-wrap gap-1">
		{#each KINDS as k (k.kind)}
			{#if sentList(a, k.kind).length > 0}
				<Badge color="green">&#10003; {k.sent}</Badge>
			{:else}
				<Badge color="gray">{k.label} not sent</Badge>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet sendButtons(a: Assignment)}
	<div class="flex flex-wrap gap-2">
		{#each KINDS as k (k.kind)}
			<Button
				type="button"
				size="xs"
				outline
				color="dark"
				disabled={!canEmail(a)}
				title={emailTitle(a)}
				onclick={(e: MouseEvent) => sendFrom(e, a, k.kind)}
			>
				Send {k.label.toLowerCase()}
			</Button>
		{/each}
	</div>
{/snippet}

<section class="rounded-lg bg-white shadow-md dark:bg-gray-800">
	<div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-3 sm:px-5">
		<div>
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Events</h2>
			<p class="text-sm text-gray-600 dark:text-gray-300">Most recent first. Click a row to change it.</p>
		</div>
		{#if volunteerId !== null}
			<Button type="button" outline color="dark" onclick={openNew}>Add to event</Button>
		{/if}
	</div>

	{#if volunteerId === null}
		<p class="px-4 pb-4 text-sm text-gray-600 sm:px-5 dark:text-gray-300">Save the volunteer first, then add them to events.</p>
	{:else if assignments.length === 0}
		<p class="px-4 pb-4 text-sm text-gray-600 sm:px-5 dark:text-gray-300">Not assigned to any events yet.</p>
	{:else}
		<!-- Tablet and desktop: table -->
		<div class="hidden md:block">
			<Table striped={true} hoverable={true}>
				<TableHead>
					<TableHeadCell>When</TableHeadCell>
					<TableHeadCell>Event</TableHeadCell>
					<TableHeadCell>Role</TableHeadCell>
					<TableHeadCell>Status</TableHeadCell>
					<TableHeadCell>Emails</TableHeadCell>
					<TableHeadCell>Send</TableHeadCell>
				</TableHead>
				<TableBody>
					{#each assignments as a (a.id)}
						<TableBodyRow class="cursor-pointer" onclick={() => openEdit(a)}>
							<TableBodyCell>{fmtDate(a.startTime)}, {fmtTime(a.startTime)}</TableBodyCell>
							<TableBodyCell>
								<div class="text-gray-900 dark:text-white">{a.title}</div>
								<div class="text-xs">{a.location}</div>
							</TableBodyCell>
							<TableBodyCell>{a.role}</TableBodyCell>
							<TableBodyCell><Badge color={statusColor(a.status)}>{statusName(a.status)}</Badge></TableBodyCell>
							<TableBodyCell>{@render sentBadges(a)}</TableBodyCell>
							<TableBodyCell>{@render sendButtons(a)}</TableBodyCell>
						</TableBodyRow>
					{/each}
				</TableBody>
			</Table>
		</div>

		<!-- Phones: one card per assignment -->
		<ul class="space-y-3 px-3 pb-4 md:hidden">
			{#each assignments as a (a.id)}
				<li class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
					<button type="button" class="w-full text-left" onclick={() => openEdit(a)}>
						<div class="flex items-start justify-between gap-3">
							<div class="font-semibold text-gray-900 dark:text-white">{fmtDate(a.startTime)}, {fmtTime(a.startTime)}</div>
							<Badge color={statusColor(a.status)}>{statusName(a.status)}</Badge>
						</div>
						<div class="text-sm text-gray-700 dark:text-gray-200">{a.title}{a.role ? ` · ${a.role}` : ''}</div>
						<div class="text-sm text-gray-600 dark:text-gray-300">{a.location}</div>
						<div class="mt-2">{@render sentBadges(a)}</div>
					</button>
					<div class="mt-3">{@render sendButtons(a)}</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<!-- ============================ Add to an event ============================ -->
<Drawer
	placement="bottom"
	bind:open={newOpen}
	class="max-h-[90vh] overflow-y-auto bg-white p-1 text-gray-900 backdrop:bg-black/50 dark:bg-gray-800 dark:text-white"
>
	<div class="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-4 pt-2 pb-8">
		<h3 class="text-lg font-semibold">Add to an event</h3>

		<fieldset>
			<legend class="mb-2 text-sm font-medium">Event</legend>
			<Input
				type="search"
				placeholder="Filter by name, type, place or date"
				bind:value={filter}
				onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && e.preventDefault()}
				class="mb-2"
			/>
			<div class="max-h-64 space-y-2 overflow-y-auto pr-1">
				{#each matching.slice(0, MAX_SHOWN) as e (e.id)}
					{@const taken = assignedEventIds.has(e.id)}
					<label
						class="flex items-center gap-3 rounded-lg border p-3 {taken
							? choiceDisabled
							: chosenEvent === e.id
								? choiceOn + ' cursor-pointer'
								: choiceOff + ' cursor-pointer'}"
					>
						<input
							type="radio"
							name="event"
							class={radioClass}
							disabled={taken}
							checked={chosenEvent === e.id}
							onchange={() => pickEvent(e.id)}
						/>
						<span class="min-w-0 flex-1">
							<span class="block font-medium">
								{fmtDate(e.startTime)}, {fmtTime(e.startTime)} &ndash; {fmtTime(e.endTime)}
							</span>
							<span class="block truncate text-sm {taken ? '' : 'text-gray-600 dark:text-gray-300'}">
								{[e.title, e.type !== e.title ? e.type : '', e.location].filter(Boolean).join(' · ')}
							</span>
						</span>
						{#if taken}<Badge color="gray">Already assigned</Badge>{/if}
					</label>
				{/each}
			</div>
			{#if matching.length === 0}
				<Helper class="mt-2">No events match.</Helper>
			{:else if matching.length > MAX_SHOWN}
				<Helper class="mt-2">Showing the first {MAX_SHOWN} of {matching.length}. Type to narrow the list.</Helper>
			{/if}
		</fieldset>

		{#if chosen && chosenRoles.length > 0}
			<div class="max-w-xs">
				<Label for="new-role" class="mb-2">Role</Label>
				<Select
					id="new-role"
					items={[{ value: '', name: 'Choose a role' }, ...chosenRoles.map((r) => ({ value: r, name: r }))]}
					bind:value={newRole}
				/>
			</div>
		{:else if chosen}
			<p class="text-sm text-gray-600 dark:text-gray-300">{chosen.type} events have no roles to choose from.</p>
		{/if}

		{#if newError}
			<p class="text-sm text-red-600 dark:text-red-400" role="alert">{newError}</p>
		{/if}

		<div class="flex gap-2">
			<Button type="button" outline color="dark" disabled={!canAdd} onclick={addToEvent}>
				{saving ? 'Adding…' : 'Add'}
			</Button>
			<Button type="button" outline color="dark" onclick={() => (newOpen = false)}>Cancel</Button>
		</div>
	</div>
</Drawer>

<!-- ============================ Edit an assignment ============================ -->
<Drawer
	placement="bottom"
	bind:open={editOpen}
	class="max-h-[90vh] overflow-y-auto bg-white p-1 text-gray-900 backdrop:bg-black/50 dark:bg-gray-800 dark:text-white"
>
	{#if editing}
		<div class="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-4 pt-2 pb-8">
			<div>
				<h3 class="text-lg font-semibold">{editing.title}</h3>
				<p class="text-sm text-gray-600 dark:text-gray-300">
					{fmtDate(editing.startTime)}, {fmtTime(editing.startTime)} &ndash; {fmtTime(editing.endTime)} · {editing.location}
				</p>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="min-w-0">
					<Label for="edit-status" class="mb-2">Status</Label>
					<Select id="edit-status" items={volunteerAssignmentStatusOptions} bind:value={editStatus} />
				</div>
				{#if editRoleItems.length > 0}
					<div class="min-w-0">
						<Label for="edit-role" class="mb-2">Role</Label>
						<Select id="edit-role" items={editRoleItems} bind:value={editRole} />
					</div>
				{/if}
			</div>

			<!-- When the emails were sent -->
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each sentGroups(editing) as k (k.kind)}
					{@const sends = sentList(editing, k.kind)}
					<div class="min-w-0">
						<h4 class="mb-1 text-sm font-medium">{k.label} emails</h4>
						{#if sends.length === 0}
							<p class="text-sm text-gray-600 dark:text-gray-300">Not sent yet.</p>
						{:else}
							<ul class="space-y-1 text-sm text-gray-700 dark:text-gray-200">
								{#each sends.toReversed() as e, i (i)}
									<li class="break-words">{fmtDateTime(e.sentAt)}{e.to.length ? ` to ${e.to.join(', ')}` : ''}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/each}
			</div>

			{#if editError}
				<p class="text-sm text-red-600 dark:text-red-400" role="alert">{editError}</p>
			{/if}

			<div class="flex flex-wrap gap-2">
				<Button type="button" outline color="dark" disabled={editBusy} onclick={saveEdit}>Save</Button>
				<Button type="button" outline color="dark" onclick={() => (editOpen = false)}>Close</Button>
				{#each KINDS as k (k.kind)}
					<Button
						type="button"
						outline
						color="dark"
						disabled={!canEmail(editing)}
						title={emailTitle(editing)}
						onclick={() => {
							const a = editing;
							editOpen = false;
							if (a) sendFrom(undefined, a, k.kind);
						}}
					>
						Send {k.label.toLowerCase()}
					</Button>
				{/each}
				<Button type="button" outline color="red" class="sm:ml-auto" onclick={() => (confirmDeleteOpen = true)}>Delete</Button>
			</div>
		</div>
	{/if}
</Drawer>

<Modal title="Remove from event" bind:open={confirmDeleteOpen} size="xs">
	<p class="text-gray-600 dark:text-gray-300">
		Remove this volunteer from the event? To keep a record that they were scheduled, set the status to Cancelled instead.
	</p>
	{#snippet footer()}
		<Button type="button" color="red" disabled={editBusy} onclick={deleteEditing}>Yes, remove</Button>
		<Button type="button" outline color="dark" onclick={() => (confirmDeleteOpen = false)}>Cancel</Button>
	{/snippet}
</Modal>

<EmailPrompts bind:this={emailPrompts} {emailEnabled} previewAction="previewEmail" sendAction="sendEmail" idField="assignmentId" audience="volunteer" />
