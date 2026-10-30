<script lang="ts">
	import { onMount } from 'svelte';
	import { Badge, Button, Dropdown, Modal, ToolbarButton } from 'flowbite-svelte';
	import { BellOutline } from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';

	// The bell in the header: a count of unread notifications, and a scrollable list of them.
	// Other code adds notifications on the server (see $lib/server/notifications.ts).

	type Item = { id: string; subject: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };

	const POLL_MS = 60_000;

	let items = $state<Item[]>([]);
	let unread = $state(0);
	let isOpen = $state(false);
	let loading = $state(false);
	let loaded = $state(false);
	let error = $state('');

	let selected = $state<Item | null>(null);
	let detailsOpen = $state(false);
	let confirmingDeleteAll = $state(false);

	async function deleteAll() {
		await act('deleteAll');
		confirmingDeleteAll = false;
		detailsOpen = false;
	}

	const dateFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
	const timeFmt = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' });
	const day = (iso: string) => dateFmt.format(new Date(iso));
	const clock = (iso: string) => timeFmt.format(new Date(iso));
	const badge = $derived(unread > 99 ? '99+' : String(unread));

	async function request(init?: RequestInit, query = ''): Promise<any | null> {
		try {
			const response = await fetch(`/notifications${query}`, {
				...init,
				headers: init?.body ? { 'content-type': 'application/json' } : undefined
			});
			if (!response.ok) return null;
			return await response.json();
		} catch {
			return null;
		}
	}

	async function refreshCount() {
		const r = await request(undefined, '?count=1');
		if (r) unread = r.unread;
	}

	async function refreshList() {
		loading = true;
		error = '';
		const r = await request();
		loading = false;
		if (!r) {
			error = 'Could not load notifications.';
			return;
		}
		items = r.items;
		unread = r.unread;
		loaded = true;
	}

	async function act(action: 'read' | 'unread' | 'delete' | 'readAll' | 'deleteRead' | 'deleteAll', id?: string) {
		const r = await request({ method: 'POST', body: JSON.stringify({ action, id }) });
		if (!r) {
			error = 'That did not work. Please try again.';
			return false;
		}
		error = '';
		unread = r.unread;
		const now = new Date().toISOString();
		if (action === 'read') items = items.map((i) => (i.id === id ? { ...i, readAt: i.readAt ?? now } : i));
		else if (action === 'unread') items = items.map((i) => (i.id === id ? { ...i, readAt: null } : i));
		else if (action === 'delete') items = items.filter((i) => i.id !== id);
		else if (action === 'readAll') items = items.map((i) => ({ ...i, readAt: i.readAt ?? now }));
		else if (action === 'deleteRead') items = items.filter((i) => !i.readAt);
		else if (action === 'deleteAll') items = [];
		return true;
	}

	function view(item: Item) {
		selected = item;
		detailsOpen = true;
		if (!item.readAt) void act('read', item.id); // opening it counts as reading it
	}

	async function go(item: Item) {
		if (!item.link) return;
		detailsOpen = false;
		isOpen = false;
		if (!item.readAt) await act('read', item.id);
		await goto(item.link);
	}

	async function remove(item: Item) {
		if (await act('delete', item.id) && selected?.id === item.id) detailsOpen = false;
	}

	// The selected row's current state (it changes while the details are open)
	const current = $derived(selected ? (items.find((i) => i.id === selected!.id) ?? selected) : null);

	$effect(() => {
		if (isOpen) void refreshList();
		else confirmingDeleteAll = false;
	});

	onMount(() => {
		void refreshCount();
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') void (isOpen ? refreshList() : refreshCount());
		}, POLL_MS);
		const onVisible = () => document.visibilityState === 'visible' && void refreshCount();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<ToolbarButton size="lg" class="relative -mx-0.5 hover:text-gray-900 dark:hover:text-white" aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}>
	<BellOutline size="lg" />
	{#if unread > 0}
		<span
			class="absolute -inset-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold leading-5 text-white"
			aria-hidden="true">{badge}</span>
	{/if}
</ToolbarButton>

<Dropdown bind:isOpen class="w-88 max-w-[calc(100vw-1rem)] p-0">
	<div class="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-600">
		<div class="font-semibold text-gray-900 dark:text-white">Notifications</div>
		<div class="flex items-center gap-2 text-xs">
			{#if confirmingDeleteAll}
				<span class="text-gray-800 dark:text-gray-100">Delete all?</span>
				<button type="button" class="font-semibold text-red-700 hover:underline dark:text-red-400" onclick={deleteAll}>Yes</button>
				<button type="button" class="text-blue-700 hover:underline dark:text-blue-400" onclick={() => (confirmingDeleteAll = false)}>No</button>
			{:else}
				<button type="button" class="text-blue-700 hover:underline disabled:text-gray-400 dark:text-blue-400" disabled={unread === 0} onclick={() => act('readAll')}>Mark all read</button>
				<button type="button" class="text-blue-700 hover:underline disabled:text-gray-400 dark:text-blue-400" disabled={items.length === 0} onclick={() => (confirmingDeleteAll = true)}>Delete all</button>
			{/if}
		</div>
	</div>

	<div class="max-h-96 overflow-y-auto">
		{#if error}
			<p class="px-3 py-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
		{/if}
		{#if loading && !loaded}
			<p class="px-3 py-4 text-sm text-gray-600 dark:text-gray-300">Loading…</p>
		{:else if loaded && items.length === 0}
			<p class="px-3 py-4 text-sm text-gray-600 dark:text-gray-300">You have no notifications.</p>
		{/if}

		<ul class="divide-y divide-gray-200 dark:divide-gray-600">
			{#each items as item (item.id)}
				<li class="px-3 py-2 {item.readAt ? '' : 'bg-blue-50 dark:bg-gray-700'}">
					<button type="button" class="block w-full min-w-0 text-left" onclick={() => view(item)}>
						<span class="block wrap-break-word text-sm {item.readAt ? 'text-gray-800 dark:text-gray-200' : 'font-semibold text-gray-900 dark:text-white'}">{item.subject}</span>
						<span class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
							<span>{day(item.createdAt)}, {clock(item.createdAt)}</span>
							<Badge color={item.readAt ? 'gray' : 'blue'}>{item.readAt ? 'Read' : 'Unread'}</Badge>
						</span>
					</button>
					<div class="mt-1 flex gap-3 text-xs">
						<button type="button" class="text-blue-700 hover:underline dark:text-blue-400" onclick={() => act(item.readAt ? 'unread' : 'read', item.id)}>
							{item.readAt ? 'Mark unread' : 'Mark read'}
						</button>
						<button type="button" class="text-red-700 hover:underline dark:text-red-400" onclick={() => remove(item)}>Delete</button>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</Dropdown>

<Modal title={current?.subject ?? ''} bind:open={detailsOpen} size="sm">
	{#if current}
		<p class="text-sm text-gray-600 dark:text-gray-300">
			{day(current.createdAt)}, {clock(current.createdAt)} ·
			<Badge color={current.readAt ? 'gray' : 'blue'}>{current.readAt ? 'Read' : 'Unread'}</Badge>
		</p>
		{#if current.body}
			<p class="mt-3 wrap-break-word whitespace-pre-line text-gray-800 dark:text-gray-100">{current.body}</p>
		{:else}
			<p class="mt-3 text-gray-600 dark:text-gray-300">There are no more details.</p>
		{/if}
	{/if}
	{#snippet footer()}
		{#if current}
			{#if current.link}<Button color="dark" onclick={() => go(current)}>Go to details</Button>{/if}
			<Button outline color="dark" onclick={() => act(current.readAt ? 'unread' : 'read', current.id)}>
				{current.readAt ? 'Mark unread' : 'Mark read'}
			</Button>
			<Button outline color="red" onclick={() => remove(current)}>Delete</Button>
		{/if}
	{/snippet}
</Modal>