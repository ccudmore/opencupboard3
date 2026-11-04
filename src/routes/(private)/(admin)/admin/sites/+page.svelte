<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button, Drawer, Input, Label, Modal, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { callAction } from '$lib/client/callAction';
	import { streetWithUnit } from '$lib/address';

	let { data } = $props();

	const drawerClass = 'max-h-[90vh] overflow-y-auto bg-white p-1 text-gray-900 backdrop:bg-black/50 dark:bg-gray-800 dark:text-white';
	type Site = (typeof data.sites)[number];

	const blank = () => ({ name: '', unitNumber: '', street: '', city: '', postalCode: '', province: 'Ontario', country: 'Canada' });

	let open = $state(false);
	let editing = $state<Site | null>(null); // null means adding a new site
	let f = $state(blank());
	let error = $state('');
	let busy = $state(false);
	let confirmDelete = $state(false);

	const inUse = (s: Site) => s._count.events + s._count.appointments + s._count.inventoryItems;
	const address = (s: Site) => [streetWithUnit(s.street, s.unitNumber), s.city, s.postalCode].filter(Boolean).join(', ');

	function openNew() {
		editing = null;
		f = blank();
		error = '';
		open = true;
	}

	function openEdit(s: Site) {
		editing = s;
		f = {
			name: s.name,
			unitNumber: s.unitNumber ?? '',
			street: s.street ?? '',
			city: s.city ?? '',
			postalCode: s.postalCode ?? '',
			province: s.province,
			country: s.country
		};
		error = '';
		open = true;
	}

	async function save() {
		busy = true;
		error = '';
		const result = await callAction(editing ? 'updateSite' : 'createSite', editing ? { siteId: editing.id, ...f } : { ...f });
		busy = false;
		if (!result.ok) {
			error = result.message;
			return;
		}
		toast(editing ? 'Site saved' : 'Site added');
		open = false;
		await invalidateAll();
	}

	async function remove() {
		if (!editing) return;
		busy = true;
		const result = await callAction('deleteSite', { siteId: editing.id });
		busy = false;
		confirmDelete = false;
		if (!result.ok) {
			error = result.message;
			return;
		}
		toast('Site deleted');
		open = false;
		await invalidateAll();
	}

	const ignoreEnter = (e: KeyboardEvent) => e.key === 'Enter' && e.preventDefault();
</script>

<div class="flex items-center p-4">
	<h2 class="section-title">Sites</h2>
	<div class="ml-auto">
		<Button outline color="dark" onclick={openNew}><PlusOutline class="mr-2 h-3.5 w-3.5" />New Site</Button>
	</div>
</div>

{#if data.sites.length === 0}
	<p class="px-4 pb-4 text-gray-500 dark:text-gray-400">No sites yet.</p>
{:else}
	<div class="hidden md:block">
		<Table hoverable={true}>
			<TableHead>
				<TableHeadCell scope="col">Site</TableHeadCell>
				<TableHeadCell scope="col">Address</TableHeadCell>
				<TableHeadCell scope="col">In use</TableHeadCell>
			</TableHead>
			<TableBody class="divide-y">
				{#each data.sites as site (site.id)}
					<TableBodyRow class="cursor-pointer" onclick={() => openEdit(site)}>
						<TableBodyCell class="font-medium text-gray-900 dark:text-white">{site.name}</TableBodyCell>
						<TableBodyCell class="whitespace-normal">{address(site) || '—'}</TableBodyCell>
						<TableBodyCell>{inUse(site) ? 'Yes' : 'No'}</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	</div>

	<ul class="divide-y divide-gray-200 md:hidden dark:divide-gray-700">
		{#each data.sites as site (site.id)}
			<li>
				<button type="button" class="block w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700" onclick={() => openEdit(site)}>
					<div class="truncate font-semibold text-gray-900 dark:text-white">{site.name}</div>
					<div class="hint">{address(site) || 'No address'}</div>
				</button>
			</li>
		{/each}
	</ul>
{/if}

<Drawer placement="bottom" bind:open class={drawerClass}>
	<div class="mx-auto w-full max-w-3xl min-w-0 space-y-5 px-4 pt-2 pb-8">
		<h3>{editing ? editing.name : 'New site'}</h3>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="min-w-0 md:col-span-2">
				<Label for="site-name">Name</Label>
				<Input id="site-name" autocomplete="off" maxlength={100} bind:value={f.name} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0 md:col-span-2">
				<Label for="site-street">Street</Label>
				<Input id="site-street" autocomplete="off" bind:value={f.street} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="site-unit">Unit number (optional)</Label>
				<Input id="site-unit" autocomplete="off" bind:value={f.unitNumber} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="site-city">City</Label>
				<Input id="site-city" autocomplete="off" bind:value={f.city} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="site-province">Province</Label>
				<Input id="site-province" autocomplete="off" bind:value={f.province} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="site-postal">Postal code</Label>
				<Input id="site-postal" autocomplete="off" bind:value={f.postalCode} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="site-country">Country</Label>
				<Input id="site-country" autocomplete="off" bind:value={f.country} onkeydown={ignoreEnter} />
			</div>
		</div>

		{#if error}
			<p class="error-text" role="alert">{error}</p>
		{/if}

		<div class="flex flex-wrap gap-2">
			<Button type="button" outline color="dark" disabled={busy || !f.name.trim()} onclick={save}>
				{busy ? 'Saving…' : editing ? 'Save' : 'Add site'}
			</Button>
			<Button type="button" outline color="dark" onclick={() => (open = false)}>Close</Button>
			{#if editing}
				<Button type="button" outline color="red" class="ml-auto" disabled={busy} onclick={() => (confirmDelete = true)}>Delete</Button>
			{/if}
		</div>
		{#if editing && inUse(editing)}
			<p class="hint">
				This site is used by {editing._count.events} events, {editing._count.appointments} appointments and
				{editing._count.inventoryItems} inventory items, so it can't be deleted.
			</p>
		{/if}
	</div>
</Drawer>

<Modal title="Delete site" bind:open={confirmDelete} size="xs" autoclose={false}>
	<p>Delete <strong>{editing?.name}</strong>? This can't be undone.</p>
	<div class="mt-4 flex gap-2">
		<Button color="red" disabled={busy} onclick={remove}>Delete site</Button>
		<Button outline color="dark" onclick={() => (confirmDelete = false)}>Cancel</Button>
	</div>
</Modal>
