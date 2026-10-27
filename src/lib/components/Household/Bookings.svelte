<script lang="ts">
	import {
		Alert,
		Badge,
		Button,
		Datepicker,
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
	import EmailPrompts, { type EmailKind } from '$lib/components/EmailPrompts.svelte';

	let {
		bookings,
		services,
		sites,
		eligibleDate,
		emailEnabled,
		form
	}: {
		bookings: BookingRow[];
		services: AvailableService[];
		sites: { id: string; name: string }[];
		eligibleDate: Date | null;
		emailEnabled: boolean;
		form: any; // the household superForm store, used to keep the Special Requests tab in step
	} = $props();


	// Selectable cards, checkboxes and radios, written out so they read clearly in light and dark mode
	const choiceOn =
		'border-primary-600 bg-primary-50 text-gray-900 ring-2 ring-primary-600 dark:border-primary-400 dark:bg-gray-700 dark:text-white dark:ring-primary-400';
	const choiceOff =
		'border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
	const radioClass = 'h-5 w-5 shrink-0 cursor-pointer accent-primary-600 dark:accent-primary-400';
	const checkClass = 'h-5 w-5 shrink-0 cursor-pointer rounded accent-primary-600 dark:accent-primary-400';

	let emailPrompts: ReturnType<typeof EmailPrompts> | undefined = $state();

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

	const fmtDateTime = (d: Date) =>
		d.toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

	/** "HH:MM" for an <input type="time"> */
	const toTimeInput = (d: Date) =>
		`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

	/** A day from the date picker plus "HH:MM" from the time input. */
	function combine(day: Date, time: string): Date {
		const [h, m] = time.split(':').map(Number);
		const d = new Date(day);
		d.setHours(h, m, 0, 0);
		return d;
	}

	/** The day and time of a booking: its appointment, or the planned time of an unscheduled one. */
	const startOf = (b: BookingRow): Date | null => b.appointment?.startTime ?? b.plannedStart ?? null;
	const siteNameOf = (b: BookingRow): string => b.appointment?.event.location.name ?? b.plannedSite?.name ?? '';

	function whenText(b: BookingRow): string {
		if (b.appointment) return `${fmtDate(b.appointment.startTime)}, ${fmtTime(b.appointment.startTime)}`;
		if (b.plannedStart) return `Unscheduled (${fmtDate(b.plannedStart)}, ${fmtTime(b.plannedStart)})`;
		return 'Unscheduled';
	}

	// ------------------------------------------------------------------ emails sent

	// Confirmations and reminders have buttons; a cancellation email is offered when a booking is cancelled
	type ListedKind = 'confirmation' | 'reminder';
	const KINDS: { kind: ListedKind; label: string; sent: string }[] = [
		{ kind: 'confirmation', label: 'Confirmation', sent: 'Confirmation sent' },
		{ kind: 'reminder', label: 'Reminder', sent: 'Reminder sent' }
	];

	/** The groups shown in the details: confirmations, reminders, and cancellations once one was sent. */
	function sentGroups(b: BookingRow): { kind: EmailKind; label: string }[] {
		const groups: { kind: EmailKind; label: string }[] = KINDS.map((k) => ({ kind: k.kind, label: k.label }));
		if (sentList(b, 'cancellation').length > 0) groups.push({ kind: 'cancellation', label: 'Cancellation' });
		return groups;
	}

	/** Every time this kind of email was sent for the booking, oldest first. */
	function sentList(b: BookingRow, kind: EmailKind): { sentAt: Date; to: string[] }[] {
		const raw = kind === 'confirmation' ? b.confirmations : kind === 'reminder' ? b.reminders : b.cancellations;
		if (!Array.isArray(raw)) return [];
		return (raw as { sentAt?: string; to?: string[] }[])
			.filter((e) => e && e.sentAt)
			.map((e) => ({ sentAt: new Date(e.sentAt as string), to: Array.isArray(e.to) ? e.to : [] }));
	}

	/** Email buttons work for active bookings; a reminder also needs a date and time. */
	function canEmail(b: BookingRow, kind: ListedKind): boolean {
		return emailEnabled && b.status === AppointmentBookingStatus.ACTIVE && (kind === 'confirmation' || startOf(b) !== null);
	}

	function emailTitle(b: BookingRow, kind: ListedKind): string {
		if (!emailEnabled) return 'Email is not set up on this server';
		if (b.status !== AppointmentBookingStatus.ACTIVE) return 'Only active bookings can be emailed';
		if (kind === 'reminder' && !startOf(b)) return 'This booking has no date and time yet';
		return '';
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
	let plannedDate = $state<Date | undefined>(undefined); // unscheduled only
	let plannedTime = $state('');
	let plannedSiteId = $state('');
	let newRequest = $state('');
	let acknowledgedEarly = $state(false);
	let saving = $state(false);
	let newError = $state('');

	const service = $derived(services.find((s) => s.id === selectedService) ?? null);
	// An unscheduled booking may have a planned day and time, but not one without the other
	const plannedIncomplete = $derived(selectedService === UNSCHEDULED && !!plannedDate !== !!plannedTime);
	const plannedStart = $derived(
		selectedService === UNSCHEDULED && plannedDate && plannedTime ? combine(plannedDate, plannedTime) : null
	);
	const targetStart = $derived(service ? service.startTime : plannedStart);
	const isEarly = $derived(!!targetStart && !!eligibleDate && targetStart.getTime() < eligibleDate.getTime());
	const canBook = $derived(
		!saving &&
			selectedService !== null &&
			(selectedService === UNSCHEDULED ? !plannedIncomplete : selectedAppointment !== null) &&
			(!isEarly || acknowledgedEarly)
	);

	const siteItems = $derived([{ value: '', name: 'No location' }, ...sites.map((s) => ({ value: s.id, name: s.name }))]);

	function openNew() {
		selectedService = null;
		selectedAppointment = null;
		plannedDate = undefined;
		plannedTime = '';
		plannedSiteId = '';
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
			acknowledgedEarly: acknowledgedEarly ? 'true' : 'false',
			plannedStart: plannedStart ? plannedStart.toISOString() : '',
			plannedSiteId: selectedService === UNSCHEDULED ? plannedSiteId : ''
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
		await emailPrompts?.start(result.data.bookingId, 'confirmation', true);
	}

	// ------------------------------------------------------------------ edit drawer

	let editOpen = $state(false);
	let editing = $state<BookingRow | null>(null);
	let editStatus = $state<string>(AppointmentBookingStatus.ACTIVE);
	let editRequest = $state('');
	let editDate = $state<Date | undefined>(undefined); // unscheduled bookings only
	let editTime = $state('');
	let editSiteId = $state('');
	let editError = $state('');
	let editBusy = $state(false);
	let confirmDeleteOpen = $state(false);

	function openEdit(b: BookingRow) {
		editing = b;
		editStatus = b.status;
		editRequest = b.datedRequest?.requestText ?? '';
		editDate = b.plannedStart ? new Date(b.plannedStart) : undefined;
		editTime = b.plannedStart ? toTimeInput(b.plannedStart) : '';
		editSiteId = b.plannedSiteId ?? '';
		editError = '';
		editOpen = true;
	}

	async function saveEdit() {
		if (!editing) return;
		const cancelling = editStatus === AppointmentBookingStatus.CANCELLED && editing.status !== AppointmentBookingStatus.CANCELLED;
		const bookingId = editing.id;
		if (!editing.appointment && !!editDate !== !!editTime) {
			editError = 'Choose both a date and a time, or clear both.';
			return;
		}
		editBusy = true;
		editError = '';

		const result = await callAction('updateBooking', {
			bookingId: editing.id,
			status: editStatus,
			specialRequest: editRequest.trim(),
			// Only unscheduled bookings have a planned time and place
			...(editing.appointment
				? {}
				: {
						plannedStart: editDate && editTime ? combine(editDate, editTime).toISOString() : '',
						plannedSiteId: editSiteId
					})
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
		// Cancelled: offer to tell the household
		if (cancelling) await emailPrompts?.start(bookingId, 'cancellation', true);
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

	/** A Send button in the list or the drawer. */
	function sendFrom(event: MouseEvent | undefined, b: BookingRow, kind: ListedKind) {
		event?.stopPropagation(); // don't open the edit drawer
		void emailPrompts?.start(b.id, kind, false);
	}

	/** Pressing Enter in a text input must not save the whole household form. */
	function ignoreEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') event.preventDefault();
	}
</script>

<!-- Which emails have gone out, and the buttons to send them -->
{#snippet sentBadges(b: BookingRow)}
	<div class="flex flex-wrap gap-1">
		{#each KINDS as k (k.kind)}
			{#if sentList(b, k.kind).length > 0}
				<Badge color="green">&#10003; {k.sent}</Badge>
			{:else}
				<Badge color="gray">{k.label} not sent</Badge>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet sendButtons(b: BookingRow)}
	<div class="flex flex-wrap gap-2">
		{#each KINDS as k (k.kind)}
			<Button
				type="button"
				size="xs"
				outline
				color="dark"
				disabled={!canEmail(b, k.kind)}
				title={emailTitle(b, k.kind)}
				onclick={(e: MouseEvent) => sendFrom(e, b, k.kind)}
			>
				Send {k.label.toLowerCase()}
			</Button>
		{/each}
	</div>
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
				<TableHeadCell>Emails</TableHeadCell>
				<TableHeadCell>Send</TableHeadCell>
			</TableHead>
			<TableBody>
				{#each bookings as b (b.id)}
					<TableBodyRow class="cursor-pointer" onclick={() => openEdit(b)}>
						<TableBodyCell>{whenText(b)}</TableBodyCell>
						<TableBodyCell>{siteNameOf(b)}</TableBodyCell>
						<TableBodyCell>
							<Badge color={statusColor(b.status)}>{statusName(b.status)}</Badge>
						</TableBodyCell>
						<TableBodyCell>{@render sentBadges(b)}</TableBodyCell>
						<TableBodyCell>{@render sendButtons(b)}</TableBodyCell>
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
					{#if siteNameOf(b)}
						<div class="text-sm text-gray-600 dark:text-gray-300">{siteNameOf(b)}</div>
					{/if}
					<div class="mt-2">{@render sentBadges(b)}</div>
				</button>
				<div class="mt-3">{@render sendButtons(b)}</div>
			</li>
		{/each}
	</ul>
{/if}

<!-- ============================ New booking ============================ -->
<Drawer
	placement="bottom"
	bind:open={newOpen}
	class="max-h-[90vh] overflow-y-auto bg-white p-1 text-gray-900 backdrop:bg-black/50 dark:bg-gray-800 dark:text-white"
>
	<div class="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-4 pb-8 pt-2">
		<h3 class="text-lg font-semibold">New booking</h3>

		<!-- 1. Service date -->
		<fieldset>
			<legend class="mb-2 text-sm font-medium">Service date</legend>
			<div class="max-h-64 space-y-2 overflow-y-auto pr-1">
				<label
					class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 {selectedService === UNSCHEDULED
						? choiceOn
						: choiceOff}"
				>
					<input
						type="radio"
						name="service"
						class={radioClass}
						value={UNSCHEDULED}
						checked={selectedService === UNSCHEDULED}
						onchange={() => pickService(UNSCHEDULED)}
					/>
					<span class="flex-1">
						<span class="block font-medium">Unscheduled</span>
						<span class="block text-sm text-gray-600 dark:text-gray-300">
							No appointment time. You can still note a date, time and location.
						</span>
					</span>
				</label>

				{#each services as s (s.id)}
					<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 {selectedService === s.id
							? choiceOn
							: choiceOff}"
					>
						<input
							type="radio"
							name="service"
							class={radioClass}
							value={s.id}
							checked={selectedService === s.id}
							onchange={() => pickService(s.id)}
						/>
						<span class="flex-1">
							<span class="block font-medium">
								{fmtDate(s.startTime)}, {fmtTime(s.startTime)} &ndash; {fmtTime(s.endTime)}
							</span>
							<span class="block text-sm text-gray-600 dark:text-gray-300">
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

		<!-- 2a. Unscheduled: optional date, time and location -->
		{#if selectedService === UNSCHEDULED}
			<fieldset class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<legend class="mb-2 text-sm font-medium">Planned date, time and location (optional)</legend>
				<div class="min-w-0">
					<Label class="mb-2">Date</Label>
					<Datepicker bind:value={plannedDate} locale="en-CA" firstDayOfWeek={1} inputClass="w-full" />
				</div>
				<div class="min-w-0">
					<Label for="planned-time" class="mb-2">Time</Label>
					<Input id="planned-time" type="time" bind:value={plannedTime} onkeydown={ignoreEnter} />
				</div>
				<div class="min-w-0">
					<Label for="planned-site" class="mb-2">Location</Label>
					<Select id="planned-site" items={siteItems} bind:value={plannedSiteId} />
				</div>
				{#if plannedIncomplete}
					<Helper class="sm:col-span-3">Choose both a date and a time, or leave both empty.</Helper>
				{/if}
			</fieldset>
		{/if}

		<!-- 2b. Before the household is eligible -->
		{#if isEarly && eligibleDate}
			<div
				class="rounded-lg border border-yellow-400 bg-yellow-50 p-4 text-yellow-900 dark:border-yellow-500 dark:bg-yellow-950 dark:text-yellow-100"
				role="alert"
			>
				<p>
					<span class="font-semibold">Before this household is eligible.</span>
					This household is next eligible on {fmtDate(eligibleDate)}, and this date is earlier.
				</p>
				<label class="mt-3 flex cursor-pointer items-center gap-2 font-medium">
					<input type="checkbox" class={checkClass} bind:checked={acknowledgedEarly} />
					I understand, book it anyway
				</label>
			</div>
		{/if}

		<!-- 3. Time -->
		{#if service}
			<fieldset>
				<legend class="mb-2 text-sm font-medium">Time</legend>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
					{#each service.appointments as a (a.id)}
						<label
							class="cursor-pointer rounded-lg border px-3 py-2 text-center {selectedAppointment === a.id
								? choiceOn + ' font-semibold'
								: choiceOff}"
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
		<div class="min-w-0">
			<Label for="new-request" class="mb-2">Special request (optional)</Label>
			<Textarea
				id="new-request"
				rows={3}
				class="block w-full max-w-full min-w-0"
				maxlength={MAX_REQUEST_LENGTH}
				bind:value={newRequest}
			/>
		</div>

		{#if newError}
			<p class="text-sm text-red-600 dark:text-red-400" role="alert">{newError}</p>
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
	class="max-h-[90vh] overflow-y-auto bg-white p-1 text-gray-900 backdrop:bg-black/50 dark:bg-gray-800 dark:text-white"
>
	{#if editing}
		<div class="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-4 pb-8 pt-2">
			<div>
				<h3 class="text-lg font-semibold">{whenText(editing)}</h3>
				{#if editing.appointment}
					<p class="text-sm text-gray-600 dark:text-gray-300">
						{[editing.appointment.event.title, editing.appointment.event.location.name].filter(Boolean).join(' · ')}
					</p>
				{/if}
			</div>

			<div class="max-w-xs">
				<Label for="edit-status" class="mb-2">Status</Label>
				<Select id="edit-status" items={appointmentBookingStatusOptions} bind:value={editStatus} />
			</div>

			<!-- Unscheduled bookings can note a planned date, time and location -->
			{#if !editing.appointment}
				<fieldset class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<legend class="mb-2 text-sm font-medium">Planned date, time and location</legend>
					<div class="min-w-0">
						<Label class="mb-2">Date</Label>
						<Datepicker bind:value={editDate} locale="en-CA" firstDayOfWeek={1} inputClass="w-full" />
					</div>
					<div class="min-w-0">
						<Label for="edit-time" class="mb-2">Time</Label>
						<Input id="edit-time" type="time" bind:value={editTime} onkeydown={ignoreEnter} />
					</div>
					<div class="min-w-0">
						<Label for="edit-site" class="mb-2">Location</Label>
						<Select id="edit-site" items={siteItems} bind:value={editSiteId} />
					</div>
				</fieldset>
			{/if}

			<div class="min-w-0">
				<Label for="edit-request" class="mb-2">Special request</Label>
				<Textarea
					id="edit-request"
					rows={3}
					class="block w-full max-w-full min-w-0"
					maxlength={MAX_REQUEST_LENGTH}
					bind:value={editRequest}
				/>
				<Helper class="mt-1">Clear the text to remove the special request.</Helper>
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
									<li class="wrap-break-word">
										{fmtDateTime(e.sentAt)}{e.to.length ? ` to ${e.to.join(', ')}` : ''}
									</li>
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
						disabled={!canEmail(editing, k.kind)}
						title={emailTitle(editing, k.kind)}
						onclick={() => {
							const b = editing;
							editOpen = false;
							if (b) sendFrom(undefined, b, k.kind);
						}}
					>
						Send {k.label.toLowerCase()}
					</Button>
				{/each}
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

<!-- ============================ Emails ============================ -->
<EmailPrompts
	bind:this={emailPrompts}
	{emailEnabled}
	previewAction="previewEmail"
	sendAction="sendEmail"
	idField="bookingId"
	audience="household"
/>
