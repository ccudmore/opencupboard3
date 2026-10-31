<script lang="ts">
	import type { Service, Site, Appointment } from './types';
	import { Alert, Badge, Button, Helper, Input, Label, Modal } from 'flowbite-svelte';
	import { callAction } from '$lib/client/callAction';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import EmailPrompts from '$lib/components/EmailPrompts.svelte';
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

	const sectionClass = 'rounded-lg border border-gray-200 p-3 sm:p-4 dark:border-gray-700';
	const timeFmt = $derived(new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone }));
	const time = (d: Date | string) => timeFmt.format(new Date(d));
	const range = (a: { startTime: Date; endTime: Date }) => `${time(a.startTime)} to ${time(a.endTime)}`;
	const cancelled = $derived(service.status === 'CANCELLED');
	const editable = $derived(!service.past && !cancelled);

	let openAppointment = $state('');
	let addMode = $state<'one' | 'several'>('one');
	let add = $state({ count: '8', lengthMinutes: '15', everyMinutes: '15' });
	// The first appointment starts when the service date starts, unless it is changed here
	let addStart = $state<string | null>(null);
	const startClock = $derived(addStart ?? service.startClock);
	let addError = $state('');
	let deleteTarget = $state<Appointment | null>(null);

	async function addAppointments() {
		addError = '';
		if (!startClock) return (addError = 'Enter the start time.');
		runner.busy = 'add';
		const r = await callAction('addAppointments', {
			eventId: service.id,
			startClock,
			count: addMode === 'one' ? '1' : add.count,
			lengthMinutes: add.lengthMinutes,
			everyMinutes: addMode === 'one' ? add.lengthMinutes : add.everyMinutes
		});
		runner.busy = '';
		if (!r.ok) {
			addError = r.message;
			return;
		}
		toast(r.data.added === 1 ? 'Appointment added.' : `${r.data.added} appointments added.`);
		await invalidateAll();
	}

	// ------------------------------------------------ booking a client
	let clientQuery = $state('');
	let clientResults = $state<{ householdId: string; name: string; detail: string }[]>([]);
	let clientSearched = $state(false);
	let clientBusy = $state(false);
	let taken = $state<{ message: string; householdId: string; name: string; suggestions: { id: string; startTime: Date; endTime: Date }[] } | null>(null);

	function toggleAppointment(a: Appointment) {
		openAppointment = openAppointment === a.id ? '' : a.id;
		clientQuery = '';
		clientResults = [];
		clientSearched = false;
		taken = null;
	}

	async function deleteAppointment() {
		if (!deleteTarget) return;
		const ok = await run('delete', 'deleteAppointment', { appointmentId: deleteTarget.id }, 'Appointment removed.');
		if (ok) deleteTarget = null;
	}

	async function book(appointmentId: string, householdId: string, name: string) {
		runner.busy = `book:${householdId}`;
		taken = null;
		const r = await callAction('book', { appointmentId, householdId });
		runner.busy = '';
		if (!r.ok) {
			if (r.code === 'taken') {
				taken = { message: r.message, householdId, name, suggestions: r.data?.suggestions ?? [] };
			} else {
				toast(r.message);
			}
			await invalidateAll(); // shows who has the time now
			return;
		}
		toast(`${name} booked.`);
		openAppointment = '';
		clientQuery = '';
		clientResults = [];
		await invalidateAll();
		// The usual prompts: send a confirmation email? customize it?
		await bookingPrompts?.start(r.data.bookingId, 'confirmation', true);
	}

	let bookingPrompts: ReturnType<typeof EmailPrompts> | undefined = $state();

	let cancelBookingTarget = $state<Appointment | null>(null);
	async function cancelBooking() {
		const booking = cancelBookingTarget?.booking;
		if (!booking) return;
		const ok = await run('cancel-booking', 'cancelBooking', { bookingId: booking.id }, 'Booking cancelled.');
		if (ok) {
			cancelBookingTarget = null;
			await bookingPrompts?.start(booking.id, 'cancellation', true);
		}
	}

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function onClientInput(appointmentId: string) {
		clearTimeout(searchTimer);
		const q = clientQuery.trim();
		if (q.length < 2) {
			clientResults = [];
			clientSearched = false;
			return;
		}
		searchTimer = setTimeout(async () => {
			clientBusy = true;
			const r = await callAction('searchClients', { appointmentId, q });
			clientBusy = false;
			if (!r.ok) return void toast(r.message);
			if (q === clientQuery.trim()) {
				clientResults = r.data.clients;
				clientSearched = true;
			}
		}, 300);
	}
