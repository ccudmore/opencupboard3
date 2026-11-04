<script lang="ts">
	import { Alert } from 'flowbite-svelte';
	import ExpenseCard from './ExpenseCard.svelte';
	import type { ExpenseRow } from '$lib/server/expenses';

	let { expenses, maxReceipts, maxMb, accept, maxRows }: { expenses: ExpenseRow[]; maxReceipts: number; maxMb: number; accept: string; maxRows: number } = $props();
</script>

<section class="tab-section">
	<h2 class="section-title">My expenses</h2>
	{#if expenses.length === 0}
		<Alert color="gray">You haven't submitted any expenses yet.</Alert>
	{:else}
		<ul class="space-y-2">
			{#each expenses as e (e.id)}
				<ExpenseCard expense={e} canEditReceipts={e.status === 'PENDING'} {maxReceipts} {maxMb} {accept} />
			{/each}
		</ul>
		{#if expenses.length >= maxRows}<p class="hint mt-2">Showing the latest {maxRows}.</p>{/if}
	{/if}
</section>
