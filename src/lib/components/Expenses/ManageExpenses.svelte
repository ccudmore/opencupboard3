<script lang="ts">
	import { Alert, Button, Datepicker, Input, Label, Modal, Select, Textarea, Toggle } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { callAction } from '$lib/client/callAction';
	import { REIMBURSEMENT_METHODS, fromIsoDate, money, toIsoDate } from '$lib/expenses';
	import type { ExpenseRow } from '$lib/server/expenses';
	import ExpenseCard from './ExpenseCard.svelte';

	let {
		all,
		filters,
		maxReceipts,
		maxMb,
		accept,
		maxRows
	}: {
		all: { expenses: ExpenseRow[]; total: number; totalCents: number };
		filters: { pendingOnly: boolean; from: string; to: string };
		maxReceipts: number;
		maxMb: number;
		accept: string;
		maxRows: number;
	} = $props();

	// ---- filters live in the address, so a view can be bookmarked and the back button works
	let from = $state<Date | undefined>(undefined);
	let to = $state<Date | undefined>(undefined);
	$effect(() => {
		from = fromIsoDate(filters.from);
		to = fromIsoDate(filters.to);
	});

	function apply(next: { pending?: boolean; from?: Date | undefined; to?: Date | undefined }) {
		const url = new URL(page.url);
		const pending = next.pending ?? filters.pendingOnly;
		if (pending) url.searchParams.delete('pending');
		else url.searchParams.set('pending', '0');
		for (const [key, value] of [['from', 'from' in next ? next.from : from], ['to', 'to' in next ? next.to : to]] as const) {
			const iso = toIsoDate(value);
			if (iso) url.searchParams.set(key, iso);
			else url.searchParams.delete(key);
		}
		goto(url, { keepFocus: true, noScroll: true });
	}
	const rangeError = $derived(from && to && toIsoDate(from) > toIsoDate(to) ? 'The start date is after the end date.' : '');
	const hasRange = $derived(!!filters.from || !!filters.to);

	// ---- decisions
	type Target = { expense: ExpenseRow; status: 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'PENDING' };
	let target = $state<Target | null>(null);
	let reviewNote = $state('');
	let reimbursedOn = $state<Date | undefined>(new Date());
	let method = $state('E_TRANSFER');
	let reimbursementNote = $state('');
	let busy = $state(false);
	let error = $state('');

	const reimbursementItems = REIMBURSEMENT_METHODS.map((m) => ({ value: m.value, name: m.label }));
	const TITLES = { APPROVED: 'Approve expense', REJECTED: 'Reject expense', REIMBURSED: 'Mark as reimbursed', PENDING: 'Move back to pending' } as const;

	function ask(expense: ExpenseRow, status: Target['status']) {
		target = { expense, status };
		error = '';
		reviewNote = '';
		reimbursementNote = '';
		reimbursedOn = new Date();
		method = 'E_TRANSFER';
	}

	async function confirm() {
		if (!target) return;
		busy = true;
		error = '';
		const fields: Record<string, string> = { expenseId: target.expense.id, status: target.status, reviewNote };
		if (target.status === 'REIMBURSED') {
			fields.reimbursedOn = toIsoDate(reimbursedOn);
			fields.reimbursementMethod = method;
			fields.reimbursementNote = reimbursementNote;
		}
		const r = await callAction('decide', fields);
		busy = false;
		if (!r.ok) return (error = r.message);
		toast.success('Saved.');
		target = null;
		await invalidateAll();
	}
</script>