</script>

<section class={sectionClass}>
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<h3 class="text-base font-semibold text-gray-900 dark:text-white">Appointments</h3>
		<Badge color="green">{service.counts.open} open</Badge>
		<Badge color="blue">{service.counts.booked} booked</Badge>
		<span class="text-sm text-gray-600 dark:text-gray-300">of {service.counts.total}</span>
	</div>

	{#if service.appointments.length === 0}
		<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">No appointments yet. Add some below.</p>
	{/if}

	<ul class="divide-y divide-gray-200 dark:divide-gray-700">
		{#each service.appointments as a (a.id)}
			<li>
				<button
					type="button"
					class="flex w-full min-w-0 items-center justify-between gap-2 py-2 text-left"
					aria-expanded={openAppointment === a.id}
					onclick={() => toggleAppointment(a)}
				>
					<span class="font-medium text-gray-900 dark:text-white">{range(a)}</span>
					{#if a.booking}
						<span class="min-w-0 truncate text-sm text-gray-700 dark:text-gray-200">{a.booking.name}</span>
					{:else}
						<Badge color="green">Open</Badge>
					{/if}
				</button>

				{#if openAppointment === a.id}
					<div class="mb-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
						{#if a.booking}
							<p class="text-sm text-gray-700 dark:text-gray-200">
								Booked for <a href={`/households/${a.booking.householdId}`} class="font-medium text-blue-700 hover:underline dark:text-blue-400">{a.booking.name}</a>.
							</p>
							<div class="mt-2 flex flex-wrap gap-2">
								{#if !a.past}<Button size="xs" outline color="red" onclick={() => (cancelBookingTarget = a)}>Cancel booking</Button>{/if}
							</div>
						{:else if a.past || cancelled}
							<p class="text-sm text-gray-600 dark:text-gray-300">{cancelled ? 'This service date is cancelled.' : 'This appointment has passed.'}</p>
						{:else}
							<Label for={`client-${a.id}`} class="mb-1">Find a client</Label>
							<Input id={`client-${a.id}`} placeholder="Name, phone, email, street or postal code" autocomplete="off" bind:value={clientQuery} oninput={() => onClientInput(a.id)} />
							<Helper class="mt-1">Only active clients who are eligible for {service.date} are listed.</Helper>

							{#if taken}
								<Alert color="yellow" class="mt-3">
									<div class="font-medium">{taken.message}</div>
									{#if taken.suggestions.length > 0}
										<div class="mt-1">Other open times — pick one to book {taken.name} there:</div>
										<div class="mt-2 flex flex-wrap gap-2">
											{#each taken.suggestions as s (s.id)}
												<Button size="xs" color="dark" disabled={runner.busy.startsWith('book:')} onclick={() => book(s.id, taken!.householdId, taken!.name)}>{range(s)}</Button>
											{/each}
										</div>
									{:else}
										<div class="mt-1">There are no other open times on this service date.</div>
									{/if}
								</Alert>
							{/if}

							{#if clientBusy}<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">Searching…</p>{/if}
							{#if clientSearched && clientResults.length === 0 && !clientBusy}
								<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">No eligible active clients match. Clients who were booked recently aren't eligible until their next service date.</p>
							{/if}
							<ul class="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
								{#each clientResults as c (c.householdId)}
									<li class="flex flex-wrap items-center justify-between gap-2 py-2">
										<div class="min-w-0">
											<div class="font-medium wrap-break-word text-gray-900 dark:text-white">{c.name}</div>
											{#if c.detail}<div class="text-sm wrap-break-word text-gray-600 dark:text-gray-300">{c.detail}</div>{/if}
										</div>
										<Button size="xs" color="dark" disabled={runner.busy === `book:${c.householdId}`} onclick={() => book(a.id, c.householdId, c.name)}>
											{runner.busy === `book:${c.householdId}` ? 'Booking…' : 'Book'}
										</Button>
									</li>
								{/each}
							</ul>
						{/if}

						{#if !a.booking && !a.past}
							<div class="mt-3 border-t border-gray-200 pt-2 dark:border-gray-700">
								<Button size="xs" outline color="dark" onclick={() => (deleteTarget = a)}><TrashBinOutline class="me-1 h-3.5 w-3.5" />Remove appointment</Button>
							</div>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if editable}
		<div class="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
			<div class="mb-2 flex flex-wrap items-center gap-3">
				<span class="text-sm font-medium text-gray-900 dark:text-white">Add appointments</span>
				<label class="flex items-center gap-1 text-sm text-gray-800 dark:text-gray-100"><input type="radio" name={`mode-${service.id}`} value="one" bind:group={addMode} />One</label>
				<label class="flex items-center gap-1 text-sm text-gray-800 dark:text-gray-100"><input type="radio" name={`mode-${service.id}`} value="several" bind:group={addMode} />Several</label>
			</div>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div class="min-w-0">
					<Label for={`add-start-${service.id}`} class="mb-1">{addMode === 'one' ? 'Time' : 'First one at'}</Label>
					<Input id={`add-start-${service.id}`} type="time" value={startClock} oninput={(e) => (addStart = (e.currentTarget as HTMLInputElement).value)} />
				</div>
				<div class="min-w-0">
					<Label for={`add-length-${service.id}`} class="mb-1">Length (minutes)</Label>
					<Input id={`add-length-${service.id}`} type="number" min="1" max="480" bind:value={add.lengthMinutes} />
				</div>
				{#if addMode === 'several'}
					<div class="min-w-0">
						<Label for={`add-count-${service.id}`} class="mb-1">How many</Label>
						<Input id={`add-count-${service.id}`} type="number" min="1" max="100" bind:value={add.count} />
					</div>
					<div class="min-w-0">
						<Label for={`add-every-${service.id}`} class="mb-1">New one every (minutes)</Label>
						<Input id={`add-every-${service.id}`} type="number" min="1" max="480" bind:value={add.everyMinutes} />
					</div>
				{/if}
			</div>
			{#if addError}<p class="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{addError}</p>{/if}
			<div class="mt-3">
				<Button size="sm" color="dark" disabled={runner.busy === 'add'} onclick={addAppointments}>
					<PlusOutline class="me-2 h-3.5 w-3.5" />{runner.busy === 'add' ? 'Adding…' : addMode === 'one' ? 'Add appointment' : 'Add appointments'}
				</Button>
			</div>
		</div>
	{:else}
		<p class="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-200">
			{cancelled
				? 'This service date is cancelled. Reinstate it (under Details) to add appointments or book clients.'
				: 'This service date has already ended, so appointments can no longer be added or booked. To set up a new one, use Duplicate under Details and pick a future date.'}
		</p>
	{/if}
</section>

<Modal title="Remove this appointment?" open={deleteTarget !== null} onclose={() => (deleteTarget = null)} size="xs">
	<p class="text-gray-600 dark:text-gray-300">Remove the {deleteTarget ? range(deleteTarget) : ''} appointment? It has no bookings.</p>
	{#snippet footer()}
		<Button color="red" disabled={runner.busy === 'delete'} onclick={deleteAppointment}>Yes, remove it</Button>
		<Button outline color="dark" onclick={() => (deleteTarget = null)}>Keep it</Button>
	{/snippet}
</Modal>

<Modal title="Cancel this booking?" open={cancelBookingTarget !== null} onclose={() => (cancelBookingTarget = null)} size="xs">
	<p class="text-gray-600 dark:text-gray-300">
		Cancel the booking for {cancelBookingTarget?.booking?.name} at {cancelBookingTarget ? time(cancelBookingTarget.startTime) : ''}? The time becomes open again.
	</p>
	{#snippet footer()}
		<Button color="red" disabled={runner.busy === 'cancel-booking'} onclick={cancelBooking}>Yes, cancel it</Button>
		<Button outline color="dark" onclick={() => (cancelBookingTarget = null)}>Keep it</Button>
	{/snippet}
</Modal>

<EmailPrompts bind:this={bookingPrompts} {emailEnabled} previewAction="previewBookingEmail" sendAction="sendBookingEmail" idField="bookingId" audience="household" />