<script lang="ts">
	import { ChevronLeftOutline, ChevronRightOutline } from 'flowbite-svelte-icons';

	let {
		marked,
		today,
		selected = '',
		onpick
	}: {
		/** days (YYYY-MM-DD) that have a service date */
		marked: string[];
		/** today's date (YYYY-MM-DD) in the organization's time zone */
		today: string;
		selected?: string;
		onpick: (date: string) => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let year = $state(Number(today.slice(0, 4)));
	// svelte-ignore state_referenced_locally
	let month = $state(Number(today.slice(5, 7)) - 1); // 0 = January

	const markedSet = $derived(new Set(marked));
	const monthName = $derived(new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }));

	const cells = $derived.by(() => {
		const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 = Sunday
		const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
		const out: (string | null)[] = Array(firstWeekday).fill(null);
		for (let d = 1; d <= days; d++) {
			out.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
		}
		return out;
	});

	function shift(by: number) {
		const d = new Date(Date.UTC(year, month + by, 1));
		year = d.getUTCFullYear();
		month = d.getUTCMonth();
	}
</script>

<div class="rounded-lg bg-white p-3 shadow-md dark:bg-gray-800">
	<div class="mb-2 flex items-center justify-between">
		<button type="button" class="rounded p-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700" onclick={() => shift(-1)} aria-label="Previous month">
			<ChevronLeftOutline class="h-5 w-5" />
		</button>
		<div class="font-semibold text-gray-900 dark:text-white" aria-live="polite">{monthName}</div>
		<button type="button" class="rounded p-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700" onclick={() => shift(1)} aria-label="Next month">
			<ChevronRightOutline class="h-5 w-5" />
		</button>
	</div>

	<div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 dark:text-gray-400">
		{#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as d, i (i)}<div class="py-1">{d}</div>{/each}
	</div>
	<div class="grid grid-cols-7 gap-1">
		{#each cells as date, i (i)}
			{#if date === null}
				<div></div>
			{:else}
				{@const has = markedSet.has(date)}
				<button
					type="button"
					onclick={() => onpick(date)}
					aria-label={`${date}${has ? ', has a service date' : ''}`}
					class="relative aspect-square rounded text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700
						{has ? 'bg-blue-100 font-semibold dark:bg-blue-900/60' : ''}
						{date === today ? 'ring-2 ring-gray-500 dark:ring-gray-300' : ''}
						{date === selected ? 'outline-2 outline-blue-600 dark:outline-blue-400' : ''}"
				>
					{Number(date.slice(8))}
					{#if has}<span class="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-600 dark:bg-blue-300"></span>{/if}
				</button>
			{/if}
		{/each}
	</div>
	<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Highlighted days have a service date. Pick a day to open it, or an empty day to add one.</p>
</div>
