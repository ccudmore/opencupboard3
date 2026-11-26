<script lang="ts">
	import { goto } from '$app/navigation';
	import { Label, Select, Toggle } from 'flowbite-svelte';
	import PageBreadcrumb from '#lib/components/PageBreadcrumb.svelte';
	import BarChart from '#lib/components/Reports/BarChart.svelte';
	import { money } from '#lib/expenses.ts';

	let { data } = $props();

	const monthChoices = [6, 12, 24, 36].map((m) => ({ value: m, name: `Last ${m} months` }));
	function apply(months: number, pending: boolean) {
		const p = new URLSearchParams({ months: String(months) });
		if (pending) p.set('pending', '1');
		void goto(`?${p}`, { reset: false, replace: true });
	}

	const whole = new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD',
		maximumFractionDigits: 0
	});
	const labels = $derived(data.report.months.map((m) => m.label));
	const values = $derived(data.report.months.map((m) => m.totalCents / 100));
</script>

<div class="p-4">
	<PageBreadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Expenses by month' }]} />
	<h1 class="mt-4 mb-1 text-2xl font-semibold text-gray-900 dark:text-white">Expenses by month</h1>
	<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
		By the date of purchase. Totals are approved and reimbursed expenses; rejected expenses are never
		counted.
	</p>

	<div class="mb-4 flex flex-wrap items-end gap-4">
		<div class="min-w-48">
			<Label for="months" class="mb-2">Period</Label>
			<Select
				id="months"
				items={monthChoices}
				value={data.months}
				onchange={(e: Event) =>
					apply(Number((e.target as HTMLSelectElement).value), data.includePending)}
			/>
		</div>
		<Toggle
			checked={data.includePending}
			onchange={(e: Event) => apply(data.months, (e.target as HTMLInputElement).checked)}
		>
			Include expenses awaiting review
		</Toggle>
	</div>

	<div
		class="max-w-5xl rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
	>
		<BarChart
			{labels}
			{values}
			seriesName="Expenses"
			format={(v) => money(Math.round(v * 100))}
			tickFormat={(v) => whole.format(v)}
			ariaLabel="Expenses by month"
		/>
	</div>

	<div class="mt-6 max-w-5xl overflow-x-auto">
		<table class="min-w-full text-left text-sm text-gray-700 dark:text-gray-300">
			<thead class="text-xs text-gray-500 uppercase dark:text-gray-400">
				<tr>
					<th class="py-2 pe-4">Month</th>
					<th class="py-2 pe-4 text-right">Expenses</th>
					<th class="py-2 pe-4 text-right">Total</th>
					<th class="py-2 pe-4 text-right">Of which tax</th>
					<th class="py-2 text-right">Awaiting review</th>
				</tr>
			</thead>
			<tbody>
				{#each data.report.months as m (m.label)}
					<tr class="border-t border-gray-200 dark:border-gray-700">
						<td class="py-1.5 pe-4">{m.label}</td>
						<td class="py-1.5 pe-4 text-right tabular-nums">{m.count}</td>
						<td class="py-1.5 pe-4 text-right tabular-nums">{money(m.totalCents)}</td>
						<td class="py-1.5 pe-4 text-right tabular-nums">{money(m.taxCents)}</td>
						<td class="py-1.5 text-right tabular-nums">
							{#if m.pendingCount}{money(m.pendingCents)} ({m.pendingCount}){:else}&ndash;{/if}
						</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr class="border-t-2 border-gray-300 font-semibold dark:border-gray-600">
					<td class="py-2 pe-4">Total</td>
					<td class="py-2 pe-4 text-right tabular-nums">{data.report.totals.count}</td>
					<td class="py-2 pe-4 text-right tabular-nums">{money(data.report.totals.totalCents)}</td>
					<td class="py-2 pe-4 text-right tabular-nums">{money(data.report.totals.taxCents)}</td>
					<td class="py-2 text-right tabular-nums">{money(data.report.totals.pendingCents)}</td>
				</tr>
			</tfoot>
		</table>
	</div>
</div>
