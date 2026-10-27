<script lang="ts">
	import { Alert, Badge, Breadcrumb, BreadcrumbItem, Button, Card, Input } from 'flowbite-svelte';
	import { HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';
	import EmailPrompts from '$lib/components/EmailPrompts.svelte';

	let { data } = $props();

	type Shift = (typeof data.board)[number];

	let emailPrompts: ReturnType<typeof EmailPrompts> | undefined = $state();
	let busy = $state('');
	// Unsaved counts typed for each event: { [eventId]: { [role]: number } }
	let edits = $state<Record<string, Record<string, number>>>({});

	const dateFmt = $derived(new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: data.timeZone }));
	const timeFmt = $derived(new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: data.timeZone }));

	const pendingEvents = $derived(data.board.filter((e: Shift) => e.pending.length > 0));
	const pendingTotal = $derived(pendingEvents.reduce((n: number, e: Shift) => n + e.pending.length, 0));

	function value(e: Shift, role: string, saved: number) {
		return edits[e.id]?.[role] ?? saved;
	}
	function setValue(e: Shift, role: string, v: string) {
		edits[e.id] = { ...(edits[e.id] ?? {}), [role]: Math.max(0, Math.floor(Number(v) || 0)) };
	}
	const changed = (e: Shift) => e.roles.some((r: Shift["roles"][number]) => value(e, r.role, r.required) !== r.required);

	async function saveNeeds(e: Shift) {
		busy = `needs:${e.id}`;
		const counts = Object.fromEntries(e.roles.map((r: Shift["roles"][number]) => [r.role, value(e, r.role, r.required)]));
		const r = await callAction('setNeeds', { eventId: e.id, counts: JSON.stringify(counts) });
		busy = '';
		if (!r.ok) return toast(r.message);
		delete edits[e.id];
		toast('Staffing saved.');
		await invalidateAll();
	}

	async function approve(id: string) {
		busy = id;
		const r = await callAction('approve', { assignmentId: id });
		busy = '';
		if (!r.ok) {
			toast(r.message);
			await invalidateAll();
			return;
		}
		await invalidateAll();
		// Once approved, offer the confirmation email (the usual prompts)
		await emailPrompts?.start(id, 'confirmation', true);
	}

	async function decline(id: string) {
		busy = id;
		const r = await callAction('decline', { assignmentId: id });
		busy = '';
		if (!r.ok) toast(r.message);
		else toast('Signup declined.');
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Volunteer shifts</title>
</svelte:head>

<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
	<BreadcrumbItem href="/" home>
		{#snippet icon()}
			<HomeOutline class="me-2 h-4 w-4" />
		{/snippet}Home
	</BreadcrumbItem>
	<BreadcrumbItem href="/volunteers">
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}
		Volunteers
	</BreadcrumbItem>
	<BreadcrumbItem>
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}
		Shifts
	</BreadcrumbItem>
</Breadcrumb>

<div class="bg-gray-50 p-3 sm:p-5 dark:bg-gray-900">
	<div class="mx-auto w-full max-w-4xl min-w-0 space-y-6">
		<h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Volunteer shifts</h1>

		<!-- Waiting for approval -->
		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
				Waiting for approval
				{#if pendingTotal > 0}<Badge color="yellow" class="ms-2">{pendingTotal}</Badge>{/if}
			</h2>
			{#if pendingTotal === 0}
				<p class="text-gray-600 dark:text-gray-300">No signups are waiting.</p>
			{:else}
				{#each pendingEvents as e (e.id)}
					<Card class="max-w-none p-4">
						<h3 class="font-semibold wrap-break-word text-gray-900 dark:text-white">{e.title}</h3>
						<p class="mb-2 text-sm text-gray-600 dark:text-gray-300">
							{dateFmt.format(new Date(e.startTime))}, {timeFmt.format(new Date(e.startTime))} to {timeFmt.format(new Date(e.endTime))} · {e.location}
						</p>
						<ul class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each e.pending as p (p.id)}
								<li class="flex flex-wrap items-center justify-between gap-2 py-2">
									<div class="min-w-0">
										<a href={`/volunteers/${p.volunteerId}`} class="font-medium text-blue-700 hover:underline dark:text-blue-400">{p.volunteer}</a>
										<span class="text-gray-700 dark:text-gray-200"> as {p.role}</span>
										{#if !p.hasSkill}<Badge color="red" class="ms-2">No {p.role} skill on file</Badge>{/if}
									</div>
									<div class="flex gap-2">
										<Button size="xs" color="dark" disabled={busy === p.id} onclick={() => approve(p.id)}>Approve</Button>
										<Button size="xs" outline color="dark" disabled={busy === p.id} onclick={() => decline(p.id)}>Decline</Button>
									</div>
								</li>
							{/each}
						</ul>
					</Card>
				{/each}
			{/if}
		</section>

		<!-- Staffing for upcoming events -->
		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Staffing for upcoming events</h2>
			<p class="text-sm text-gray-600 dark:text-gray-300">
				Set how many volunteers each event needs in each role. Volunteers with that skill can sign up for the spots; leave a role at 0 to keep it closed.
			</p>
			{#if data.board.length === 0}
				<Alert color="blue">There are no upcoming events with volunteer roles.</Alert>
			{/if}
			{#each data.board as e (e.id)}
				<Card class="max-w-none p-4">
					<h3 class="font-semibold wrap-break-word text-gray-900 dark:text-white">{e.title}</h3>
					<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">
						{dateFmt.format(new Date(e.startTime))}, {timeFmt.format(new Date(e.startTime))} to {timeFmt.format(new Date(e.endTime))} · {e.location} · {e.type}
					</p>
					<div class="space-y-2">
						{#each e.roles as r (r.role)}
							<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
								<label for={`need-${e.id}-${r.role}`} class="w-40 text-sm font-medium text-gray-900 dark:text-white">{r.role}</label>
								<Input
									id={`need-${e.id}-${r.role}`}
									type="number"
									min="0"
									max="50"
									class="w-24"
									value={value(e, r.role, r.required)}
									oninput={(ev) => setValue(e, r.role, (ev.currentTarget as HTMLInputElement).value)}
								/>
								<span class="text-sm text-gray-600 dark:text-gray-300">
									{r.filled} filled{r.pending ? `, ${r.pending} pending` : ''}
								</span>
							</div>
						{/each}
					</div>
					<div class="mt-3">
						<Button size="sm" color="dark" disabled={!changed(e) || busy === `needs:${e.id}`} onclick={() => saveNeeds(e)}>
							{busy === `needs:${e.id}` ? 'Saving…' : 'Save staffing'}
						</Button>
					</div>
				</Card>
			{/each}
		</section>
	</div>
</div>

<EmailPrompts bind:this={emailPrompts} emailEnabled={data.emailEnabled} previewAction="previewEmail" sendAction="sendEmail" idField="assignmentId" audience="volunteer" />