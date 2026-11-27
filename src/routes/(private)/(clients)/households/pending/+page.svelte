<script lang="ts">
	import { Alert, Badge, Button, Label, Modal, Textarea } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { refreshAll } from '$app/navigation';
	import { callAction } from '#lib/client/callAction.ts';
	import PageBreadcrumb from '#lib/components/PageBreadcrumb.svelte';
	import EmailPrompts from '#lib/components/EmailPrompts.svelte';

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
			await refreshAll();
			return null;
		}
		await refreshAll();
		return r.data;
	}

	async function confirm(id: string) {
		if (await run(`c${id}`, 'confirmBooking', 'bookingId', id)) {
			toast('Appointment confirmed');
			await prompts?.start(id, 'confirmation', true); // then offers the confirmation letter
		}
	}

	// Declining asks for a reason first (optional). It is kept for staff and never shown on the public booking page.
	let declineTarget = $state<{ id: string; name: string } | null>(null);
	let declineReason = $state('');

	async function decline() {
		const target = declineTarget;
		if (!target) return;
		busy = `d${target.id}`;
		const r = await callAction('declineBooking', { bookingId: target.id, reason: declineReason.trim() });
		busy = '';
		declineTarget = null;
		declineReason = '';
		await refreshAll();
		if (!r.ok) return void toast(r.message);
		toast('Request declined');
		await prompts?.start(target.id, 'cancellation', true);
	}

	async function approve(id: string) {
		const d = await run(`a${id}`, 'approveHousehold', 'householdId', id);
		if (d) toast(d.emailed?.length ? `Household approved. Its ID was emailed to ${d.emailed.join(', ')}` : 'Household approved. It has no email address on file, so give it its ID yourself.');
	}

	// Rejecting asks for a reason first (optional). It is stored and shown on the household's Information tab.
	let rejectTarget = $state<{ id: string; name: string } | null>(null);
	let rejectReason = $state('');

	async function reject() {
		const target = rejectTarget;
		if (!target) return;
		busy = `r${target.id}`;
		const r = await callAction('rejectHousehold', { householdId: target.id, reason: rejectReason.trim() });
		busy = '';
		rejectTarget = null;
		rejectReason = '';
		await refreshAll();
		toast(r.ok ? 'Household archived' : r.message);
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
						<Button size="sm" outline color="dark" disabled={!!busy} onclick={() => { declineReason = ''; declineTarget = { id: b.id, name: b.name }; }}>Decline</Button>
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
			<div class="rounded-lg bg-white p-4 shadow-md dark:bg-gray-800 {h.duplicate ? 'ring-2 ring-amber-400' : ''}">
				{#if h.duplicate}
					<Alert color="yellow" class="mb-3">
						<div class="font-semibold">This may be a duplicate</div>
						<div class="text-sm">Same {h.duplicate.matchedOn || 'details'} as a household already on file. Compare before approving; if it is the same family, reject this one.</div>
						<div class="mt-2 space-y-0.5 text-sm">
							<div>
								<a class="font-semibold underline" href={`/households/${h.duplicate.id}`}>{h.duplicate.name}</a>
								{#if h.duplicate.uniqueId}<span> · ID {h.duplicate.uniqueId}</span>{/if}
								<Badge color={h.duplicate.status === 'ACTIVE' ? 'green' : 'gray'} class="ml-1">{h.duplicate.status.toLowerCase()}</Badge>
							</div>
							{#if h.duplicate.address}<div>{h.duplicate.address}</div>{/if}
							<div>{[h.duplicate.email, h.duplicate.phone].filter(Boolean).join(' · ') || 'No contact details'}</div>
							<div>Members: {h.duplicate.members.join(', ') || 'none'}</div>
							<div>On file since {whenFmt.format(new Date(h.duplicate.since))}</div>
						</div>
					</Alert>
				{/if}
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
						<Button size="sm" outline color="dark" disabled={!!busy} onclick={() => { rejectReason = ''; rejectTarget = { id: h.id, name: h.name }; }}>Reject</Button>
					</div>
				</div>
			</div>
		{/each}
	</section>
</div>

<Modal title="Reject this household?" open={rejectTarget !== null} onclose={() => (rejectTarget = null)} size="sm">
	<p>Reject the sign-up from <strong>{rejectTarget?.name}</strong>? It is archived, not deleted.</p>
	<div class="mt-3">
		<Label for="reject-reason">Reason (optional)</Label>
		<Textarea id="reject-reason" rows={3} maxlength={500} placeholder="For your records. It appears on the household's Information tab and is not shown to the household." bind:value={rejectReason} />
	</div>
	<div class="mt-4 flex gap-2">
		<Button color="red" disabled={!!busy} onclick={reject}>{busy.startsWith('r') ? 'Rejecting…' : 'Reject household'}</Button>
		<Button outline color="dark" onclick={() => (rejectTarget = null)}>Cancel</Button>
	</div>
</Modal>

<Modal title="Decline this request?" open={declineTarget !== null} onclose={() => (declineTarget = null)} size="sm">
	<p>Decline the request from <strong>{declineTarget?.name}</strong>? The appointment opens up again.</p>
	<div class="mt-3">
		<Label for="decline-reason">Reason (optional)</Label>
		<Textarea id="decline-reason" rows={3} maxlength={500} placeholder="For your records. It is not shown to the household on the public booking page." bind:value={declineReason} />
	</div>
	<div class="mt-4 flex gap-2">
		<Button color="red" disabled={!!busy} onclick={decline}>{busy.startsWith('d') ? 'Declining…' : 'Decline request'}</Button>
		<Button outline color="dark" onclick={() => (declineTarget = null)}>Cancel</Button>
	</div>
</Modal>

<EmailPrompts bind:this={prompts} emailEnabled={data.emailEnabled} previewAction="previewEmail" sendAction="sendEmail" idField="bookingId" audience="household" />
