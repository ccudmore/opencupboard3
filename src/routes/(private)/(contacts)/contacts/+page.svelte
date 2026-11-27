<script lang="ts">
	import { DEFAULT_CITY, DEFAULT_COUNTRY, DEFAULT_STATE, STATE_DISPLAY_NAME } from '$app/env/public';
	import { refreshAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Badge, Button, Drawer, Input, Label, Modal, Select, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Textarea } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { callAction } from '#lib/client/callAction.ts';
	import { contactCategories } from '#lib/contactCategories.ts';

	let { data } = $props();

	const drawerClass = 'max-h-[90vh] overflow-y-auto bg-white p-1 text-gray-900 backdrop:bg-black/50 dark:bg-gray-800 dark:text-white';
	type Contact = (typeof data.contacts)[number];

	const blank = () => ({
		name: '',
		organization: '',
		jobTitle: '',
		category: contactCategories[0] ?? '',
		status: 'ACTIVE',
		phone: '',
		altPhone: '',
		email: '',
		website: '',
		street: '',
		city: DEFAULT_CITY,
		state: DEFAULT_STATE,
		postalCode: '',
		country: DEFAULT_COUNTRY,
		notes: ''
	});

	let open = $state(false);
	let editing = $state<Contact | null>(null); // null means adding a new contact
	let f = $state(blank());
	let error = $state('');
	let busy = $state(false);
	let confirmDelete = $state(false);

	// search and filters
	let search = $state('');
	let categoryFilter = $state('');
	let statusFilter = $state('ACTIVE');

	// the configured categories, plus any category already used by a contact (the setting may have changed since)
	const categoryList = $derived([...new Set([...contactCategories, ...data.contacts.map((c) => c.category)])].sort((a, b) => a.localeCompare(b)));
	const categoryItems = $derived([{ value: '', name: 'All categories' }, ...categoryList.map((c) => ({ value: c, name: c }))]);
	const formCategoryItems = $derived([...new Set([...categoryList, f.category].filter(Boolean))].map((c) => ({ value: c, name: c })));
	const statusItems = [
		{ value: '', name: 'All statuses' },
		{ value: 'ACTIVE', name: 'Active' },
		{ value: 'INACTIVE', name: 'Inactive' }
	];
	const formStatusItems = statusItems.slice(1);

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const digits = q.replace(/\D/g, '');
		return data.contacts.filter((c) => {
			if (categoryFilter && c.category !== categoryFilter) return false;
			if (statusFilter && c.status !== statusFilter) return false;
			if (!q) return true;
			const haystack = [c.name, c.organization, c.jobTitle, c.email, c.website, c.category, c.notes, c.city].filter(Boolean).join(' ').toLowerCase();
			if (haystack.includes(q)) return true;
			// phone numbers match on digits only, so "613 555" finds "(613) 555-0100"
			return digits.length >= 3 && [c.phone, c.altPhone].some((p) => p && p.replace(/\D/g, '').includes(digits));
		});
	});

	function openNew() {
		editing = null;
		f = blank();
		error = '';
		open = true;
	}

	function openEdit(c: Contact) {
		editing = c;
		f = {
			name: c.name,
			organization: c.organization ?? '',
			jobTitle: c.jobTitle ?? '',
			category: c.category,
			status: c.status,
			phone: c.phone ?? '',
			altPhone: c.altPhone ?? '',
			email: c.email ?? '',
			website: c.website ?? '',
			street: c.street ?? '',
			city: c.city ?? '',
			state: c.state ?? '',
			postalCode: c.postalCode ?? '',
			country: c.country ?? '',
			notes: c.notes ?? ''
		};
		error = '';
		open = true;
	}

	async function save() {
		busy = true;
		error = '';
		const result = await callAction(editing ? 'updateContact' : 'createContact', editing ? { contactId: editing.id, ...f } : { ...f });
		busy = false;
		if (!result.ok) {
			error = result.message;
			return;
		}
		toast(editing ? 'Contact saved' : 'Contact added');
		open = false;
		await refreshAll();
	}

	async function remove() {
		if (!editing) return;
		busy = true;
		const result = await callAction('deleteContact', { contactId: editing.id });
		busy = false;
		confirmDelete = false;
		if (!result.ok) {
			error = result.message;
			return;
		}
		toast('Contact deleted');
		open = false;
		await refreshAll();
	}

	const ignoreEnter = (e: KeyboardEvent) => e.key === 'Enter' && e.preventDefault();
	const siteLabel = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
