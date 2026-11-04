<script lang="ts">
	import type { PageProps } from './$types';
	import { Alert, Badge, TabItem, Tabs } from 'flowbite-svelte';
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import ExpenseForm from '$lib/components/Expenses/ExpenseForm.svelte';
	import MyExpenses from '$lib/components/Expenses/MyExpenses.svelte';
	import ManageExpenses from '$lib/components/Expenses/ManageExpenses.svelte';

	let { data }: PageProps = $props();

	// Managers open on the review list; everyone else on the form
	// svelte-ignore state_referenced_locally
	let reviewOpen = $state(data.canManage);
	// svelte-ignore state_referenced_locally
	let submitOpen = $state(!data.canManage);
	let mineOpen = $state(false);
	const pendingMine = $derived(data.mine.filter((e) => e.status === 'PENDING').length);
	const files = $derived({ maxReceipts: data.limits.maxReceipts, maxMb: data.limits.maxMb, accept: data.limits.accept });
</script>

<svelte:head><title>Expenses</title></svelte:head>

<PageBreadcrumb items={[{ label: 'Expenses' }]} bar />

<div class="page-content">
	<div class="mx-auto w-full max-w-4xl space-y-3">
		<h1>Expenses</h1>
		<div class="tabs-scroll p-1">
			<Tabs tabStyle="underline" divider={false} class="tabs-panel">
				{#if data.canManage && data.all}
					<TabItem bind:open={reviewOpen} title="Review">
						<ManageExpenses all={data.all} filters={data.filters} maxRows={data.limits.maxRows} {...files} />
					</TabItem>
				{/if}
				{#if data.canSubmit}
					<TabItem bind:open={submitOpen} title="Submit">
						<ExpenseForm {...files} onsubmitted={() => (mineOpen = true)} />
					</TabItem>
					<TabItem bind:open={mineOpen}>
						{#snippet titleSlot()}<div class="flex items-center gap-2">My expenses{#if pendingMine}<Badge color="yellow">{pendingMine} pending</Badge>{/if}</div>{/snippet}
						<MyExpenses expenses={data.mine} maxRows={data.limits.maxRows} {...files} />
					</TabItem>
				{/if}
				{#if !data.canManage && !data.canSubmit}
					<Alert color="red">You don't have access to expenses.</Alert>
				{/if}
			</Tabs>
		</div>
	</div>
</div>
