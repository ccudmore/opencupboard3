<script lang="ts">
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import { Alert, Badge, Button, Card } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';
	import { CalendarMonthOutline, MapPinOutline, ClockOutline } from 'flowbite-svelte-icons';

	let { data } = $props();

	type Row = (typeof data.upcoming)[number];

	const dateFmt = $derived(
		new Intl.DateTimeFormat('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: data.timeZone })
	);
	const timeFmt = $derived(new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: data.timeZone }));
	const day = (d: Date | string) => dateFmt.format(new Date(d));
	const time = (d: Date | string) => timeFmt.format(new Date(d));

	let busy = $state('');

	async function run(key: string, action: string, fields: Record<string, string>, done: string) {
		busy = key;
		const r = await callAction(action, fields);
		busy = '';
		if (!r.ok) {
			toast(r.message);
			// the shift may have just filled up; refresh the list either way
			await invalidateAll();
			return;
		}
		toast(done);
		await invalidateAll();
	}

	const firstName = $derived(data.volunteer?.firstName ?? data.userName.split(' ')[0]);
	const statusLabel: Record<string, string> = { PENDING: 'Pending', ACTIVE: 'Scheduled', COMPLETE: 'Complete', NO_SHOW: 'No show' };
	const statusColor: Record<string, 'yellow' | 'green' | 'blue' | 'red'> = {
		PENDING: 'yellow',
		ACTIVE: 'green',
		COMPLETE: 'blue',
		NO_SHOW: 'red'
	};
</script>

<svelte:head>
	<title>Volunteer</title>
</svelte:head>

<PageBreadcrumb items={[{ label: 'Volunteer', href: '/volunteer' }]} bar />

{#snippet shift(r: Row)}
	<Card class="max-w-none p-4">
		<div class="flex flex-wrap items-start justify-between gap-2">
			<div class="min-w-0">
				<h3 class="wrap-break-word">{r.title}</h3>
				{#if r.role}<p class="hint">Your role: <span class="font-medium">{r.role}</span></p>{/if}
			</div>
			<Badge color={statusColor[r.status] ?? 'blue'}>{r.status === 'PENDING' ? 'Waiting for approval' : (statusLabel[r.status] ?? r.status)}</Badge>
		</div>
		<ul class="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-200">
			<li class="flex items-start gap-2"><CalendarMonthOutline class="mt-0.5 h-4 w-4 shrink-0" />{day(r.startTime)}</li>
			<li class="flex items-start gap-2"><ClockOutline class="mt-0.5 h-4 w-4 shrink-0" />{time(r.startTime)} to {time(r.endTime)}</li>
			<li class="flex items-start gap-2"><MapPinOutline class="mt-0.5 h-4 w-4 shrink-0" /><span class="wrap-break-word">{r.location}</span></li>
		</ul>
		{#if r.note}<p class="mt-3 wrap-break-word whitespace-pre-line hint">{r.note}</p>{/if}
		{#if r.status === 'PENDING' && r.endTime >= new Date()}
			<div class="mt-3">
				<Button size="xs" outline color="dark" disabled={busy === r.id} onclick={() => run(r.id, 'withdraw', { assignmentId: r.id }, 'Signup withdrawn.')}>
					{busy === r.id ? 'Withdrawing…' : 'Withdraw signup'}
				</Button>
			</div>
		{/if}
	</Card>
{/snippet}

<div class="page-content">
	<div class="mx-auto w-full max-w-3xl min-w-0 space-y-6">
		<h1>Welcome, {firstName}</h1>

		{#if !data.volunteer}
			<Alert color="blue">
				You don't have a volunteer profile yet, so there are no shifts to show. Please ask a volunteer manager to add you as a
				volunteer.
			</Alert>
		{:else if data.volunteer.status === 'ARCHIVED'}
			<Alert color="yellow">Your volunteer profile is archived, so you can't sign up for shifts. Please ask a volunteer manager to restore it.</Alert>
		{:else}
			<section class="space-y-3">
				<h2>Your upcoming shifts</h2>
				{#if data.upcoming.length === 0}
					<p class="muted">You aren't scheduled for anything right now.</p>
				{:else}
					{#each data.upcoming as r (r.id)}{@render shift(r)}{/each}
				{/if}
			</section>

			<section class="space-y-3">
				<h2>Shifts you can sign up for</h2>
				{#if (data.volunteer.skills ?? []).length === 0}
					<p class="muted">
						You don't have any skills recorded yet. Ask a volunteer coordinator which roles you can take on.
					</p>
				{:else if data.openShifts.length === 0}
					<p class="muted">There are no open shifts for your skills right now.</p>
				{:else}
					<p class="hint">A coordinator approves each signup, and then you get a confirmation email.</p>
					{#each data.openShifts as e (e.id)}
						<Card class="max-w-none p-4">
							<h3 class="wrap-break-word">{e.title}</h3>
							<ul class="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-200">
								<li class="flex items-start gap-2"><CalendarMonthOutline class="mt-0.5 h-4 w-4 shrink-0" />{day(e.startTime)}</li>
								<li class="flex items-start gap-2"><ClockOutline class="mt-0.5 h-4 w-4 shrink-0" />{time(e.startTime)} to {time(e.endTime)}</li>
								<li class="flex items-start gap-2"><MapPinOutline class="mt-0.5 h-4 w-4 shrink-0" /><span class="wrap-break-word">{e.location}</span></li>
							</ul>
							{#if e.note}<p class="mt-2 wrap-break-word whitespace-pre-line hint">{e.note}</p>{/if}
							<div class="mt-3 flex flex-wrap gap-2">
								{#each e.spots as s (s.role)}
									<Button
										size="sm"
										color="dark"
										disabled={busy === `${e.id}:${s.role}`}
										onclick={() => run(`${e.id}:${s.role}`, 'signUp', { eventId: e.id, role: s.role }, `Signed up as ${s.role}. A coordinator will approve it.`)}
									>
										Sign up as {s.role} ({s.remaining} {s.remaining === 1 ? 'spot' : 'spots'} left)
									</Button>
								{/each}
							</div>
						</Card>
					{/each}
				{/if}
			</section>

			{#if data.past.length > 0}
				<section class="space-y-3">
					<h2>Recent shifts</h2>
					{#each data.past as r (r.id)}{@render shift(r)}{/each}
				</section>
			{/if}

			<p class="hint">
				Need to change something? Contact your volunteer coordinator. You can update your icon and email under
				<a href="/usersettings" class="text-blue-700 hover:underline dark:text-blue-400">My settings</a>.
			</p>
		{/if}
	</div>
</div>
