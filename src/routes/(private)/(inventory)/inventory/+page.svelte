<script lang="ts">
	import type { PageProps } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Alert, Badge, Breadcrumb, BreadcrumbItem, Button, Helper, Input, Label, Modal, Select, Textarea } from 'flowbite-svelte';
	import { ChevronDoubleRightOutline, EditOutline, HomeOutline, PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import { toast } from 'svelte-sonner';
	import { callAction } from '$lib/client/callAction';

	let { data }: PageProps = $props();
	type Item = PageProps['data']['items'][number];

	const field = 'block w-full max-w-full min-w-0';
	let busy = $state(false);

	// ---- filters (kept in the URL so a category can be bookmarked)
	let q = $state('');
	// Follows the URL, so back/forward and clearing filters update the box
	$effect(() => {
		q = data.q;
	});
	function setParam(key: string, value: string) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		goto(url, { keepFocus: true, noScroll: true });
	}
	let timer: ReturnType<typeof setTimeout>;
	const onSearch = () => {
		clearTimeout(timer);
		timer = setTimeout(() => setParam('q', q.trim()), 300);
	};
	const siteItems = $derived([{ value: '', name: 'All sites' }, ...data.sites.map((s) => ({ value: s.id, name: s.name }))]);
	const categoryItems = $derived(data.categories.map((c) => ({ value: c.id, name: c.name })));
	const activeCategory = $derived(data.categories.find((c) => c.id === data.categoryId));

	// ---- item dialog
	let itemOpen = $state(false);
	let editingId = $state('');
	let form = $state({ name: '', categoryId: '', siteId: '', room: '', shelfNumber: '', boxNumber: '', quantity: '1', notes: '' });
	let formError = $state('');

	function openItem(item?: Item) {
		formError = '';
		editingId = item?.id ?? '';
		form = item
			? { name: item.name, categoryId: item.categoryId, siteId: item.siteId, room: item.room, shelfNumber: item.shelfNumber, boxNumber: item.boxNumber, quantity: String(item.quantity), notes: item.notes }
			: {
					name: '',
					categoryId: data.categoryId || data.categories[0]?.id || '',
					siteId: data.siteId || data.sites[0]?.id || '',
					room: '',
					shelfNumber: '',
					boxNumber: '',
					quantity: '1',
					notes: ''
				};
		itemOpen = true;
	}

	async function saveItem() {
		busy = true;
		formError = '';
		const r = await callAction(editingId ? 'updateItem' : 'createItem', { ...form, ...(editingId ? { id: editingId } : {}) });
		busy = false;
		if (!r.ok) return (formError = r.message);
		itemOpen = false;
		toast.success(editingId ? 'Item saved' : 'Item added');
		await invalidateAll();
	}

	let deleteItemTarget = $state<Item | null>(null);
	async function removeItem() {
		if (!deleteItemTarget) return;
		busy = true;
		const r = await callAction('deleteItem', { id: deleteItemTarget.id });
		busy = false;
		if (!r.ok) return toast.error(r.message);
		deleteItemTarget = null;
		toast.success('Item deleted');
		await invalidateAll();
	}

	// ---- category dialog
	let catOpen = $state(false);
	let newCategory = $state('');
	let catError = $state('');
	let renames = $state<Record<string, string>>({});
	let deleteCatTarget = $state<{ id: string; name: string } | null>(null);

	function openCategories() {
		catError = '';
		newCategory = '';
		renames = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
		catOpen = true;
	}
	async function catCall(name: string, fields: Record<string, string>, done: string) {
		busy = true;
		catError = '';
		const r = await callAction(name, fields);
		busy = false;
		if (!r.ok) {
			catError = r.message;
			return false;
		}
		toast.success(done);
		await invalidateAll();
		renames = Object.fromEntries(data.categories.map((c) => [c.id, renames[c.id] ?? c.name]));
		return true;
	}
	async function addCategory() {
		if (await catCall('createCategory', { name: newCategory }, 'Category added')) newCategory = '';
	}
	async function renameCategory(id: string) {
		await catCall('renameCategory', { id, name: renames[id] ?? '' }, 'Category renamed');
	}
	async function removeCategory() {
		if (!deleteCatTarget) return;
		const { id } = deleteCatTarget;
		deleteCatTarget = null;
		if (await catCall('deleteCategory', { id }, 'Category deleted')) {
			if (data.categoryId === id) setParam('category', '');
		}
	}
	async function addCommon() {
		if (await catCall('addCommonCategories', {}, 'Categories added')) renames = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
	}

	const where = (i: Item) => [i.siteName, i.room, i.shelfNumber && `Shelf ${i.shelfNumber}`, i.boxNumber && `Box ${i.boxNumber}`].filter(Boolean).join(' · ');
