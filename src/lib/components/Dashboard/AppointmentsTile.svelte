<script lang="ts">
	import Tile from './Tile.svelte';

	type DateRow = { id: string; title: string; start: Date | string; place: string; href: string; booked: number; available: number };
	let {
		dates,
		pending,
		canReview,
		timeZone
	}: { dates: DateRow[]; pending: number; canReview: boolean; timeZone: string } = $props();

	const fmt = $derived(new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone }));
</script>

<Tile title="Service dates" href="/servicedates" linkLabel="All service dates">
	<p class="mb-3 text-gray-900 dark:text-white">
		{#if canReview}
			<a class="underline" href="/households/pending"><strong>{pending}</strong> {pending === 1 ? 'appointment is' : 'appointments are'} waiting for approval</a>
		{:else}
			<strong>{pending}</strong> {pending === 1 ? 'appointment is' : 'appointments are'} waiting for approval
		{/if}
	</p>

	{#if dates.length === 0}
		<p class="muted">No upcoming service dates.</p>
	{:else}
		<table class="w-full text-left text-sm text-gray-900 dark:text-gray-100">
			<thead>
				<tr class="text-gray-500 dark:text-gray-400">
					<th scope="col" class="font-medium">Date</th>
					<th scope="col" class="text-right font-medium">Booked</th>
					<th scope="col" class="text-right font-medium">Available</th>
				</tr>
			</thead>
			<tbody>
				{#each dates as d (d.id)}
					<tr class="border-t border-gray-200 dark:border-gray-700">
						<td>
							<a class="text-blue-700 underline dark:text-blue-400" href={d.href}>{fmt.format(new Date(d.start))}</a>
							{#if d.place}<div class="hint">{d.place}</div>{/if}
						</td>
						<td class="text-right">{d.booked}</td>
						<td class="text-right">{d.available}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Tile>
