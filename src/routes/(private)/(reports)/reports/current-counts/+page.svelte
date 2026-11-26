<script lang="ts">
	import { CHILD_AGE_LIMIT } from '$app/env/public';
	import PageBreadcrumb from '#lib/components/PageBreadcrumb.svelte';

	let { data } = $props();
	const tiles = $derived([
		{ label: 'Active households', value: data.counts.households },
		{ label: 'Adults', value: data.counts.adults },
		{ label: 'Children', value: data.counts.children },
		{ label: 'People in total', value: data.counts.people }
	]);
</script>

<div class="p-4">
	<PageBreadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Current counts' }]} />
	<h1 class="mt-4 mb-1 text-2xl font-semibold text-gray-900 dark:text-white">Current counts</h1>
	<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
		Active households and the adults and children in them, as they are today. Members under {CHILD_AGE_LIMIT} count
		as children and everyone else as an adult.
	</p>
	<div class="grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
		{#each tiles as t (t.label)}
			<div
				class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="text-sm text-gray-500 dark:text-gray-400">{t.label}</div>
				<div class="mt-1 text-3xl font-semibold text-gray-900 tabular-nums dark:text-white">
					{t.value.toLocaleString()}
				</div>
			</div>
		{/each}
	</div>
	{#if data.counts.missing}
		<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
			{data.counts.missing}
			{data.counts.missing === 1 ? 'active household has' : 'active households have'} no members entered,
			so they add to the household count but not to the adults or children.
		</p>
	{/if}
</div>
