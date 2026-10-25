<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		Badge,
		Button,
		Drawer,
		Helper,
		Input,
		Label,
		Search,
		Select,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Textarea
	} from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import SearchPagination from '$lib/components/SearchPagination.svelte';
	import { callAction } from '$lib/client/callAction';

	let { data } = $props();

	const STATUS_ITEMS = [
		{ value: 'ACTIVE', name: 'Active' },
		{ value: 'INACTIVE', name: 'Inactive' }
	];

	const checkClass = 'mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-primary-600 dark:accent-primary-400';
	const drawerClass =
		'max-h-[90vh] overflow-y-auto bg-white p-1 text-gray-900 backdrop:bg-black/50 dark:bg-gray-800 dark:text-white';

	// ------------------------------------------------------------------ search and paging

	let searchTerm = $state('');
	$effect(() => {
		searchTerm = data.q;
	});

	function pageUrl(q: string, page: number) {
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		if (page > 1) params.set('page', String(page));
		return `?${params.toString()}`;
	}

	function go(page: number) {
		goto(pageUrl(data.q, page), { keepFocus: true, noScroll: true });
	}

	// Search as the person types, after a short pause
	$effect(() => {
		const term = searchTerm.trim();
		if (term === data.q) return;
		const timer = setTimeout(() => {
			goto(pageUrl(term, 1), { keepFocus: true, noScroll: true, replaceState: true });
		}, 300);
		return () => clearTimeout(timer);
	});

	const statusName = (s: string) => STATUS_ITEMS.find((i) => i.value === s)?.name ?? s;
	const permissionName = (id: string) => data.permissions.find((p) => p.id === id)?.name ?? id;

	/** A form with the same field repeated, which is how the chosen permission ids are sent. */
	function formWith(fields: Record<string, string>, permissionIds: string[]) {
		const body = new FormData();
		for (const [key, value] of Object.entries(fields)) body.append(key, value);
		for (const id of permissionIds) body.append('permissionIds', id);
		return body;
	}

	function toggle(list: string[], id: string, on: boolean): string[] {
		return on ? [...list.filter((x) => x !== id), id] : list.filter((x) => x !== id);
	}

	// ------------------------------------------------------------------ add a role

	let newOpen = $state(false);
	let newName = $state('');
	let newDescription = $state('');
	let newPermissionIds = $state<string[]>([]);
	let newError = $state('');
	let newBusy = $state(false);

	function openNew() {
		newName = '';
		newDescription = '';
		newPermissionIds = [];
		newError = '';
		newOpen = true;
	}

	async function addRole() {
		newBusy = true;
		newError = '';
		const result = await callAction('createRole', formWith({ name: newName, description: newDescription }, newPermissionIds));
		newBusy = false;

		if (!result.ok) {
			newError = result.message;
			return;
		}
		newOpen = false;
		toast('Role added');
		await invalidateAll();
	}

	// ------------------------------------------------------------------ edit a role

	let editingId = $state<string | null>(null);
	let editOpen = $state(false);
	const editing = $derived(data.roles.find((r) => r.id === editingId) ?? null);

	let editStatus = $state('ACTIVE');
	let editDescription = $state('');
	let editPermissionIds = $state<string[]>([]);
	let editError = $state('');
	let busy = $state(false);

	function openEdit(role: (typeof data.roles)[number]) {
		editingId = role.id;
		editStatus = role.status;
		editDescription = role.description ?? '';
		editPermissionIds = role.permissions.map((p) => p.permissionId);
		editError = '';
		editOpen = true;
	}

	const changed = $derived.by(() => {
		if (!editing) return false;
		const saved = editing.permissions.map((p) => p.permissionId).sort().join(',');
		return (
			editStatus !== editing.status ||
			editDescription.trim() !== (editing.description ?? '') ||
			saved !== [...editPermissionIds].sort().join(',')
		);
	});

	async function saveRole() {
		if (!editing) return;
		busy = true;
		editError = '';
		const result = await callAction(
			'updateRole',
			formWith({ roleId: editing.id, status: editStatus, description: editDescription }, editPermissionIds)
		);
		busy = false;

		if (!result.ok) {
			editError = result.message;
			return;
		}
		toast('Role saved');
		await invalidateAll();
	}

	const ignoreEnter = (e: KeyboardEvent) => e.key === 'Enter' && e.preventDefault();
