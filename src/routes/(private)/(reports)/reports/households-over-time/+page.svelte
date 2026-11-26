<script lang="ts">
	import { goto } from '$app/navigation';
	import { Label, Select, Toggle } from 'flowbite-svelte';
	import { CHILD_AGE_LIMIT } from '$app/env/public';
	import PageBreadcrumb from '#lib/components/PageBreadcrumb.svelte';
	import LineChart from '#lib/components/Reports/LineChart.svelte';

	let { data } = $props();

	const monthChoices = [6, 12, 24, 36].map((m) => ({ value: m, name: `Last ${m} months` }));
	function apply(months: number, split: boolean) {
		const p = new URLSearchParams({ months: String(months) });
		if (split) p.set('split', '1');
		void goto(`?${p}`, { reset: false, replace: true });
	}

	const series = $derived([
		{ name: 'Active households', values: data.trend.activeHouseholds, color: '#2563eb' },
		{ name: 'Households served', values: data.trend.householdsServed, color: '#d97706' },
		...(data.split
			? [
					{ name: 'Adults served', values: data.trend.adultsServed, color: '#059669' },
					{ name: 'Children served', values: data.trend.childrenServed, color: '#7c3aed' }
				]
			: [{ name: 'People served', values: data.trend.peopleServed, color: '#059669' }])
	]);
</script>

<div class="p-4">
	<PageBreadcrumb
		items={[{ label: 'Reports', href: '/reports' }, { label: 'Households and people served' }]}
	/>
	<h1 class="mt-4 mb-1 text-2xl font-semibold text-gray-900 dark:text-white">
		Households and people served
	</h1>
	<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
		By month. “Served” counts households with a completed booking in that month, each household once.
	</p>

	<div class="mb-4 flex flex-wrap items-end gap-4">
		<div class="min-w-48">
			<Label for="months" class="mb-2">Period</Label>
			<Select
				id="months"
				items={monthChoices}
				value={data.months}
				onchange={(e: Event) => apply(Number((e.target as HTMLSelectElement).value), data.split)}
			/>
		</div>
		<Toggle
			checked={data.split}
			onchange={(e: Event) => apply(data.months, (e.target as HTMLInputElement).checked)}
		>
			Show adults and children separately
		</Toggle>
	</div>

	<div
		class="max-w-5xl rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
	>
		<LineChart
			labels={data.trend.labels}
			{series}
			ariaLabel="Active households, households served and people served by month"
		/>
	</div>

	<ul class="mt-3 max-w-5xl list-disc ps-5 text-xs text-gray-500 dark:text-gray-400">
		<li>
			Active households is the number whose status was Active at the end of the month. The app
			records each status change, so this is exact from when the history began.
			{#if data.trend.estimated}
				{data.trend.estimated}
				{data.trend.estimated === 1 ? 'household has' : 'households have'} no recorded history, so
				their past is estimated from when they registered and their last completed visit.
			{/if}
		</li>
		<li>
			Adults and children come from the household's members when each visit was marked complete
			(under {CHILD_AGE_LIMIT} is a child, everyone else an adult). Older visits use the household's current
			members.
			{#if data.trend.servedWithoutCounts}
				{data.trend.servedWithoutCounts}
				{data.trend.servedWithoutCounts === 1 ? 'household served has' : 'households served have'} no
				members entered and add nothing to the people numbers.
			{/if}
		</li>
	</ul>
</div>