</script>

<svelte:head><title>Inventory</title></svelte:head>

<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
	<BreadcrumbItem href="/" home>
		{#snippet icon()}
			<HomeOutline class="me-2 h-4 w-4" />
		{/snippet}Home
	</BreadcrumbItem>
	<BreadcrumbItem>
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}Inventory
	</BreadcrumbItem>
</Breadcrumb>

<div class="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Inventory</h1>
		<div class="flex flex-wrap gap-2">
			<Button outline color="dark" onclick={openCategories}>Manage categories</Button>
			<Button color="blue" onclick={() => openItem()} disabled={data.categories.length === 0 || data.sites.length === 0}>
				<PlusOutline class="me-1 h-4 w-4" />Add item
			</Button>
		</div>
	</div>

	{#if data.sites.length === 0}
		<Alert color="yellow">There are no sites yet. Add a site in configuration before adding inventory.</Alert>
	{/if}

	{#if data.categories.length === 0}
		<Alert color="blue">
			<p>There are no categories yet. Items need a category such as Meat, Dairy or Canned goods.</p>
			<div class="mt-2 flex flex-wrap gap-2">
				<Button size="xs" color="blue" disabled={busy} onclick={addCommon}>Add common categories</Button>
				<Button size="xs" outline color="dark" onclick={openCategories}>Add my own</Button>
			</div>
		</Alert>
	{:else}
		<!-- category filter -->
		<div class="flex flex-wrap gap-2" role="group" aria-label="Category">
			<button
				type="button"
				class="rounded-full border px-3 py-1 text-sm {data.categoryId === '' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}"
				aria-pressed={data.categoryId === ''}
				onclick={() => setParam('category', '')}
			>
				All ({data.allItemCount})
			</button>
			{#each data.categories as c (c.id)}
				<button
					type="button"
					class="rounded-full border px-3 py-1 text-sm {data.categoryId === c.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}"
					aria-pressed={data.categoryId === c.id}
					onclick={() => setParam('category', c.id)}
				>
					{c.name} ({c.itemCount})
				</button>
			{/each}
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<Label for="inv-search" class="mb-1">Search</Label>
				<Input id="inv-search" type="search" placeholder="Name, room, shelf, box or notes" bind:value={q} oninput={onSearch} class={field} />
			</div>
			<div>
				<Label for="inv-site" class="mb-1">Site</Label>
				<Select id="inv-site" items={siteItems} value={data.siteId} onchange={(e) => setParam('site', (e.currentTarget as HTMLSelectElement).value)} class={field} />
			</div>
		</div>

		<p class="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
			{data.total}
			{data.total === 1 ? 'item' : 'items'}{activeCategory ? ` in ${activeCategory.name}` : ''}
			{#if data.total > data.limit}(showing the first {data.limit}. Narrow the search to see the rest.){/if}
		</p>

		{#if data.items.length === 0}
			<Alert color="gray">No items match. {data.allItemCount === 0 ? 'Use Add item to start.' : 'Try a different category, site or search.'}</Alert>
		{:else}
			<!-- tablet and up -->
			<div class="hidden overflow-x-auto rounded-lg border border-gray-200 md:block dark:border-gray-700">
				<table class="w-full text-left text-sm text-gray-700 dark:text-gray-300">
					<thead class="bg-gray-50 text-xs text-gray-600 uppercase dark:bg-gray-800 dark:text-gray-300">
						<tr>
							<th class="px-3 py-2">Item</th>
							<th class="px-3 py-2">Category</th>
							<th class="px-3 py-2">Site</th>
							<th class="px-3 py-2">Room</th>
							<th class="px-3 py-2">Shelf</th>
							<th class="px-3 py-2">Box</th>
							<th class="px-3 py-2 text-right">Qty</th>
							<th class="px-3 py-2"><span class="sr-only">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.items as item (item.id)}
							<tr class="border-t border-gray-200 dark:border-gray-700">
								<td class="px-3 py-2 font-medium wrap-break-word text-gray-900 dark:text-white">
									{item.name}
									{#if item.notes}<div class="text-xs font-normal text-gray-500 dark:text-gray-400">{item.notes}</div>{/if}
								</td>
								<td class="px-3 py-2"><Badge>{item.categoryName}</Badge></td>
								<td class="px-3 py-2">{item.siteName}</td>
								<td class="px-3 py-2">{item.room}</td>
								<td class="px-3 py-2">{item.shelfNumber || '-'}</td>
								<td class="px-3 py-2">{item.boxNumber || '-'}</td>
								<td class="px-3 py-2 text-right">{item.quantity}</td>
								<td class="px-3 py-2">
									<div class="flex justify-end gap-1">
										<Button size="xs" outline color="dark" aria-label="Edit {item.name}" onclick={() => openItem(item)}><EditOutline class="h-4 w-4" /></Button>
										<Button size="xs" outline color="red" aria-label="Delete {item.name}" onclick={() => (deleteItemTarget = item)}><TrashBinOutline class="h-4 w-4" /></Button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- phone -->
			<ul class="space-y-2 md:hidden">
				{#each data.items as item (item.id)}
					<li class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="font-medium wrap-break-word text-gray-900 dark:text-white">{item.name}</p>
								<p class="mt-1 text-sm wrap-break-word text-gray-600 dark:text-gray-300">{where(item)}</p>
								{#if item.notes}<p class="mt-1 text-xs wrap-break-word text-gray-500 dark:text-gray-400">{item.notes}</p>{/if}
							</div>
							<div class="shrink-0 text-right">
								<Badge>{item.categoryName}</Badge>
								<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">Qty {item.quantity}</p>
							</div>
						</div>
						<div class="mt-2 flex gap-2">
							<Button size="xs" outline color="dark" onclick={() => openItem(item)}>Edit</Button>
							<Button size="xs" outline color="red" onclick={() => (deleteItemTarget = item)}>Delete</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<!-- item dialog -->
<Modal title={editingId ? 'Edit item' : 'Add item'} bind:open={itemOpen} size="md" autoclose={false}>
	<form
		class="space-y-3"
		onsubmit={(e) => {
			e.preventDefault();
			saveItem();
		}}
	>
		{#if formError}<Alert color="red">{formError}</Alert>{/if}
		<div>
			<Label for="f-name" class="mb-1">Item name</Label>
			<Input id="f-name" bind:value={form.name} maxlength={120} required class={field} />
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<Label for="f-cat" class="mb-1">Category</Label>
				<Select id="f-cat" items={categoryItems} bind:value={form.categoryId} class={field} />
			</div>
			<div>
				<Label for="f-site" class="mb-1">Site</Label>
				<Select id="f-site" items={data.sites.map((s) => ({ value: s.id, name: s.name }))} bind:value={form.siteId} class={field} />
			</div>
		</div>
		<div>
			<Label for="f-room" class="mb-1">Room</Label>
			<Input id="f-room" list="room-list" bind:value={form.room} maxlength={60} required class={field} />
			<datalist id="room-list">
				{#each data.rooms as r (r)}<option value={r}></option>{/each}
			</datalist>
		</div>
		<div class="grid gap-3 sm:grid-cols-3">
			<div>
				<Label for="f-shelf" class="mb-1">Shelf number</Label>
				<Input id="f-shelf" bind:value={form.shelfNumber} maxlength={30} class={field} />
			</div>
			<div>
				<Label for="f-box" class="mb-1">Box number</Label>
				<Input id="f-box" bind:value={form.boxNumber} maxlength={30} class={field} />
			</div>
			<div>
				<Label for="f-qty" class="mb-1">Quantity</Label>
				<Input id="f-qty" type="number" min="0" step="1" inputmode="numeric" bind:value={form.quantity} class={field} />
			</div>
		</div>
		<div>
			<Label for="f-notes" class="mb-1">Notes</Label>
			<Textarea id="f-notes" rows={2} maxlength={500} bind:value={form.notes} class={field} />
			<Helper>Optional. For example a best-before date.</Helper>
		</div>
		<div class="flex gap-2 pt-1">
			<Button type="submit" color="blue" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
			<Button type="button" outline color="dark" onclick={() => (itemOpen = false)}>Cancel</Button>
		</div>
	</form>
</Modal>

<!-- delete item -->
<Modal title="Delete item" open={deleteItemTarget !== null} onclose={() => (deleteItemTarget = null)} size="xs" autoclose={false}>
	<p class="text-gray-600 dark:text-gray-300">Delete {deleteItemTarget?.name}? This can't be undone.</p>
	{#snippet footer()}
		<Button color="red" disabled={busy} onclick={removeItem}>Yes, delete</Button>
		<Button outline color="dark" onclick={() => (deleteItemTarget = null)}>Cancel</Button>
	{/snippet}
</Modal>

<!-- categories -->
<Modal title="Categories" bind:open={catOpen} size="md" autoclose={false}>
	{#if catError}<Alert color="red">{catError}</Alert>{/if}
	<form
		class="flex items-end gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			addCategory();
		}}
	>
		<div class="min-w-0 grow">
			<Label for="c-new" class="mb-1">New category</Label>
			<Input id="c-new" bind:value={newCategory} maxlength={60} class={field} />
		</div>
		<Button type="submit" color="blue" disabled={busy || !newCategory.trim()}>Add</Button>
	</form>
	<ul class="space-y-2">
		{#each data.categories as c (c.id)}
			<li class="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
				<form
					class="flex items-center gap-2"
					onsubmit={(e) => {
						e.preventDefault();
						renameCategory(c.id);
					}}
				>
					<Input aria-label="Name of {c.name}" bind:value={renames[c.id]} maxlength={60} class="{field} grow" />
					<Button type="submit" size="xs" outline color="dark" disabled={busy || !renames[c.id]?.trim() || renames[c.id] === c.name}>Rename</Button>
					<Button type="button" size="xs" outline color="red" aria-label="Delete {c.name}" disabled={busy} onclick={() => (deleteCatTarget = { id: c.id, name: c.name })}>
						<TrashBinOutline class="h-4 w-4" />
					</Button>
				</form>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{c.itemCount} {c.itemCount === 1 ? 'item' : 'items'}</p>
			</li>
		{/each}
	</ul>
	{#snippet footer()}
		<Button outline color="dark" onclick={() => (catOpen = false)}>Done</Button>
	{/snippet}
</Modal>

<Modal title="Delete category" open={deleteCatTarget !== null} onclose={() => (deleteCatTarget = null)} size="xs" autoclose={false}>
	<p class="text-gray-600 dark:text-gray-300">Delete the category {deleteCatTarget?.name}? A category that still has items can't be deleted.</p>
	{#snippet footer()}
		<Button color="red" disabled={busy} onclick={removeCategory}>Yes, delete</Button>
		<Button outline color="dark" onclick={() => (deleteCatTarget = null)}>Cancel</Button>
	{/snippet}
</Modal>