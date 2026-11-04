<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Badge, Button } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';
	import { categoryLabel, dateOnly, money, paymentLabel, reimbursementLabel, statusInfo } from '$lib/expenses';
	import type { ExpenseRow } from '$lib/server/expenses';

	let {
		expense,
		showSubmitter = false,
		canEditReceipts = false,
		maxReceipts,
		maxMb,
		accept,
		actions
	}: {
		expense: ExpenseRow;
		showSubmitter?: boolean;
		/** the submitter while pending, or a manager */
		canEditReceipts?: boolean;
		maxReceipts: number;
		maxMb: number;
		accept: string;
		/** buttons shown under the details (for managers' decisions) */
		actions?: Snippet;
	} = $props();

	let open = $state(false);
	let busy = $state(false);
	const status = $derived(statusInfo(expense.status));
	const categories = $derived(
		expense.categories.map((c) => (c === 'OTHER' && expense.categoryOther ? `Other: ${expense.categoryOther}` : categoryLabel(c))).join(', ')
	);

	async function addFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const picked = [...(input.files ?? [])];
		input.value = '';
		busy = true;
		for (const file of picked) {
			if (file.size > maxMb * 1024 * 1024) {
				toast.error(`${file.name} is larger than ${maxMb} MB.`);
				continue;
			}
			const body = new FormData();
			body.set('expenseId', expense.id);
			body.set('file', file);
			const r = await callAction('addReceipt', body);
			if (!r.ok) toast.error(r.message);
		}
		busy = false;
		await invalidateAll();
	}

	async function removeReceipt(id: string) {
		busy = true;
		const r = await callAction('deleteReceipt', { receiptId: id });
		busy = false;
		if (!r.ok) return toast.error(r.message);
		await invalidateAll();
	}
</script>

<li class="rounded-lg border border-gray-200 dark:border-gray-700">
	<button type="button" class="flex w-full items-start justify-between gap-3 p-3 text-left" aria-expanded={open} onclick={() => (open = !open)}>
		<div class="min-w-0">
			<div class="font-medium wrap-break-word text-gray-900 dark:text-white">{expense.vendor}</div>
			<div class="hint wrap-break-word">
				{dateOnly(expense.purchaseDate)}{showSubmitter ? ` · ${expense.submitterName}` : ''} · {expense.description}
			</div>
		</div>
		<div class="shrink-0 text-right">
			<div class="font-semibold text-gray-900 dark:text-white">{money(expense.amountCents)}</div>
			<Badge color={status.color}>{status.label}</Badge>
		</div>
	</button>

	{#if open}
		<div class="space-y-3 border-t border-gray-200 p-3 text-sm dark:border-gray-700">
			<dl class="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
				<dt class="muted">Purchased</dt>
				<dd class="text-gray-900 dark:text-gray-100">{dateOnly(expense.purchaseDate)}</dd>
				{#if showSubmitter}
					<dt class="muted">Submitted by</dt>
					<dd class="text-gray-900 dark:text-gray-100">{expense.submitterName}, {dateOnly(expense.submittedAt)}</dd>
				{/if}
				<dt class="muted">Description</dt>
				<dd class="wrap-break-word text-gray-900 dark:text-gray-100">{expense.description}</dd>
				<dt class="muted">Amount</dt>
				<dd class="text-gray-900 dark:text-gray-100">{money(expense.amountCents)}{expense.taxCents != null ? `, of which tax ${money(expense.taxCents)}` : ''}</dd>
				<dt class="muted">Categories</dt>
				<dd class="wrap-break-word text-gray-900 dark:text-gray-100">{categories}</dd>
				<dt class="muted">Paid by</dt>
				<dd class="text-gray-900 dark:text-gray-100">{paymentLabel(expense.paymentMethod)}</dd>
				{#if expense.notes}
					<dt class="muted">Notes</dt>
					<dd class="wrap-break-word whitespace-pre-line text-gray-900 dark:text-gray-100">{expense.notes}</dd>
				{/if}
				{#if expense.reviewedAt && expense.status !== 'PENDING'}
					<dt class="muted">Decision</dt>
					<dd class="wrap-break-word text-gray-900 dark:text-gray-100">
						{status.label}, {dateOnly(expense.reviewedAt)}{expense.reviewNote ? `: ${expense.reviewNote}` : ''}
					</dd>
				{/if}
				{#if expense.status === 'REIMBURSED'}
					<dt class="muted">Reimbursed</dt>
					<dd class="wrap-break-word text-gray-900 dark:text-gray-100">
						{dateOnly(expense.reimbursedOn)} by {reimbursementLabel(expense.reimbursementMethod).toLowerCase()}{expense.reimbursementNote ? ` (${expense.reimbursementNote})` : ''}
					</dd>
				{/if}
			</dl>

			<div>
				<div class="mb-1 font-medium text-gray-900 dark:text-white">Receipts</div>
				{#if expense.receipts.length === 0}
					<p class="muted">No receipts attached.</p>
				{:else}
					<ul class="space-y-1">
						{#each expense.receipts as r (r.id)}
							<li class="flex items-center justify-between gap-2">
								<a class="min-w-0 wrap-break-word text-blue-700 hover:underline dark:text-blue-400" href={`/expenses/receipts/${r.id}`} target="_blank" rel="noopener">{r.name}</a>
								{#if canEditReceipts}
									<Button type="button" size="xs" outline color="red" aria-label="Remove {r.name}" disabled={busy} onclick={() => removeReceipt(r.id)}>
										<TrashBinOutline class="h-4 w-4" />
									</Button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if canEditReceipts && expense.receipts.length < maxReceipts}
					<div class="mt-2">
						<input type="file" multiple {accept} disabled={busy} aria-label="Add receipts" onchange={addFiles} />
					</div>
				{/if}
			</div>

			{@render actions?.()}
		</div>
	{/if}
</li>