</script>

<div class="flex flex-col gap-3 p-4 md:flex-row md:items-center">
	<div class="w-full md:w-72">
		<Search bind:value={searchTerm} placeholder="Search name or description" size="md" />
	</div>
	<div class="md:ml-auto">
		<Button outline color="dark" class="shrink-0" onclick={openNew}>
			<PlusOutline class="mr-2 h-3.5 w-3.5" />New Role
		</Button>
	</div>
</div>

{#if data.roles.length === 0}
	<p class="px-4 pb-4 text-gray-500 dark:text-gray-400">No roles found.</p>
{:else}
	<!-- Tablet and desktop: table -->
	<div class="hidden md:block">
		<Table hoverable={true}>
			<TableHead>
				<TableHeadCell class="px-4 py-3" scope="col">Role</TableHeadCell>
				<TableHeadCell class="px-4 py-3" scope="col">Permissions</TableHeadCell>
				<TableHeadCell class="px-4 py-3" scope="col">Users</TableHeadCell>
				<TableHeadCell class="px-4 py-3" scope="col">Status</TableHeadCell>
			</TableHead>
			<TableBody class="divide-y">
				{#each data.roles as role (role.id)}
					<TableBodyRow class="cursor-pointer" onclick={() => openEdit(role)}>
						<TableBodyCell class="px-4 py-3">
							<div class="font-medium text-gray-900 dark:text-white">{role.name}</div>
							{#if role.description}<div class="text-xs">{role.description}</div>{/if}
						</TableBodyCell>
						<TableBodyCell class="px-4 py-3 whitespace-normal">
							<div class="flex flex-wrap gap-1">
								{#each role.permissions as p (p.permissionId)}
									<Badge color="blue">{permissionName(p.permissionId)}</Badge>
								{:else}
									<span class="text-sm text-gray-500 dark:text-gray-400">None</span>
								{/each}
							</div>
						</TableBodyCell>
						<TableBodyCell class="px-4 py-3">{role._count.users}</TableBodyCell>
						<TableBodyCell class="px-4 py-3">
							<Badge color={role.status === 'ACTIVE' ? 'green' : 'gray'}>{statusName(role.status)}</Badge>
						</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	</div>

	<!-- Phones: one tappable card per role -->
	<ul class="divide-y divide-gray-200 md:hidden dark:divide-gray-700">
		{#each data.roles as role (role.id)}
			<li>
				<button type="button" class="block w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700" onclick={() => openEdit(role)}>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="truncate font-semibold text-gray-900 dark:text-white">{role.name}</div>
							{#if role.description}<div class="text-sm text-gray-600 dark:text-gray-300">{role.description}</div>{/if}
						</div>
						<Badge color={role.status === 'ACTIVE' ? 'green' : 'gray'}>{statusName(role.status)}</Badge>
					</div>
					<div class="mt-1 text-sm text-gray-600 dark:text-gray-300">
						{role.permissions.length} {role.permissions.length === 1 ? 'permission' : 'permissions'} · {role._count.users}
						{role._count.users === 1 ? 'user' : 'users'}
					</div>
				</button>
			</li>
		{/each}
	</ul>
{/if}

<div class="p-4">
	<SearchPagination page={data.page} pageSize={data.pageSize} total={data.total} onpage={go} />
</div>

<!-- A checklist of every permission, shared by the add and edit drawers -->
{#snippet permissionChecklist(selected: string[], onchange: (id: string, on: boolean) => void)}
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each data.permissions as p (p.id)}
			<label class="flex cursor-pointer items-start gap-2 text-gray-900 dark:text-gray-100">
				<input type="checkbox" class={checkClass} checked={selected.includes(p.id)} onchange={(e) => onchange(p.id, e.currentTarget.checked)} />
				<span>
					<span class="block font-medium">{p.name}</span>
					{#if p.description}<span class="block text-sm text-gray-600 dark:text-gray-300">{p.description}</span>{/if}
				</span>
			</label>
		{/each}
	</div>
{/snippet}

<!-- ============================ New role ============================ -->
<Drawer placement="bottom" bind:open={newOpen} class={drawerClass}>
	<div class="mx-auto w-full max-w-3xl min-w-0 space-y-5 px-4 pt-2 pb-8">
		<h3 class="text-lg font-semibold">New role</h3>

		<div class="grid grid-cols-1 gap-4">
			<div class="min-w-0">
				<Label for="role-name" class="mb-2">Name</Label>
				<Input id="role-name" autocomplete="off" maxlength={60} bind:value={newName} onkeydown={ignoreEnter} />
				<Helper class="mt-1">The name can't be changed later.</Helper>
			</div>
			<div class="min-w-0">
				<Label for="role-description" class="mb-2">Description (optional)</Label>
				<Textarea id="role-description" rows={2} class="block w-full max-w-full min-w-0" maxlength={200} bind:value={newDescription} />
			</div>
		</div>

		<fieldset>
			<legend class="mb-2 text-sm font-medium">Permissions</legend>
			{@render permissionChecklist(newPermissionIds, (id, on) => (newPermissionIds = toggle(newPermissionIds, id, on)))}
		</fieldset>

		{#if newError}
			<p class="text-sm text-red-600 dark:text-red-400" role="alert">{newError}</p>
		{/if}

		<div class="flex gap-2">
			<Button type="button" outline color="dark" disabled={newBusy || !newName.trim()} onclick={addRole}>
				{newBusy ? 'Adding…' : 'Add role'}
			</Button>
			<Button type="button" outline color="dark" onclick={() => (newOpen = false)}>Cancel</Button>
		</div>
	</div>
</Drawer>

<!-- ============================ Edit a role ============================ -->
<Drawer placement="bottom" bind:open={editOpen} class={drawerClass}>
	{#if editing}
		<div class="mx-auto w-full max-w-3xl min-w-0 space-y-5 px-4 pt-2 pb-8">
			<div>
				<h3 class="text-lg font-semibold">{editing.name}</h3>
				<p class="text-sm text-gray-600 dark:text-gray-300">
					{editing._count.users} {editing._count.users === 1 ? 'user has' : 'users have'} this role.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr]">
				<div class="min-w-0">
					<Label for="edit-status" class="mb-2">Status</Label>
					<Select id="edit-status" items={STATUS_ITEMS} bind:value={editStatus} />
				</div>
				<div class="min-w-0">
					<Label for="edit-description" class="mb-2">Description</Label>
					<Textarea id="edit-description" rows={2} class="block w-full max-w-full min-w-0" maxlength={200} bind:value={editDescription} />
				</div>
			</div>
			<Helper>An inactive role gives its users none of its permissions.</Helper>

			<fieldset>
				<legend class="mb-2 text-sm font-medium">Permissions</legend>
				{@render permissionChecklist(editPermissionIds, (id, on) => (editPermissionIds = toggle(editPermissionIds, id, on)))}
			</fieldset>

			{#if editError}
				<p class="text-sm text-red-600 dark:text-red-400" role="alert">{editError}</p>
			{/if}

			<div class="flex gap-2">
				<Button type="button" outline color="dark" disabled={!changed || busy} onclick={saveRole}>
					{busy ? 'Saving…' : 'Save'}
				</Button>
				<Button type="button" outline color="dark" onclick={() => (editOpen = false)}>Close</Button>
			</div>
		</div>
	{/if}
</Drawer>
