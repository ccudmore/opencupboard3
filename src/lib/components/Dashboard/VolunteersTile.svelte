<script lang="ts">
	import Tile from './Tile.svelte';

	type DateRow = { id: string; title: string; start: Date | string; place: string; href: string; booked: number; needed: number };
	let { dates, pending, timeZone }: { dates: DateRow[]; pending: number; timeZone: string } = $props();

	const fmt = $derived(new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone }));
</script>

<Tile title="Volunteers" href="/volunteers/shifts" linkLabel="Shifts">
	<p class="mb-3 text-gray-900 dark:text-white">
		<a class="underline" href="/volunteers/shifts"><strong>{pending}</strong> {pending === 1 ? 'volunteer sign-up is' : 'volunteer sign-ups are'} waiting for approval</a>
	</p>

	{#if dates.length === 0}
		<p class="muted">No upcoming service dates.</p>
	{:else}
		<table class="w-full text-left text-sm text-gray-900 dark:text-gray-100">
			<thead>
				<tr class="text-gray-500 dark:text-gray-400">
					<th scope="col" class="font-medium">Date</th>
					<th scope="col" class="text-right font-medium">Booked</th>
					<th scope="col" class="text-right font-medium">Needed</th>
				</tr>
			</thead>
			<tbody>
				{#each dates as d (d.id)}
					<tr class="border-t border-gray-200 dark:border-gray-700">
						<td>
							<a class="text-blue-700 underline dark:text-blue-400" href={d.href}>{fmt.format(new Date(d.start))}</a>
						</td>
						<td class="text-right">{d.booked}</td>
						<td class="text-right" class:text-red-600={d.booked < d.needed} class:dark:text-red-400={d.booked < d.needed}>{d.needed}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Tile>
