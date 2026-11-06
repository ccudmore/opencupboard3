<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import Tile from './Tile.svelte';

	type Shift = { id: string; title: string; role: string; status: string; start: Date | string; place: string };
	let { shifts, timeZone }: { shifts: Shift[]; timeZone: string } = $props();

	const fmt = $derived(new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone }));

	const label = (s: string) => (s === 'PENDING' ? 'Waiting for approval' : s === 'ACTIVE' ? 'Confirmed' : s === 'COMPLETE' ? 'Completed' : s === 'NO_SHOW' ? 'No show' : s);
	const color = (s: string) => (s === 'ACTIVE' || s === 'COMPLETE' ? 'green' : s === 'PENDING' ? 'yellow' : s === 'NO_SHOW' ? 'red' : 'gray');
</script>

<Tile title="My shifts" href="/volunteer" linkLabel="My volunteering">
	{#if shifts.length === 0}
		<p class="muted">You have no upcoming shifts. Open My Volunteering to sign up for one.</p>
	{:else}
		<ul class="divide-y divide-gray-200 dark:divide-gray-700">
			{#each shifts as s (s.id)}
				<li class="flex flex-wrap items-center justify-between gap-2 py-2">
					<div class="min-w-0">
						<div class="text-gray-900 dark:text-white">{fmt.format(new Date(s.start))}</div>
						<div class="hint">{[s.title, s.role, s.place].filter(Boolean).join(' · ')}</div>
					</div>
					<Badge color={color(s.status)}>{label(s.status)}</Badge>
				</li>
			{/each}
		</ul>
	{/if}
</Tile>
