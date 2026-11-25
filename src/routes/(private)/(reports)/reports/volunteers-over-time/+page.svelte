<script lang="ts">
	import { goto } from '$app/navigation';
	import { Label, Select } from 'flowbite-svelte';
	import PageBreadcrumb from '#lib/components/PageBreadcrumb.svelte';
	import LineChart from '#lib/components/Reports/LineChart.svelte';

	let { data } = $props();

	const monthChoices = [6, 12, 24, 36].map((m) => ({ value: m, name: `Last ${m} months` }));
	const series = $derived([
		{ name: 'Active volunteers', values: data.trend.activeVolunteers, color: '#2563eb' }
	]);
</script>

<div class="p-4">
	<PageBreadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Active volunteers' }]} />
	<h1 class="mt-4 mb-1 text-2xl font-semibold text-gray-900 dark:text-white">Active volunteers</h1>
	<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
		Volunteers registered and not archived, at the end of each month.
	</p>
	<div class="mb-4 max-w-xs min-w-48">
		<Label for="months" class="mb-2">Period</Label>
		<Select
			id="months"
			items={monthChoices}
			value={data.months}
			onchange={(e: Event) =>
				void goto(`?months=${(e.target as HTMLSelectElement).value}`, {
					reset: false,
					replace: true
				})}
		/>
	</div>
	<div
		class="max-w-5xl rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
	>
		<LineChart labels={data.trend.labels} {series} ariaLabel="Active volunteers by month" />
	</div>
	{#if data.trend.estimated}
		<p class="mt-3 max-w-5xl text-xs text-gray-500 dark:text-gray-400">
			{data.trend.estimated}
			{data.trend.estimated === 1 ? 'volunteer has' : 'volunteers have'} no recorded history, so their
			past is estimated from when they registered and were archived.
		</p>
	{/if}
</div>
