<script lang="ts">
	import { Alert, Badge, Button, Helper, Input, Label, Modal, Select, Textarea } from 'flowbite-svelte';
	import { PlusOutline, TrashBinOutline, FileCopyOutline } from 'flowbite-svelte-icons';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';
	import EmailPrompts from '$lib/components/EmailPrompts.svelte';
	import type { Service, Site, Appointment } from './types';
	import TabView from "$lib/components/ServiceDates/TabView.svelte";

	let {
		service,
		sites,
		timeZone,
		emailEnabled,
		canManageVolunteers,
		onopen
	}: {
		service: Service;
		sites: Site[];
		timeZone: string;
		emailEnabled: boolean;
		canManageVolunteers: boolean;
		/** called with the id of a service date that should be opened (after a duplicate) */
		onopen: (id: string) => void;
	} = $props();
/*
	const timeFmt = $derived(new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone }));
	const time = (d: Date | string) => timeFmt.format(new Date(d));
	const range = (a: { startTime: Date; endTime: Date }) => `${time(a.startTime)} to ${time(a.endTime)}`;

	let bookingPrompts: ReturnType<typeof EmailPrompts> | undefined = $state();
	let volunteerPrompts: ReturnType<typeof EmailPrompts> | undefined = $state();
	let busy = $state('');

	const siteItems = $derived(sites.map((s) => ({ value: s.id, name: s.name })));
	const cancelled = $derived(service.status === 'CANCELLED');
	const editable = $derived(!service.past && !cancelled);
*/
	/** Runs an action; shows its error as a toast. Returns the result data, or null on failure. */
	/*
	async function run(key: string, action: string, fields: Record<string, string>, done?: string) {
		busy = key;
		const r = await callAction(action, fields);
		busy = '';
		if (!r.ok) {
			toast(r.message);
			await invalidateAll();
			return null;
		}
		if (done) toast(done);
		await invalidateAll();
		return r.data;
	}

	// ------------------------------------------------ details
	// svelte-ignore state_referenced_locally
	let details = $state({ title: service.title, date: service.date, startClock: service.startClock, endClock: service.endClock, siteId: service.siteId, note: service.note });
	const detailsChanged = $derived(
		details.title !== service.title || details.date !== service.date || details.startClock !== service.startClock ||
			details.endClock !== service.endClock || details.siteId !== service.siteId || details.note !== service.note
	);
	// The page reloads after every booking and so on. Only reset the form when the *saved* details
	// actually changed, so something being typed isn't wiped by an unrelated reload.
	// svelte-ignore state_referenced_locally
	let savedDetails = JSON.stringify([service.title, service.date, service.startClock, service.endClock, service.siteId, service.note]);
	$effect(() => {
		const now = JSON.stringify([service.title, service.date, service.startClock, service.endClock, service.siteId, service.note]);
		if (now === savedDetails) return;
		savedDetails = now;
		details = { title: service.title, date: service.date, startClock: service.startClock, endClock: service.endClock, siteId: service.siteId, note: service.note };
	});
	const saveDetails = () => run('details', 'updateServiceDate', { eventId: service.id, ...details }, 'Service date saved.');

	let cancelOpen = $state(false);
	async function setStatus(status: 'ACTIVE' | 'CANCELLED') {
		const ok = await run('status', 'setStatus', { eventId: service.id, status }, status === 'CANCELLED' ? 'Service date cancelled.' : 'Service date reinstated.');
		if (ok) cancelOpen = false;
	}

	// ------------------------------------------------ duplicate
	let duplicateOpen = $state(false);
	let dup = $state({ date: '', startClock: '', endClock: '', siteId: '', title: '' });
	let dupError = $state('');
	function openDuplicate() {
		const d = new Date(`${service.date}T00:00:00Z`);
		d.setUTCDate(d.getUTCDate() + 7); // a week later is the usual next one
		dup = { date: d.toISOString().slice(0, 10), startClock: service.startClock, endClock: service.endClock, siteId: service.siteId, title: '' };
		dupError = '';
		duplicateOpen = true;
	}
	async function duplicate() {
		busy = 'dup';
		dupError = '';
		const r = await callAction('duplicate', { eventId: service.id, ...dup });
		busy = '';
		if (!r.ok) {
			dupError = r.message;
			return;
		}
		duplicateOpen = false;
		toast('Service date duplicated. Appointments and volunteer counts were copied; bookings and volunteers were not.');
		await invalidateAll();
		onopen(r.data.id);
	}

	// ------------------------------------------------ appointments
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
		busy = 'add';
		const r = await callAction('addAppointments', {
			eventId: service.id,
			startClock,
			count: addMode === 'one' ? '1' : add.count,
			lengthMinutes: add.lengthMinutes,
			everyMinutes: addMode === 'one' ? add.lengthMinutes : add.everyMinutes
		});
		busy = '';
		if (!r.ok) {
			addError = r.message;
			return;
		}
		toast(r.data.added === 1 ? 'Appointment added.' : `${r.data.added} appointments added.`);
		await invalidateAll();
	}

	async function deleteAppointment() {
		if (!deleteTarget) return;
		const ok = await run('delete', 'deleteAppointment', { appointmentId: deleteTarget.id }, 'Appointment removed.');
		if (ok) deleteTarget = null;
	}
		*/

	// ------------------------------------------------ booking a client
	/*
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

	async function book(appointmentId: string, householdId: string, name: string) {
		busy = `book:${householdId}`;
		taken = null;
		const r = await callAction('book', { appointmentId, householdId });
		busy = '';
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

	// ------------------------------------------------ volunteers
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
*/
	const sectionClass = 'rounded-lg border border-gray-200 p-3 sm:p-4 dark:border-gray-700';
	const headingClass = 'mb-3 text-base font-semibold text-gray-900 dark:text-white';