<section class="tab-section space-y-4">
	<h2 class="section-title mb-0">All expenses</h2>

	<div class="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_auto]">
		<div class="pb-2">
			<Toggle checked={filters.pendingOnly} onchange={(e) => apply({ pending: (e.currentTarget as HTMLInputElement).checked })}>Pending only</Toggle>
		</div>
		<div>
			<Label>Purchased from</Label>
			<Datepicker bind:value={from} onselect={(d) => apply({ from: d as Date })} onclear={() => apply({ from: undefined })} locale="en-CA" firstDayOfWeek={1} inputClass="w-full" />
		</div>
		<div>
			<Label>Purchased to</Label>
			<Datepicker bind:value={to} onselect={(d) => apply({ to: d as Date })} onclear={() => apply({ to: undefined })} locale="en-CA" firstDayOfWeek={1} inputClass="w-full" />
		</div>
		<div>
			<Button type="button" outline color="dark" disabled={!hasRange} onclick={() => apply({ from: undefined, to: undefined })}>Clear dates</Button>
		</div>
	</div>
	{#if rangeError}<Alert color="yellow">{rangeError}</Alert>{/if}

	<p class="hint" aria-live="polite">
		{all.total} {all.total === 1 ? 'expense' : 'expenses'}, {money(all.totalCents)} in total{filters.pendingOnly ? ' (pending only)' : ''}.
		{#if all.total > maxRows}Showing the latest {maxRows}. Narrow the dates to see the rest.{/if}
	</p>

	{#if all.expenses.length === 0}
		<Alert color="gray">{filters.pendingOnly ? 'Nothing is waiting for review.' : 'No expenses match.'}</Alert>
	{:else}
		<ul class="space-y-2">
			{#each all.expenses as e (e.id)}
				<ExpenseCard expense={e} showSubmitter canEditReceipts {maxReceipts} {maxMb} {accept}>
					{#snippet actions()}
						<div class="flex flex-wrap gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
							{#if e.status !== 'APPROVED'}<Button size="xs" color="blue" onclick={() => ask(e, 'APPROVED')}>Approve</Button>{/if}
							{#if e.status !== 'REJECTED'}<Button size="xs" outline color="red" onclick={() => ask(e, 'REJECTED')}>Reject</Button>{/if}
							{#if e.status !== 'REIMBURSED'}<Button size="xs" color="green" onclick={() => ask(e, 'REIMBURSED')}>Mark reimbursed</Button>{/if}
							{#if e.status !== 'PENDING'}<Button size="xs" outline color="dark" onclick={() => ask(e, 'PENDING')}>Back to pending</Button>{/if}
						</div>
					{/snippet}
				</ExpenseCard>
			{/each}
		</ul>
	{/if}
</section>

<Modal title={target ? TITLES[target.status] : ''} open={target !== null} onclose={() => (target = null)} size="sm" autoclose={false}>
	{#if target}
		<p class="hint">{target.expense.vendor}, {money(target.expense.amountCents)}, submitted by {target.expense.submitterName}.</p>
		{#if error}<Alert color="red">{error}</Alert>{/if}

		{#if target.status === 'REIMBURSED'}
			<div class="space-y-3">
				<div>
					<Label>Date reimbursed</Label>
					<Datepicker bind:value={reimbursedOn} locale="en-CA" firstDayOfWeek={1} inputClass="w-full" />
				</div>
				<div>
					<Label for="d-method">How</Label>
					<Select id="d-method" items={reimbursementItems} bind:value={method} />
				</div>
				<div>
					<Label for="d-rnote">Details (optional)</Label>
					<Input id="d-rnote" maxlength={300} placeholder="Cheque number, e-transfer reference…" bind:value={reimbursementNote} />
				</div>
			</div>
		{/if}

		{#if target.status === 'REJECTED' || target.status === 'APPROVED'}
			<div>
				<Label for="d-note">{target.status === 'REJECTED' ? 'Reason (the person will see this)' : 'Note (optional)'}</Label>
				<Textarea id="d-note" rows={3} maxlength={500} bind:value={reviewNote} />
			</div>
		{/if}
	{/if}
	{#snippet footer()}
		<Button color={target?.status === 'REJECTED' ? 'red' : 'blue'} disabled={busy} onclick={confirm}>{busy ? 'Saving…' : 'Confirm'}</Button>
		<Button outline color="dark" onclick={() => (target = null)}>Cancel</Button>
	{/snippet}
</Modal>
