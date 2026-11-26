<script lang="ts">
	import PageBreadcrumb from '#lib/components/PageBreadcrumb.svelte';
	import { Card } from 'flowbite-svelte';

	let { data } = $props();

	const reports = $derived([
		{
			href: '/reports/current-counts',
			title: 'Current counts',
			text: 'Active households today, and the adults and children in them.'
		},
		{
			href: '/reports/households-over-time',
			title: 'Households and people served',
			text: 'Active households, households served and people served by month. Adults and children can be shown separately.'
		},
		{
			href: '/reports/volunteers-over-time',
			title: 'Active volunteers',
			text: 'The number of active volunteers at the end of each month.'
		},
		{
			href: '/reports/household-heatmap',
			title: 'Household heat map',
			text: 'Where active households are concentrated, shown on a map. Locations are approximate (about 500 m).'
		},
		// listed only for people who may open it
		...(data.canSeeExpenses
			? [
					{
						href: '/reports/expenses-by-month',
						title: 'Expenses by month',
						text: 'Spending by month, as a graph and a table.'
					}
				]
			: [])
	]);
</script>

<div class="p-4">
	<PageBreadcrumb items={[{ label: 'Reports' }]} />
	<h1 class="mt-4 mb-4 text-2xl font-semibold text-gray-900 dark:text-white">Reports</h1>
	<div class="grid max-w-4xl gap-4 sm:grid-cols-2">
		{#each reports as r (r.href)}
			<Card href={r.href} class="max-w-none p-4">
				<h2 class="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{r.title}</h2>
				<p class="text-sm text-gray-600 dark:text-gray-400">{r.text}</p>
			</Card>
		{/each}
	</div>
</div>
