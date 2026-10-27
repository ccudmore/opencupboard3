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
		TableHeadCell
	} from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import SearchPagination from '$lib/components/SearchPagination.svelte';
	import { callAction } from '$lib/client/callAction';

	let { data } = $props();

	const STATUS_ITEMS = [
		{ value: 'ACTIVE', name: 'Active' },
		{ value: 'INACTIVE', name: 'Inactive' }
	];
	const MIN_PASSWORD = 8;

	const checkClass = 'h-5 w-5 shrink-0 cursor-pointer rounded accent-primary-600 dark:accent-primary-400';
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
	const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

	/** A form with the same field repeated, which is how the chosen role ids are sent. */
	function formWith(fields: Record<string, string>, roleIds?: string[]) {
		const body = new FormData();
		for (const [key, value] of Object.entries(fields)) body.append(key, value);
		for (const id of roleIds ?? []) body.append('roleIds', id);
		return body;
	}

	function toggle(list: string[], id: string, on: boolean): string[] {
		return on ? [...list.filter((x) => x !== id), id] : list.filter((x) => x !== id);
	}

	// ------------------------------------------------------------------ add a user

	let newOpen = $state(false);
	let newName = $state('');
	let newEmail = $state('');
	let newPassword = $state('');
	let newRoleIds = $state<string[]>([]);
	let newError = $state('');
	let newBusy = $state(false);

	function openNew() {
		newName = '';
		newEmail = '';
		newPassword = '';
		newRoleIds = [];
		newError = '';
		newOpen = true;
	}

	async function addUser() {
		newBusy = true;
		newError = '';
		const result = await callAction(
			'createUser',
			formWith({ name: newName, email: newEmail, password: newPassword }, newRoleIds)
		);
		newBusy = false;

		if (!result.ok) {
			newError = result.message;
			return;
		}
		newOpen = false;
		toast('User added');
		await invalidateAll();
	}

	// ------------------------------------------------------------------ edit a user

	let editingId = $state<string | null>(null);
	let editOpen = $state(false);
	const editing = $derived(data.users.find((u) => u.id === editingId) ?? null);
	const isSelf = $derived(editing?.id === data.currentUserId);

	let editStatus = $state('ACTIVE');
	let editRoleIds = $state<string[]>([]);
	let password = $state('');
	let confirm = $state('');
	let busy = $state<'status' | 'roles' | 'password' | null>(null);
	let editError = $state('');

	function openEdit(user: (typeof data.users)[number]) {
		editingId = user.id;
		editStatus = user.status;
		editRoleIds = user.roles.map((r) => r.role.id);
		password = '';
		confirm = '';
		editError = '';
		editOpen = true;
	}

	const statusChanged = $derived(!!editing && editStatus !== editing.status);
	const rolesChanged = $derived.by(() => {
		if (!editing) return false;
		const saved = editing.roles.map((r) => r.role.id).sort().join(',');
		return saved !== [...editRoleIds].sort().join(',');
	});
	const passwordProblem = $derived(
		password === '' ? '' : password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters.` : confirm !== '' && password !== confirm ? 'The passwords do not match.' : ''
	);

	async function run(which: 'status' | 'roles' | 'password', action: string, body: FormData, done: string) {
		busy = which;
		editError = '';
		const result = await callAction(action, body);
		busy = null;

		if (!result.ok) {
			editError = result.message;
			return false;
		}
		toast(done);
		await invalidateAll();
		return true;
	}

	const saveStatus = () => editing && run('status', 'setUserStatus', formWith({ userId: editing.id, status: editStatus }), 'Status changed');
	const saveRoles = () => editing && run('roles', 'setUserRoles', formWith({ userId: editing.id }, editRoleIds), 'Roles saved');

	async function savePassword() {
		if (!editing) return;
		const ok = await run('password', 'setUserPassword', formWith({ userId: editing.id, password, confirm }), 'Password changed');
		if (ok) {
			password = '';
			confirm = '';
		}
	}

	/** Pressing Enter in a field must not do anything unexpected. */
	const ignoreEnter = (e: KeyboardEvent) => e.key === 'Enter' && e.preventDefault();
</script>

{#snippet roleBadges(user: (typeof data.users)[number])}
	<div class="flex flex-wrap gap-1">
		{#each user.roles as r (r.role.id)}
			<Badge color={r.role.status === 'ACTIVE' ? 'blue' : 'gray'}>{r.role.name}{r.role.status === 'ACTIVE' ? '' : ' (inactive)'}</Badge>
		{:else}
			<span class="text-sm text-gray-500 dark:text-gray-400">No roles</span>
		{/each}
	</div>
{/snippet}

<div class="flex flex-col gap-3 p-4 md:flex-row md:items-center">
	<div class="w-full md:w-72">
		<Search bind:value={searchTerm} placeholder="Search name, email or role" size="md" />
	</div>
	<div class="md:ml-auto">
		<Button outline color="dark" class="shrink-0" onclick={openNew}>
			<PlusOutline class="mr-2 h-3.5 w-3.5" />New User
		</Button>
	</div>
</div>

{#if data.users.length === 0}
	<p class="px-4 pb-4 text-gray-500 dark:text-gray-400">No users found.</p>
{:else}
	<!-- Tablet and desktop: table -->
	<div class="hidden md:block">
		<Table hoverable={true}>
			<TableHead>
				<TableHeadCell class="px-4 py-3" scope="col">Name</TableHeadCell>
				<TableHeadCell class="px-4 py-3" scope="col">Email</TableHeadCell>
				<TableHeadCell class="px-4 py-3" scope="col">Roles</TableHeadCell>
				<TableHeadCell class="px-4 py-3" scope="col">Status</TableHeadCell>
			</TableHead>
			<TableBody class="divide-y">
				{#each data.users as user (user.id)}
					<TableBodyRow class="cursor-pointer" onclick={() => openEdit(user)}>
						<TableBodyCell class="px-4 py-3">{user.name}</TableBodyCell>
						<TableBodyCell class="px-4 py-3">{user.email}</TableBodyCell>
						<TableBodyCell class="px-4 py-3">{@render roleBadges(user)}</TableBodyCell>
						<TableBodyCell class="px-4 py-3">
							<Badge color={user.status === 'ACTIVE' ? 'green' : 'gray'}>{statusName(user.status)}</Badge>
						</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	</div>

	<!-- Phones: one tappable card per user -->
	<ul class="divide-y divide-gray-200 md:hidden dark:divide-gray-700">
		{#each data.users as user (user.id)}
			<li>
				<button type="button" class="block w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700" onclick={() => openEdit(user)}>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="truncate font-semibold text-gray-900 dark:text-white">{user.name}</div>
							<div class="truncate text-sm text-gray-600 dark:text-gray-300">{user.email}</div>
						</div>
						<Badge color={user.status === 'ACTIVE' ? 'green' : 'gray'}>{statusName(user.status)}</Badge>
					</div>
					<div class="mt-2">{@render roleBadges(user)}</div>
				</button>
			</li>
		{/each}
	</ul>
{/if}

<div class="p-4">
	<SearchPagination page={data.page} pageSize={data.pageSize} total={data.total} onpage={go} />
</div>

<!-- ============================ New user ============================ -->
<Drawer placement="bottom" bind:open={newOpen} class={drawerClass}>
	<div class="mx-auto w-full max-w-3xl min-w-0 space-y-5 px-4 pt-2 pb-8">
		<h3 class="text-lg font-semibold">New user</h3>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="min-w-0">
				<Label for="new-name" class="mb-2">Name</Label>
				<Input id="new-name" autocomplete="off" maxlength={100} bind:value={newName} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0">
				<Label for="new-email" class="mb-2">Email</Label>
				<Input id="new-email" type="email" autocomplete="off" bind:value={newEmail} onkeydown={ignoreEnter} />
			</div>
			<div class="min-w-0 md:col-span-2">
				<Label for="new-password" class="mb-2">Password (optional)</Label>
				<Input id="new-password" type="password" autocomplete="new-password" bind:value={newPassword} onkeydown={ignoreEnter} />
				<Helper class="mt-1">
					At least {MIN_PASSWORD} characters. Leave it empty if they will sign in with Google or Microsoft.
				</Helper>
			</div>
		</div>

		<fieldset>
			<legend class="mb-2 text-sm font-medium">Roles</legend>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{#each data.roles as role (role.id)}
					<label class="flex cursor-pointer items-center gap-2 text-gray-900 dark:text-gray-100">
						<input type="checkbox" class={checkClass} checked={newRoleIds.includes(role.id)} onchange={(e) => (newRoleIds = toggle(newRoleIds, role.id, e.currentTarget.checked))} />
						{role.name}{role.status === 'ACTIVE' ? '' : ' (inactive)'}
					</label>
				{/each}
			</div>
		</fieldset>

		{#if newError}
			<p class="text-sm text-red-600 dark:text-red-400" role="alert">{newError}</p>
		{/if}

		<div class="flex gap-2">
			<Button type="button" outline color="dark" disabled={newBusy || !newName.trim() || !newEmail.trim()} onclick={addUser}>
				{newBusy ? 'Adding…' : 'Add user'}
			</Button>
			<Button type="button" outline color="dark" onclick={() => (newOpen = false)}>Cancel</Button>
		</div>
	</div>
</Drawer>

<!-- ============================ Edit a user ============================ -->
<Drawer placement="bottom" bind:open={editOpen} class={drawerClass}>
	{#if editing}
		<div class="mx-auto w-full max-w-3xl min-w-0 space-y-6 px-4 pt-2 pb-8">
			<div>
				<h3 class="text-lg font-semibold">{editing.name}{isSelf ? ' (you)' : ''}</h3>
				<p class="text-sm wrap-break-word text-gray-600 dark:text-gray-300">{editing.email} · added {fmtDate(editing.createdAt)}</p>
			</div>

			{#if editError}
				<p class="text-sm text-red-600 dark:text-red-400" role="alert">{editError}</p>
			{/if}

			<!-- Status -->
			<section class="space-y-2">
				<h4 class="text-sm font-medium">Status</h4>
				<div class="flex flex-wrap items-end gap-2">
					<div class="w-48">
						<Select aria-label="Status" items={STATUS_ITEMS} bind:value={editStatus} />
					</div>
					<Button type="button" outline color="dark" disabled={!statusChanged || busy !== null} onclick={saveStatus}>
						{busy === 'status' ? 'Saving…' : 'Change status'}
					</Button>
				</div>
				<Helper>An inactive user is signed out and can't sign in again until they are made active.</Helper>
			</section>

			<!-- Roles -->
			<section class="space-y-2">
				<h4 class="text-sm font-medium">Roles</h4>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each data.roles as role (role.id)}
						<label class="flex cursor-pointer items-center gap-2 text-gray-900 dark:text-gray-100">
							<input type="checkbox" class={checkClass} checked={editRoleIds.includes(role.id)} onchange={(e) => (editRoleIds = toggle(editRoleIds, role.id, e.currentTarget.checked))} />
							{role.name}{role.status === 'ACTIVE' ? '' : ' (inactive)'}
						</label>
					{/each}
				</div>
				<Button type="button" outline color="dark" disabled={!rolesChanged || busy !== null} onclick={saveRoles}>
					{busy === 'roles' ? 'Saving…' : 'Save roles'}
				</Button>
			</section>

			<!-- Password -->
			<section class="space-y-2">
				<h4 class="text-sm font-medium">Change password</h4>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div class="min-w-0">
						<Label for="pw" class="mb-1">New password</Label>
						<Input id="pw" type="password" autocomplete="new-password" bind:value={password} onkeydown={ignoreEnter} />
					</div>
					<div class="min-w-0">
						<Label for="pw2" class="mb-1">Confirm password</Label>
						<Input id="pw2" type="password" autocomplete="new-password" bind:value={confirm} onkeydown={ignoreEnter} />
					</div>
				</div>
				{#if passwordProblem}
					<Helper color="red">{passwordProblem}</Helper>
				{:else}
					<Helper>At least {MIN_PASSWORD} characters. {isSelf ? 'Your other sessions are signed out.' : 'Their sessions are signed out so the new password is needed.'}</Helper>
				{/if}
				<Button type="button" outline color="dark" disabled={busy !== null || password.length < MIN_PASSWORD || password !== confirm} onclick={savePassword}>
					{busy === 'password' ? 'Saving…' : 'Set password'}
				</Button>
			</section>

			<Button type="button" outline color="dark" onclick={() => (editOpen = false)}>Close</Button>
		</div>
	{/if}
</Drawer>
