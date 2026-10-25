<script lang="ts">
	import {
		Alert,
		Badge,
		Button,
		Checkbox,
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
		TableHeadCell,
		Textarea
	} from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { deserialize } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { appointmentBookingStatusOptions } from '$lib/labels';
	import { AppointmentBookingStatus } from '$prisma/browser';
	import type { BookingRow, AvailableService } from '$lib/types/bookings';

	let {
		bookings,
		services,
		eligibleDate,
		emailEnabled,
		form
	}: {
		bookings: BookingRow[];
		services: AvailableService[];
		eligibleDate: Date | null;
		emailEnabled: boolean;
		form: any; // the household superForm store, used to keep the Special Requests tab in step
	} = $props();

	const UNSCHEDULED = 'unscheduled';
	const MAX_REQUEST_LENGTH = 1000;

	// ------------------------------------------------------------------ formatting

	const fmtDate = (d: Date) =>
		d.toLocaleDateString('en-CA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
	const fmtTime = (d: Date) => d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
	const statusName = (value: string) =>
		appointmentBookingStatusOptions.find((o) => o.value === value)?.name ?? value;

	function statusColor(status: string): 'green' | 'yellow' | 'red' | 'gray' | 'blue' {
		switch (status) {
			case AppointmentBookingStatus.ACTIVE:
				return 'green';
			case AppointmentBookingStatus.PENDING:
				return 'yellow';
			case AppointmentBookingStatus.NO_SHOW:
				return 'red';
			case AppointmentBookingStatus.COMPLETE:
				return 'blue';
			default:
				return 'gray';
		}
	}

	function whenText(b: BookingRow): string {
		return b.appointment
			? `${fmtDate(b.appointment.startTime)}, ${fmtTime(b.appointment.startTime)}`
			: 'Unscheduled';
	}

	/** When the last confirmation email for this booking was sent, if ever. */
	function confirmationSentAt(b: BookingRow): Date | null {
		const list = Array.isArray(b.confirmations) ? b.confirmations : [];
		const last = list[list.length - 1] as { sentAt?: string } | undefined;
		return last?.sentAt ? new Date(last.sentAt) : null;
	}

	// ------------------------------------------------------------------ talking to the server

	type CallResult = { ok: true; data: any } | { ok: false; message: string; code?: string; data?: any };

	// The household page is one big <form>, so the actions are called with fetch
	// instead of nested forms.
	async function callAction(name: string, fields: Record<string, string>): Promise<CallResult> {
		const body = new FormData();
		for (const [key, value] of Object.entries(fields)) body.append(key, value);

		try {
			const response = await fetch(`?/${name}`, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await response.text());

			if (result.type === 'success') return { ok: true, data: result.data ?? {} };
			if (result.type === 'failure') {
				const data = (result.data ?? {}) as { message?: string; code?: string };
				return { ok: false, message: data.message ?? 'The request failed.', code: data.code, data };
			}
			if (result.type === 'redirect') {
				await goto(result.location); // for example, the session has expired
				return { ok: false, message: 'Please sign in again.' };
			}
			return { ok: false, message: result.error?.message ?? 'The request failed.' };
		} catch {
			return { ok: false, message: 'The request failed. Check your connection and try again.' };
		}
	}

	/**
	 * Special requests are saved by the server, but the household form also holds them and
	 * would delete or overwrite them on its next Save. Mirror the change into the form
	 * without marking the form as changed.
	 */
	function syncSpecialRequest(saved: any | null, removedId: string | null) {
		form.update(
			($f: any) => {
				if (removedId) $f.datedRequests = $f.datedRequests.filter((r: any) => r.id !== removedId);
				if (saved) {
					const i = $f.datedRequests.findIndex((r: any) => r.id === saved.id);
					if (i >= 0) $f.datedRequests[i] = { ...$f.datedRequests[i], ...saved };
					else $f.datedRequests.push(saved);
				}
				return $f;
			},
			{ taint: false }
		);
	}

	// ------------------------------------------------------------------ new booking drawer

	let newOpen = $state(false);
	let selectedService = $state<string | null>(null); // a service id, or UNSCHEDULED
	let selectedAppointment = $state<string | null>(null);
	let newRequest = $state('');
	let acknowledgedEarly = $state(false);
	let saving = $state(false);
	let newError = $state('');

	const service = $derived(services.find((s) => s.id === selectedService) ?? null);
	const isEarly = $derived(
		!!service && !!eligibleDate && service.startTime.getTime() < eligibleDate.getTime()
	);
	const canBook = $derived(
		!saving &&
			selectedService !== null &&
			(selectedService === UNSCHEDULED || selectedAppointment !== null) &&
			(!isEarly || acknowledgedEarly)
	);

	function openNew() {
		selectedService = null;
		selectedAppointment = null;
		newRequest = '';
		acknowledgedEarly = false;
		newError = '';
		newOpen = true;
	}

	function pickService(id: string) {
		selectedService = id;
		selectedAppointment = null;
		acknowledgedEarly = false;
		newError = '';
	}

	async function saveNew() {
		if (!canBook) return;
		saving = true;
		newError = '';

		const result = await callAction('createBooking', {
			appointmentId: selectedService === UNSCHEDULED ? '' : (selectedAppointment ?? ''),
			specialRequest: newRequest.trim(),
			acknowledgedEarly: acknowledgedEarly ? 'true' : 'false'
		});
		saving = false;

		if (!result.ok) {
			newError = result.message;
			if (result.code !== 'not-eligible') await invalidateAll(); // the slot may be gone: refresh the list
			return;
		}

		newOpen = false;
		syncSpecialRequest(result.data.datedRequest ?? null, null);
		await invalidateAll();
		toast('Booking created');
		await startEmailFlow(result.data.bookingId, true);
	}

	// ------------------------------------------------------------------ edit drawer

	let editOpen = $state(false);
	let editing = $state<BookingRow | null>(null);
	let editStatus = $state<string>(AppointmentBookingStatus.ACTIVE);
	let editRequest = $state('');
	let editError = $state('');
	let editBusy = $state(false);
	let confirmDeleteOpen = $state(false);

	function openEdit(b: BookingRow) {
		editing = b;
		editStatus = b.status;
		editRequest = b.datedRequest?.requestText ?? '';
		editError = '';
		editOpen = true;
	}

	async function saveEdit() {
		if (!editing) return;
		editBusy = true;
		editError = '';

		const result = await callAction('updateBooking', {
			bookingId: editing.id,
			status: editStatus,
			specialRequest: editRequest.trim()
		});
		editBusy = false;

		if (!result.ok) {
			editError = result.message;
			return;
		}
		syncSpecialRequest(result.data.datedRequest ?? null, result.data.removedRequestId ?? null);
		editOpen = false;
		await invalidateAll();
		toast('Booking updated');
	}

	async function deleteEditing() {
		if (!editing) return;
		editBusy = true;

		const result = await callAction('deleteBooking', { bookingId: editing.id });
		editBusy = false;

		if (!result.ok) {
			confirmDeleteOpen = false;
			editError = result.message;
			return;
		}
		syncSpecialRequest(null, result.data.removedRequestId ?? null);
		confirmDeleteOpen = false;
		editOpen = false;
		await invalidateAll();
		toast('Booking deleted');
	}

	// ------------------------------------------------------------------ confirmation email

	type Draft = { bookingId: string; to: { name: string; email: string }[]; subject: string; body: string };

	let draft = $state<Draft | null>(null);
	let askSendOpen = $state(false); // "Send a confirmation email?"
	let askCustomizeOpen = $state(false); // "Customize it first?"
	let editEmailOpen = $state(false); // the editor
	let emailBusy = $state(false);

	const recipientText = $derived(draft ? draft.to.map((r) => `${r.name} <${r.email}>`).join(', ') : '');

	/** Loads the message the template produces, then starts the prompts. */
	async function startEmailFlow(bookingId: string, askIfWanted: boolean) {
		if (!emailEnabled) return;

		const result = await callAction('previewConfirmation', { bookingId });
		if (!result.ok) {
			toast(result.message);
			return;
		}
		draft = { bookingId, to: result.data.to, subject: result.data.subject, body: result.data.body };
		if (askIfWanted) askSendOpen = true;
		else askCustomizeOpen = true;
	}

	function answerSend(yes: boolean) {
		askSendOpen = false;
		if (yes) askCustomizeOpen = true;
		else draft = null;
	}

	function answerCustomize(yes: boolean) {
		askCustomizeOpen = false;
		if (yes) editEmailOpen = true;
		else void sendDraft(false);
	}

	function closeEmailEditor() {
		editEmailOpen = false;
		draft = null;
	}

	/** `edited` = send the text from the editor instead of the template text. */
	async function sendDraft(edited: boolean) {
		if (!draft) return;
		emailBusy = true;

		const result = await callAction('sendConfirmation', {
			bookingId: draft.bookingId,
			...(edited ? { subject: draft.subject, body: draft.body } : {})
		});
		emailBusy = false;

		if (!result.ok) {
			toast(result.message);
			return; // leave the editor open so nothing typed is lost
		}
		const count = result.data.to?.length ?? 0;
		editEmailOpen = false;
		draft = null;
		toast(`Confirmation email sent to ${count} ${count === 1 ? 'person' : 'people'}`);
		await invalidateAll();
	}

	/** "Send" button in the list. */
	function sendFromList(event: MouseEvent, b: BookingRow) {
		event.stopPropagation(); // don't open the edit drawer
		void startEmailFlow(b.id, false);
	}

	/** Pressing Enter in a text input must not save the whole household form. */
	function ignoreEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') event.preventDefault();
	}