</script>

<div class="space-y-4"> <!-- craig - has been moved over to the tabview-->


<TabView {service} {sites} {timeZone} {emailEnabled} {onopen} {canManageVolunteers}/>
	<!-- Details -->
	 <!--
	<section class={sectionClass}>
		<h3 class={headingClass}>Details</h3>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<div class="min-w-0 sm:col-span-2">
				<Label for={`title-${service.id}`} class="mb-1">Title</Label>
				<Input id={`title-${service.id}`} bind:value={details.title} />
			</div>
			<div class="min-w-0">
				<Label for={`date-${service.id}`} class="mb-1">Date</Label>
				<Input id={`date-${service.id}`} type="date" bind:value={details.date} />
			</div>
			<div class="min-w-0">
				<Label for={`site-${service.id}`} class="mb-1">Site</Label>
				<Select id={`site-${service.id}`} items={siteItems} bind:value={details.siteId} />
			</div>
			<div class="min-w-0">
				<Label for={`start-${service.id}`} class="mb-1">Starts</Label>
				<Input id={`start-${service.id}`} type="time" bind:value={details.startClock} />
			</div>
			<div class="min-w-0">
				<Label for={`end-${service.id}`} class="mb-1">Ends</Label>
				<Input id={`end-${service.id}`} type="time" bind:value={details.endClock} />
			</div>
			<div class="min-w-0 sm:col-span-2">
				<Label for={`note-${service.id}`} class="mb-1">Note</Label>
				<Textarea id={`note-${service.id}`} rows={2} class="block w-full max-w-full min-w-0" bind:value={details.note} />
			</div>
		</div>
		<div class="mt-3 flex flex-wrap gap-2">
			<Button size="sm" color="dark" disabled={!detailsChanged || busy === 'details'} onclick={saveDetails}>{busy === 'details' ? 'Saving…' : 'Save details'}</Button>
			<Button size="sm" outline color="dark" onclick={openDuplicate}><FileCopyOutline class="me-2 h-4 w-4" />Duplicate</Button>
			{#if cancelled}
				<Button size="sm" outline color="dark" disabled={busy === 'status'} onclick={() => setStatus('ACTIVE')}>Reinstate</Button>
			{:else}
				<Button size="sm" outline color="red" onclick={() => (cancelOpen = true)}>Cancel this service date</Button>
			{/if}
		</div>
	</section>
-->

	<!-- Appointments -->
	 <!--
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
													<Button size="xs" color="dark" disabled={busy.startsWith('book:')} onclick={() => book(s.id, taken!.householdId, taken!.name)}>{range(s)}</Button>
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
											<Button size="xs" color="dark" disabled={busy === `book:${c.householdId}`} onclick={() => book(a.id, c.householdId, c.name)}>
												{busy === `book:${c.householdId}` ? 'Booking…' : 'Book'}
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
					<Button size="sm" color="dark" disabled={busy === 'add'} onclick={addAppointments}>
						<PlusOutline class="me-2 h-3.5 w-3.5" />{busy === 'add' ? 'Adding…' : addMode === 'one' ? 'Add appointment' : 'Add appointments'}
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
-->
	<!-- Volunteers -->
	 <!--
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
											<Button size="xs" color="dark" disabled={busy === `vol:${v.id}`} onclick={() => addVolunteer(v.id, v.name)}>Add</Button>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			<div class="mt-4">
				<Button size="sm" color="dark" disabled={!needsChanged || busy === 'needs'} onclick={saveNeeds}>{busy === 'needs' ? 'Saving…' : 'Save volunteer counts'}</Button>
			</div>
		</section>
	{/if}
-->
</div>

<!-- Confirmations -->
 <!--
<Modal title="Cancel this service date?" bind:open={cancelOpen} size="xs">
	<p class="text-gray-600 dark:text-gray-300">
		{service.counts.booked > 0
			? `${service.counts.booked} ${service.counts.booked === 1 ? 'client is' : 'clients are'} booked. Their bookings are not cancelled automatically; cancel them first if you want to let them know.`
			: 'Nobody is booked.'}
		The service date will be hidden from clients and volunteers. You can reinstate it later.
	</p>
	{#snippet footer()}
		<Button color="red" disabled={busy === 'status'} onclick={() => setStatus('CANCELLED')}>Yes, cancel it</Button>
		<Button outline color="dark" onclick={() => (cancelOpen = false)}>Keep it</Button>
	{/snippet}
</Modal>
-->
<!--
<Modal title="Cancel this booking?" open={cancelBookingTarget !== null} onclose={() => (cancelBookingTarget = null)} size="xs">
	<p class="text-gray-600 dark:text-gray-300">
		Cancel the booking for {cancelBookingTarget?.booking?.name} at {cancelBookingTarget ? time(cancelBookingTarget.startTime) : ''}? The time becomes open again.
	</p>
	{#snippet footer()}
		<Button color="red" disabled={busy === 'cancel-booking'} onclick={cancelBooking}>Yes, cancel it</Button>
		<Button outline color="dark" onclick={() => (cancelBookingTarget = null)}>Keep it</Button>
	{/snippet}
</Modal>
-->
<!--
<Modal title="Remove this appointment?" open={deleteTarget !== null} onclose={() => (deleteTarget = null)} size="xs">
	<p class="text-gray-600 dark:text-gray-300">Remove the {deleteTarget ? range(deleteTarget) : ''} appointment? It has no bookings.</p>
	{#snippet footer()}
		<Button color="red" disabled={busy === 'delete'} onclick={deleteAppointment}>Yes, remove it</Button>
		<Button outline color="dark" onclick={() => (deleteTarget = null)}>Keep it</Button>
	{/snippet}
</Modal>
-->
<!--
<Modal title="Remove this volunteer?" open={removeTarget !== null} onclose={() => (removeTarget = null)} size="xs">
	<p class="text-gray-600 dark:text-gray-300">Remove {removeTarget?.name} from this service date? You'll be asked whether to send them a cancellation email.</p>
	{#snippet footer()}
		<Button color="red" disabled={busy === 'remove-vol'} onclick={removeVolunteer}>Yes, remove</Button>
		<Button outline color="dark" onclick={() => (removeTarget = null)}>Keep</Button>
	{/snippet}
</Modal>
-->
<!--
<Modal title="Duplicate this service date" bind:open={duplicateOpen} size="sm">
	<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">
		Copies the site, appointments and the number of volunteers needed. Bookings and the volunteers themselves are not copied.
	</p>
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<div class="min-w-0">
			<Label for={`dup-date-${service.id}`} class="mb-1">New date</Label>
			<Input id={`dup-date-${service.id}`} type="date" bind:value={dup.date} />
		</div>
		<div class="min-w-0">
			<Label for={`dup-site-${service.id}`} class="mb-1">Site</Label>
			<Select id={`dup-site-${service.id}`} items={siteItems} bind:value={dup.siteId} />
		</div>
		<div class="min-w-0">
			<Label for={`dup-start-${service.id}`} class="mb-1">Starts</Label>
			<Input id={`dup-start-${service.id}`} type="time" bind:value={dup.startClock} />
		</div>
		<div class="min-w-0">
			<Label for={`dup-end-${service.id}`} class="mb-1">Ends</Label>
			<Input id={`dup-end-${service.id}`} type="time" bind:value={dup.endClock} />
		</div>
	</div>
	{#if dupError}<p class="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{dupError}</p>{/if}
	{#snippet footer()}
		<Button color="dark" disabled={busy === 'dup'} onclick={duplicate}>{busy === 'dup' ? 'Copying…' : 'Duplicate'}</Button>
		<Button outline color="dark" onclick={() => (duplicateOpen = false)}>Cancel</Button>
	{/snippet}
</Modal>
-->
<!--
<EmailPrompts bind:this={bookingPrompts} {emailEnabled} previewAction="previewBookingEmail" sendAction="sendBookingEmail" idField="bookingId" audience="household" />
<EmailPrompts bind:this={volunteerPrompts} {emailEnabled} previewAction="previewVolunteerEmail" sendAction="sendVolunteerEmail" idField="assignmentId" audience="volunteer" />
-->
