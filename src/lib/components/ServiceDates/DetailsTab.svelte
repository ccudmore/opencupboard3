<script lang="ts">
	import { Button, Input, Label, Modal, Select, Textarea } from 'flowbite-svelte';
	import { callAction } from '$lib/client/callAction';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { Service, Site } from './types';
	import { FileCopyOutline } from 'flowbite-svelte-icons';
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
	const headingClass = 'mb-3 text-base font-semibold text-gray-900 dark:text-white';
	const cancelled = $derived(service.status === 'CANCELLED');
	const siteItems = $derived(sites.map((s) => ({ value: s.id, name: s.name })));

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
		runner.busy = 'dup';
		dupError = '';
		const r = await callAction('duplicate', { eventId: service.id, ...dup });
		runner.busy = '';
		if (!r.ok) {
			dupError = r.message;
			return;
		}
		duplicateOpen = false;
		toast('Service date duplicated. Appointments and volunteer counts were copied; bookings and volunteers were not.');
		await invalidateAll();
		onopen(r.data.id);
	}
</script>

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
		<Button size="sm" color="dark" disabled={!detailsChanged || runner.busy === 'details'} onclick={saveDetails}>{runner.busy === 'details' ? 'Saving…' : 'Save details'}</Button>
		<Button size="sm" outline color="dark" onclick={openDuplicate}><FileCopyOutline class="me-2 h-4 w-4" />Duplicate</Button>
		{#if cancelled}
			<Button size="sm" outline color="dark" disabled={runner.busy === 'status'} onclick={() => setStatus('ACTIVE')}>Reinstate</Button>
		{:else}
			<Button size="sm" outline color="red" onclick={() => (cancelOpen = true)}>Cancel this service date</Button>
		{/if}
	</div>
</section>

<!-- Confirmations -->
<Modal title="Cancel this service date?" bind:open={cancelOpen} size="xs">
	<p class="text-gray-600 dark:text-gray-300">
		{service.counts.booked > 0
			? `${service.counts.booked} ${service.counts.booked === 1 ? 'client is' : 'clients are'} booked. Their bookings are not cancelled automatically; cancel them first if you want to let them know.`
			: 'Nobody is booked.'}
		The service date will be hidden from clients and volunteers. You can reinstate it later.
	</p>
	{#snippet footer()}
		<Button color="red" disabled={runner.busy === 'status'} onclick={() => setStatus('CANCELLED')}>Yes, cancel it</Button>
		<Button outline color="dark" onclick={() => (cancelOpen = false)}>Keep it</Button>
	{/snippet}
</Modal>

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
		<Button color="dark" disabled={runner.busy === 'dup'} onclick={duplicate}>{runner.busy === 'dup' ? 'Copying…' : 'Duplicate'}</Button>
		<Button outline color="dark" onclick={() => (duplicateOpen = false)}>Cancel</Button>
	{/snippet}
</Modal>