</script>

<div class="flex flex-wrap items-center gap-2 p-4">
	<h2 class="section-title">Contacts</h2>
	<div class="ml-auto">
		<Button outline color="dark" onclick={openNew}><PlusOutline class="mr-2 h-3.5 w-3.5" />New Contact</Button>
	</div>
</div>

<div class="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-3">
	<div class="min-w-0">
		<Label for="contact-search" class="sr-only">Search contacts</Label>
		<Input id="contact-search" type="search" autocomplete="off" placeholder="Search name, organization, phone, email…" bind:value={search} onkeydown={ignoreEnter} />
	</div>
	<div class="min-w-0">
		<Label for="contact-category" class="sr-only">Category</Label>
		<Select id="contact-category" items={categoryItems} bind:value={categoryFilter} />
	</div>
	<div class="min-w-0">
		<Label for="contact-status" class="sr-only">Status</Label>
		<Select id="contact-status" items={statusItems} bind:value={statusFilter} />
	</div>
</div>

{#if data.contacts.length === 0}
	<p class="px-4 pb-4 text-gray-500 dark:text-gray-400">No contacts yet.</p>
{:else if filtered.length === 0}
	<p class="px-4 pb-4 text-gray-500 dark:text-gray-400">No contacts match.</p>
{:else}
	<p class="hint px-4 pb-2">{filtered.length} of {data.contacts.length} contacts</p>

	<div class="hidden md:block">
		<Table hoverable={true}>
			<TableHead>
				<TableHeadCell scope="col">Name</TableHeadCell>
				<TableHeadCell scope="col">Category</TableHeadCell>
				<TableHeadCell scope="col">Phone</TableHeadCell>
				<TableHeadCell scope="col">Email</TableHeadCell>
				<TableHeadCell scope="col">Web site</TableHeadCell>
				<TableHeadCell scope="col">Status</TableHeadCell>
			</TableHead>
			<TableBody class="divide-y">
				{#each filtered as c (c.id)}
					<TableBodyRow class="cursor-pointer" onclick={() => openEdit(c)}>
						<TableBodyCell class="font-medium text-gray-900 dark:text-white">
							{c.name}
							{#if c.organization || c.jobTitle}
								<div class="hint font-normal">{[c.jobTitle, c.organization].filter(Boolean).join(', ')}</div>
							{/if}
						</TableBodyCell>
						<TableBodyCell>{c.category}</TableBodyCell>
						<TableBodyCell class="whitespace-normal">
							{#if c.phone}<a class="text-blue-700 hover:underline dark:text-blue-400" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} onclick={(e) => e.stopPropagation()}>{c.phone}</a>{:else}—{/if}
						</TableBodyCell>
						<TableBodyCell class="break-all whitespace-normal">
							{#if c.email}<a class="text-blue-700 hover:underline dark:text-blue-400" href={`mailto:${c.email}`} onclick={(e) => e.stopPropagation()}>{c.email}</a>{:else}—{/if}
						</TableBodyCell>
						<TableBodyCell class="break-all whitespace-normal">
							{#if c.website}<a class="text-blue-700 hover:underline dark:text-blue-400" href={c.website} target="_blank" rel="noopener noreferrer" onclick={(e) => e.stopPropagation()}>{siteLabel(c.website)}</a>{:else}—{/if}
						</TableBodyCell>
						<TableBodyCell><Badge color={c.status === 'ACTIVE' ? 'green' : 'gray'}>{c.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge></TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	</div>

	<ul class="divide-y divide-gray-200 md:hidden dark:divide-gray-700">
		{#each filtered as c (c.id)}
			<li>
				<button type="button" class="block w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700" onclick={() => openEdit(c)}>
					<div class="flex items-center gap-2">
						<span class="truncate font-semibold text-gray-900 dark:text-white">{c.name}</span>
						{#if c.status !== 'ACTIVE'}<Badge color="gray">Inactive</Badge>{/if}
					</div>
					<div class="hint">{[c.category, c.organization].filter(Boolean).join(' · ')}</div>
					<div class="hint">{[c.phone, c.email].filter(Boolean).join(' · ') || 'No phone or email'}</div>
				</button>
			</li>
		{/each}
	</ul>
{/if}

<Drawer placement="bottom" bind:open class={drawerClass}>
	<div class="mx-auto w-full max-w-3xl min-w-0 space-y-5 px-4 pt-2 pb-8">
		<h3>{editing ? editing.name : 'New contact'}</h3>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="min-w-0">
				<Label for="c-name">Name</Label>
				<Input id="c-name" autocomplete="off" maxlength={150} bind:value={f.name} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="c-org">Organization</Label>
				<Input id="c-org" autocomplete="off" maxlength={150} bind:value={f.organization} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="c-title">Job title</Label>
				<Input id="c-title" autocomplete="off" maxlength={100} bind:value={f.jobTitle} onkeydown={ignoreEnter} />
			</div>
			<div class="grid min-w-0 grid-cols-2 gap-4">
				<div class="min-w-0">
					<Label for="c-category">Category</Label>
					<Select id="c-category" items={formCategoryItems} bind:value={f.category} />
				</div>
				<div class="min-w-0">
					<Label for="c-status">Status</Label>
					<Select id="c-status" items={formStatusItems} bind:value={f.status} />
				</div>
			</div>
			<div class="min-w-0">
				<Label for="c-phone">Phone</Label>
				<Input id="c-phone" type="tel" autocomplete="off" maxlength={40} bind:value={f.phone} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="c-alt">Other phone</Label>
				<Input id="c-alt" type="tel" autocomplete="off" maxlength={40} bind:value={f.altPhone} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="c-email">Email</Label>
				<Input id="c-email" type="email" autocomplete="off" maxlength={200} bind:value={f.email} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="c-web">Web site</Label>
				<Input id="c-web" autocomplete="off" maxlength={300} placeholder="example.org" bind:value={f.website} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0 md:col-span-2">
				<Label for="c-street">Street</Label>
				<Input id="c-street" autocomplete="off" maxlength={200} bind:value={f.street} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="c-city">City</Label>
				<Input id="c-city" autocomplete="off" maxlength={100} bind:value={f.city} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="c-state">{STATE_DISPLAY_NAME}</Label>
				<Input id="c-state" autocomplete="off" maxlength={100} bind:value={f.state} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="c-postal">Postal code</Label>
				<Input id="c-postal" autocomplete="off" maxlength={20} bind:value={f.postalCode} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="c-country">Country</Label>
				<Input id="c-country" autocomplete="off" maxlength={100} bind:value={f.country} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0 md:col-span-2">
				<Label for="c-notes">Notes</Label>
				<Textarea id="c-notes" rows={4} maxlength={2000} bind:value={f.notes} />
			</div>
		</div>

		{#if error}
			<p class="error-text" role="alert">{error}</p>
		{/if}

		<div class="flex flex-wrap gap-2">
			<Button type="button" outline color="dark" disabled={busy || !f.name.trim() || !f.category} onclick={save}>
				{busy ? 'Saving…' : editing ? 'Save' : 'Add contact'}
			</Button>
			<Button type="button" outline color="dark" onclick={() => (open = false)}>Close</Button>
			{#if editing}
				<Button type="button" outline color="red" class="ml-auto" disabled={busy} onclick={() => (confirmDelete = true)}>Delete</Button>
			{/if}
		</div>
	</div>
</Drawer>

<Modal title="Delete contact" bind:open={confirmDelete} size="xs" autoclose={false}>
	<p>Delete <strong>{editing?.name}</strong>? This can't be undone. To keep the record but hide it, set its status to Inactive instead.</p>
	<div class="mt-4 flex gap-2">
		<Button color="red" disabled={busy} onclick={remove}>Delete contact</Button>
		<Button outline color="dark" onclick={() => (confirmDelete = false)}>Cancel</Button>
	</div>
</Modal>
