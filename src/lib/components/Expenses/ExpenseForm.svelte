<script lang="ts">
	import { Alert, Button, Datepicker, Helper, Input, Label, Select, Textarea } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';
	import { CATEGORIES, PAYMENT_METHODS, toIsoDate } from '$lib/expenses';

	let {
		maxReceipts,
		maxMb,
		accept,
		onsubmitted
	}: { maxReceipts: number; maxMb: number; accept: string; onsubmitted?: () => void } = $props();

	const empty = () => ({ vendor: '', description: '', amount: '', tax: '', categoryOther: '', paymentMethod: '', notes: '' });

	let purchaseDate = $state<Date | undefined>(new Date());
	let form = $state(empty());
	let categories = $state<string[]>([]);
	let files = $state<File[]>([]);
	let fileInput: HTMLInputElement | undefined = $state();
	let busy = $state(false);
	let error = $state('');

	const paymentItems = [{ value: '', name: 'Choose…' }, ...PAYMENT_METHODS.map((m) => ({ value: m.value, name: m.label }))];

	function toggle(value: string, on: boolean) {
		categories = on ? [...categories, value] : categories.filter((c) => c !== value);
	}

	function pick(event: Event) {
		error = '';
		const picked = [...((event.currentTarget as HTMLInputElement).files ?? [])];
		const next = [...files];
		for (const f of picked) {
			if (f.size > maxMb * 1024 * 1024) error = `${f.name} is larger than ${maxMb} MB, so it was not added.`;
			else if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
		}
		if (next.length > maxReceipts) error = `Up to ${maxReceipts} receipts can be attached.`;
		files = next.slice(0, maxReceipts);
		if (fileInput) fileInput.value = ''; // so the same file can be picked again after removing it
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		busy = true;

		const data = new FormData();
		data.set('purchaseDate', toIsoDate(purchaseDate));
		for (const [k, v] of Object.entries(form)) data.set(k, v);
		for (const c of categories) data.append('categories', c);

		const created = await callAction('submit', data);
		if (!created.ok) {
			busy = false;
			return (error = created.message);
		}

		// The expense exists now. Receipts go one at a time so a bad one doesn't lose the rest.
		const expenseId: string = created.data.id;
		const problems: string[] = [];
		for (const file of files) {
			const body = new FormData();
			body.set('expenseId', expenseId);
			body.set('file', file);
			const r = await callAction('addReceipt', body);
			if (!r.ok) problems.push(r.message);
		}
		busy = false;

		if (problems.length) {
			toast.warning(`Expense submitted, but ${problems.length === 1 ? 'a receipt was' : `${problems.length} receipts were`} not saved: ${problems[0]} You can add receipts from My expenses while it is pending.`);
		} else {
			toast.success('Expense submitted. It is pending review.');
		}
		purchaseDate = new Date();
		form = empty();
		categories = [];
		files = [];
		await invalidateAll();
		onsubmitted?.();
	}
</script>

<form class="tab-section space-y-4" onsubmit={submit}>
	<h2 class="section-title mb-0">Submit an expense</h2>
	{#if error}<Alert color="red">{error}</Alert>{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div>
			<Label>Purchase date</Label>
			<Datepicker bind:value={purchaseDate} locale="en-CA" firstDayOfWeek={1} inputClass="w-full" />
		</div>
		<div>
			<Label for="ex-vendor">Store or vendor</Label>
			<Input id="ex-vendor" required maxlength={120} autocomplete="off" bind:value={form.vendor} />
		</div>
		<div class="md:col-span-2">
			<Label for="ex-desc">Description</Label>
			<Input id="ex-desc" required maxlength={300} autocomplete="off" bind:value={form.description} />
		</div>
		<div>
			<Label for="ex-amount">Amount (total paid, CAD)</Label>
			<Input id="ex-amount" required inputmode="decimal" placeholder="0.00" autocomplete="off" bind:value={form.amount} />
		</div>
		<div>
			<Label for="ex-tax">Tax paid (optional)</Label>
			<Input id="ex-tax" inputmode="decimal" placeholder="0.00" autocomplete="off" bind:value={form.tax} />
			<Helper class="field-help">The part of the amount that was tax, such as GST/HST.</Helper>
		</div>
		<div>
			<Label for="ex-pay">Payment method</Label>
			<Select id="ex-pay" required items={paymentItems} bind:value={form.paymentMethod} />
		</div>
	</div>

	<fieldset>
		<legend>Categories (choose all that apply)</legend>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#each CATEGORIES as c (c.value)}
				<label class="check-label">
					<input type="checkbox" checked={categories.includes(c.value)} onchange={(e) => toggle(c.value, (e.currentTarget as HTMLInputElement).checked)} />
					{c.label}
				</label>
			{/each}
		</div>
		{#if categories.includes('OTHER')}
			<div class="mt-3">
				<Label for="ex-other">What was the "Other"?</Label>
				<Input id="ex-other" required maxlength={200} autocomplete="off" bind:value={form.categoryOther} />
			</div>
		{/if}
	</fieldset>

	<div>
		<Label for="ex-receipts">Receipts (photos or PDFs)</Label>
		<input id="ex-receipts" type="file" multiple {accept} bind:this={fileInput} onchange={pick} />
		<Helper class="field-help">Up to {maxReceipts} files, {maxMb} MB each. You can pick files more than once to add more.</Helper>
		{#if files.length}
			<ul class="mt-2 space-y-1">
				{#each files as f, i (f.name + f.size)}
					<li class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700">
						<span class="min-w-0 wrap-break-word text-gray-900 dark:text-gray-100">{f.name}</span>
						<Button type="button" size="xs" outline color="red" aria-label="Remove {f.name}" onclick={() => (files = files.filter((_, n) => n !== i))}>
							<TrashBinOutline class="h-4 w-4" />
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div>
		<Label for="ex-notes">Notes (optional)</Label>
		<Textarea id="ex-notes" rows={3} maxlength={1000} bind:value={form.notes} />
	</div>

	<Button type="submit" color="blue" disabled={busy}>{busy ? 'Submitting…' : 'Submit expense'}</Button>
</form>