</script>

<!-- Confirmation column: when it was sent, or a Send button -->
{#snippet confirmationCell(b: BookingRow)}
	{@const sentAt = confirmationSentAt(b)}
	{#if sentAt}
		<span class="text-sm">Sent {fmtDate(sentAt)}</span>
	{/if}
	{#if emailEnabled && b.status === AppointmentBookingStatus.ACTIVE}
		<button
			type="button"
			class="text-primary-600 dark:text-primary-500 block font-medium hover:underline"
			onclick={(e) => sendFromList(e, b)}
		>
			{sentAt ? 'Send again' : 'Send'}
		</button>
	{:else if !sentAt}
		<span class="text-gray-400">&ndash;</span>
	{/if}
{/snippet}

<!-- Heading and action, shared by both layouts -->
<div class="flex flex-wrap items-center justify-between gap-2 bg-white px-5 pb-3 pt-3 dark:bg-gray-800">
	<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Appointments</h2>
	<Button type="button" outline color="dark" onclick={openNew}>New Booking</Button>
</div>

{#if bookings.length === 0}
	<p class="px-5 pb-5 text-gray-500 dark:text-gray-400">No bookings yet.</p>
{:else}
	<!-- Tablet and desktop: table -->
	<div class="hidden md:block">
		<Table striped={true} hoverable={true}>
			<TableHead>
				<TableHeadCell>When</TableHeadCell>
				<TableHeadCell>Location</TableHeadCell>
				<TableHeadCell>Status</TableHeadCell>
				<TableHeadCell>Special request</TableHeadCell>
				<TableHeadCell>Confirmation</TableHeadCell>
			</TableHead>
			<TableBody>
				{#each bookings as b (b.id)}
					<TableBodyRow class="cursor-pointer" onclick={() => openEdit(b)}>
						<TableBodyCell>{whenText(b)}</TableBodyCell>
						<TableBodyCell>{b.appointment?.event.location.name ?? ''}</TableBodyCell>
						<TableBodyCell>
							<Badge color={statusColor(b.status)}>{statusName(b.status)}</Badge>
						</TableBodyCell>
						<TableBodyCell class="max-w-xs truncate">{b.datedRequest?.requestText ?? ''}</TableBodyCell>
						<TableBodyCell>{@render confirmationCell(b)}</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	</div>

	<!-- Phones: one card per booking -->
	<ul class="space-y-3 px-3 pb-4 md:hidden">
		{#each bookings as b (b.id)}
			<li class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
				<button type="button" class="w-full text-left" onclick={() => openEdit(b)}>
					<div class="flex items-start justify-between gap-3">
						<div class="font-semibold text-gray-900 dark:text-white">{whenText(b)}</div>
						<Badge color={statusColor(b.status)}>{statusName(b.status)}</Badge>
					</div>
					{#if b.appointment}
						<div class="text-sm text-gray-500 dark:text-gray-400">{b.appointment.event.location.name}</div>
					{/if}
					{#if b.datedRequest?.requestText}
						<div class="mt-1 text-sm text-gray-700 dark:text-gray-300">{b.datedRequest.requestText}</div>
					{/if}
				</button>
				<div class="mt-2 text-sm text-gray-600 dark:text-gray-300">
					{@render confirmationCell(b)}
				</div>
			</li>
		{/each}
	</ul>
{/if}

<!-- ============================ New booking ============================ -->
<Drawer
	placement="bottom"
	bind:open={newOpen}
	class="max-h-[85vh] overflow-y-auto bg-white p-1 text-gray-900 backdrop:bg-black/50 dark:bg-gray-800 dark:text-white"
>
	<div class="mx-auto w-full max-w-3xl space-y-5 px-4 pb-8 pt-2">
		<h3 class="text-lg font-semibold">New booking</h3>

		<!-- 1. Service date -->
		<fieldset>
			<legend class="mb-2 text-sm font-medium">Service date</legend>
			<div class="max-h-64 space-y-2 overflow-y-auto pr-1">
				<label
					class="flex cursor-pointer items-center gap-3 rounded-lg border p-3
					{selectedService === UNSCHEDULED
						? 'border-primary-600 bg-primary-50 dark:bg-gray-700'
						: 'border-gray-200 dark:border-gray-700'}"
				>
					<input
						type="radio"
						name="service"
						value={UNSCHEDULED}
						checked={selectedService === UNSCHEDULED}
						onchange={() => pickService(UNSCHEDULED)}
					/>
					<span class="flex-1">
						<span class="block font-medium">Unscheduled</span>
						<span class="block text-sm text-gray-500 dark:text-gray-400">No appointment time is set</span>
					</span>
				</label>

				{#each services as s (s.id)}
					<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border p-3
						{selectedService === s.id
							? 'border-primary-600 bg-primary-50 dark:bg-gray-700'
							: 'border-gray-200 dark:border-gray-700'}"
					>
						<input
							type="radio"
							name="service"
							value={s.id}
							checked={selectedService === s.id}
							onchange={() => pickService(s.id)}
						/>
						<span class="flex-1">
							<span class="block font-medium">
								{fmtDate(s.startTime)}, {fmtTime(s.startTime)} &ndash; {fmtTime(s.endTime)}
							</span>
							<span class="block text-sm text-gray-500 dark:text-gray-400">
								{[s.title, s.location.name].filter(Boolean).join(' · ')}
							</span>
						</span>
						<Badge color="green">{s.openCount} open</Badge>
					</label>
				{/each}
			</div>
			{#if services.length === 0}
				<Helper class="mt-2">No future service dates have open appointments.</Helper>
			{/if}
		</fieldset>

		<!-- 2. Before the household is eligible -->
		{#if isEarly && eligibleDate}
			<Alert color="yellow">
				<span class="font-medium">Before this household is eligible.</span>
				This household is next eligible on {fmtDate(eligibleDate)}, and this service date is earlier.
				<div class="mt-2">
					<Checkbox bind:checked={acknowledgedEarly}>I understand, book it anyway</Checkbox>
				</div>
			</Alert>
		{/if}

		<!-- 3. Time -->
		{#if service}
			<fieldset>
				<legend class="mb-2 text-sm font-medium">Time</legend>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each service.appointments as a (a.id)}
						<label
							class="cursor-pointer rounded-lg border px-3 py-2 text-center
							{selectedAppointment === a.id
								? 'border-primary-600 bg-primary-50 font-semibold dark:bg-gray-700'
								: 'border-gray-200 dark:border-gray-700'}"
						>
							<input
								type="radio"
								name="appointment"
								class="sr-only"
								value={a.id}
								checked={selectedAppointment === a.id}
								onchange={() => (selectedAppointment = a.id)}
							/>
							{fmtTime(a.startTime)}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<!-- 4. Special request -->
		<div>
			<Label for="new-request" class="mb-2">Special request (optional)</Label>
			<Textarea id="new-request" rows={3} maxlength={MAX_REQUEST_LENGTH} bind:value={newRequest} />
		</div>

		{#if newError}
			<p class="text-sm text-red-600 dark:text-red-500" role="alert">{newError}</p>
		{/if}

		<div class="flex gap-2">
			<Button type="button" outline color="dark" disabled={!canBook} onclick={saveNew}>
				{saving ? 'Booking…' : 'Book'}
			</Button>
			<Button type="button" outline color="dark" onclick={() => (newOpen = false)}>Cancel</Button>
		</div>
	</div>
</Drawer>

<!-- ============================ Edit booking ============================ -->
<Drawer
	placement="bottom"
	bind:open={editOpen}
	class="max-h-[85vh] overflow-y-auto bg-white p-1 text-gray-900 backdrop:bg-black/50 dark:bg-gray-800 dark:text-white"
>
	{#if editing}
		<div class="mx-auto w-full max-w-3xl space-y-5 px-4 pb-8 pt-2">
			<div>
				<h3 class="text-lg font-semibold">{whenText(editing)}</h3>
				{#if editing.appointment}
					<p class="text-sm text-gray-500 dark:text-gray-400">
						{[editing.appointment.event.title, editing.appointment.event.location.name].filter(Boolean).join(' · ')}
					</p>
				{/if}
			</div>

			<div class="max-w-xs">
				<Label for="edit-status" class="mb-2">Status</Label>
				<Select id="edit-status" items={appointmentBookingStatusOptions} bind:value={editStatus} />
			</div>

			<div>
				<Label for="edit-request" class="mb-2">Special request</Label>
				<Textarea id="edit-request" rows={3} maxlength={MAX_REQUEST_LENGTH} bind:value={editRequest} />
				<Helper class="mt-1">Clear the text to remove the special request.</Helper>
			</div>

			{#if editError}
				<p class="text-sm text-red-600 dark:text-red-500" role="alert">{editError}</p>
			{/if}

			<div class="flex flex-wrap gap-2">
				<Button type="button" outline color="dark" disabled={editBusy} onclick={saveEdit}>Save</Button>
				<Button type="button" outline color="dark" onclick={() => (editOpen = false)}>Close</Button>
				{#if emailEnabled && editing.status === AppointmentBookingStatus.ACTIVE}
					<Button
						type="button"
						outline
						color="dark"
						onclick={() => {
							const id = editing?.id;
							editOpen = false;
							if (id) void startEmailFlow(id, false);
						}}
					>
						Send confirmation email
					</Button>
				{/if}
				<Button type="button" outline color="red" class="sm:ml-auto" onclick={() => (confirmDeleteOpen = true)}>
					Delete
				</Button>
			</div>
		</div>
	{/if}
</Drawer>

<Modal title="Delete booking" bind:open={confirmDeleteOpen} size="xs">
	<p class="text-gray-600 dark:text-gray-300">
		Delete this booking? Its special request is deleted with it, and the appointment becomes available again.
	</p>
	{#snippet footer()}
		<Button type="button" color="red" disabled={editBusy} onclick={deleteEditing}>Yes, delete it</Button>
		<Button type="button" outline color="dark" onclick={() => (confirmDeleteOpen = false)}>Cancel</Button>
	{/snippet}
</Modal>

<!-- ============================ Confirmation email ============================ -->
<Modal title="Confirmation email" bind:open={askSendOpen} size="xs">
	<p class="text-gray-600 dark:text-gray-300">
		Send a confirmation email to the primary {draft && draft.to.length > 1 ? 'members' : 'member'}?
	</p>
	<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{recipientText}</p>
	{#snippet footer()}
		<Button type="button" color="dark" onclick={() => answerSend(true)}>Yes</Button>
		<Button type="button" outline color="dark" onclick={() => answerSend(false)}>No</Button>
	{/snippet}
</Modal>

<Modal title="Customize the email?" bind:open={askCustomizeOpen} size="xs">
	<p class="text-gray-600 dark:text-gray-300">
		Would you like to review and change the message before it is sent?
	</p>
	<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{recipientText}</p>
	{#snippet footer()}
		<Button type="button" color="dark" disabled={emailBusy} onclick={() => answerCustomize(true)}>
			Yes, let me edit it
		</Button>
		<Button type="button" outline color="dark" disabled={emailBusy} onclick={() => answerCustomize(false)}>
			{emailBusy ? 'Sending…' : 'No, send it'}
		</Button>
	{/snippet}
</Modal>

<Modal title="Edit the email" bind:open={editEmailOpen} size="lg" onclose={() => (draft = null)}>
	{#if draft}
		<div class="space-y-4">
			<p class="text-sm text-gray-500 dark:text-gray-400">To: {recipientText}</p>
			<div>
				<Label for="email-subject" class="mb-2">Subject</Label>
				<Input id="email-subject" type="text" maxlength={200} bind:value={draft.subject} onkeydown={ignoreEnter} />
			</div>
			<div>
				<Label for="email-body" class="mb-2">Message</Label>
				<Textarea id="email-body" rows={12} maxlength={10000} bind:value={draft.body} />
			</div>
		</div>
	{/if}
	{#snippet footer()}
		<Button type="button" color="dark" disabled={emailBusy} onclick={() => sendDraft(true)}>
			{emailBusy ? 'Sending…' : 'Send'}
		</Button>
		<Button type="button" outline color="dark" disabled={emailBusy} onclick={closeEmailEditor}>Cancel</Button>
	{/snippet}
</Modal>
