<script lang="ts">
	import { Badge, Button } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import EmailPrompts from '$lib/components/EmailPrompts.svelte';

	let { data } = $props();

	let busy = $state('');
	let prompts: ReturnType<typeof EmailPrompts> | undefined = $state();

	const dateFmt = $derived(new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: data.timeZone }));
	const whenFmt = $derived(new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: data.timeZone }));

	/** Runs one action, then reloads the lists. */
	async function run(key: string, action: string, field: string, id: string) {
		busy = key;
		const r = await callAction(action, { [field]: id });
		busy = '';
		if (!r.ok) {
			toast(r.message);
			await invalidateAll();
			return null;
		}
		await invalidateAll();
		return r.data;
	}

	async function confirm(id: string) {
		if (await run(`c${id}`, 'confirmBooking', 'bookingId', id)) {
			toast('Appointment confirmed');
			await prompts?.start(id, 'confirmation', true); // then offers the confirmation letter
		}
	}

	async function decline(id: string) {
		if (await run(`d${id}`, 'declineBooking', 'bookingId', id)) {
			toast('Request declined');
			await prompts?.start(id, 'cancellation', true);
		}
	}

	async function approve(id: string) {
		const d = await run(`a${id}`, 'approveHousehold', 'householdId', id);
		if (d) toast(d.emailed?.length ? `Household approved. Its ID was emailed to ${d.emailed.join(', ')}` : 'Household approved. It has no email address on file, so give it its ID yourself.');
	}

	async function reject(id: string) {
		if (await run(`r${id}`, 'rejectHousehold', 'householdId', id)) toast('Household archived');
	}
</script>

<PageBreadcrumb items={[{ label: 'Households', href: '/households' }, { label: 'Pending requests' }]} bar />

<div class="page-content space-y-8">
	<section class="space-y-3">
		<h2 class="section-title">Appointment requests ({data.bookings.length})</h2>
		{#if data.bookings.length === 0}
			<p class="muted">No appointment requests are waiting.</p>
		{/if}
		{#each data.bookings as b (b.id)}
			<div class="rounded-lg bg-white p-4 shadow-md dark:bg-gray-800">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<a class="font-semibold text-blue-700 underline dark:text-blue-400" href={`/households/${b.householdId}`}>{b.name}</a>
						{#if b.uniqueId}<span class="hint"> · ID {b.uniqueId}</span>{/if}
						<div class="text-gray-900 dark:text-white">{b.start ? dateFmt.format(new Date(b.start)) : 'No date'}{b.place ? `, ${b.place}` : ''}</div>
						<div class="hint">Asked {whenFmt.format(new Date(b.requestedAt))}{b.email ? ` · ${b.email}` : ''}{b.phone ? ` · ${b.phone}` : ''}</div>
						{#if b.householdStatus !== 'ACTIVE'}<Badge color="yellow" class="mt-1">Household not approved yet</Badge>{/if}
					</div>
					<div class="flex gap-2">
						<Button size="sm" color="blue" disabled={!!busy} onclick={() => confirm(b.id)}>{busy === `c${b.id}` ? 'Confirming…' : 'Confirm'}</Button>
						<Button size="sm" outline color="dark" disabled={!!busy} onclick={() => decline(b.id)}>Decline</Button>
					</div>
				</div>
			</div>
		{/each}
	</section>

	<section class="space-y-3">
		<h2 class="section-title">New households ({data.households.length})</h2>
		{#if data.households.length === 0}
			<p class="muted">No new households are waiting.</p>
		{/if}
		{#each data.households as h (h.id)}
			<div class="rounded-lg bg-white p-4 shadow-md dark:bg-gray-800">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0 space-y-0.5">
						<a class="font-semibold text-blue-700 underline dark:text-blue-400" href={`/households/${h.id}`}>{h.name}</a>
						<div class="text-gray-900 dark:text-white">{h.address}</div>
						<div class="hint">{[h.email, h.phone].filter(Boolean).join(' · ') || 'No contact details'}</div>
						<div class="hint">
							{h.adults ?? '?'} {h.adults === 1 ? 'adult' : 'adults'}, {h.children ?? '?'} {h.children === 1 ? 'child' : 'children'}{h.dietary.length ? ` · ${h.dietary.join(', ')}` : ''}
						</div>
						{#if h.notes}<div class="wrap-break-word text-sm text-gray-700 dark:text-gray-300">{h.notes}</div>{/if}
						<div class="hint">Signed up {whenFmt.format(new Date(h.requestedAt))}</div>
					</div>
					<div class="flex gap-2">
						<Button size="sm" color="blue" disabled={!!busy} onclick={() => approve(h.id)}>{busy === `a${h.id}` ? 'Approving…' : 'Approve'}</Button>
						<Button size="sm" outline color="dark" disabled={!!busy} onclick={() => reject(h.id)}>Reject</Button>
					</div>
				</div>
			</div>
		{/each}
	</section>
</div>

<EmailPrompts bind:this={prompts} emailEnabled={data.emailEnabled} previewAction="previewEmail" sendAction="sendEmail" idField="bookingId" audience="household" />
