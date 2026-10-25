<script lang="ts">
	import { Button, Helper, Modal } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { toast } from 'svelte-sonner';
	import { deserialize } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';

	type DocumentRow = { id: string; name: string; size: number; contentType: string; createdAt: Date };

	let {
		volunteerId,
		documents,
		accept,
		maxMb
	}: {
		/** null for a volunteer who hasn't been saved yet */
		volunteerId: string | null;
		documents: DocumentRow[];
		/** e.g. ".pdf,.png" for the file picker */
		accept: string;
		maxMb: number;
	} = $props();

	let fileInput: HTMLInputElement | undefined = $state();
	let picked = $state<File | null>(null);
	let busy = $state(false);
	let error = $state('');
	let toDelete = $state<DocumentRow | null>(null);
	let deleteOpen = $state(false);

	const fmtDate = (d: Date) =>
		new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

	function fmtSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	// The volunteer page is one big <form>, so this section sits outside it and talks to
	// the page's actions with fetch.
	async function callAction(name: string, body: FormData): Promise<{ ok: true } | { ok: false; message: string }> {
		try {
			const response = await fetch(`?/${name}`, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await response.text());
			if (result.type === 'success') return { ok: true };
			if (result.type === 'redirect') {
				await goto(result.location);
				return { ok: false, message: 'Please sign in again.' };
			}
			const message =
				result.type === 'failure'
					? ((result.data as { message?: string } | undefined)?.message ?? 'The request failed.')
					: (result.error?.message ?? 'The request failed.');
			return { ok: false, message };
		} catch {
			return { ok: false, message: 'The request failed. Check your connection and try again.' };
		}
	}

	function onPick(event: Event) {
		error = '';
		const file = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
		if (file && file.size > maxMb * 1024 * 1024) {
			error = `That file is larger than ${maxMb} MB.`;
			picked = null;
			if (fileInput) fileInput.value = '';
			return;
		}
		picked = file;
	}

	async function upload() {
		if (!picked) return;
		busy = true;
		error = '';

		const body = new FormData();
		body.append('file', picked);
		const result = await callAction('uploadDocument', body);
		busy = false;

		if (!result.ok) {
			error = result.message;
			return;
		}
		picked = null;
		if (fileInput) fileInput.value = '';
		toast('Document uploaded');
		await invalidateAll();
	}

	async function remove() {
		if (!toDelete) return;
		busy = true;
		const body = new FormData();
		body.append('documentId', toDelete.id);
		const result = await callAction('deleteDocument', body);
		busy = false;

		deleteOpen = false;
		if (!result.ok) {
			toast(result.message);
			return;
		}
		toDelete = null;
		toast('Document deleted');
		await invalidateAll();
	}
</script>

<section class="rounded-lg bg-white p-4 shadow-md sm:p-5 dark:bg-gray-800">
	<h2 class="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Documents</h2>
	<p class="mb-4 text-sm text-gray-600 dark:text-gray-300">
		For example a police check or a signed agreement. Allowed: {accept.replaceAll('.', '').replaceAll(',', ', ')}, up to {maxMb} MB each.
	</p>

	{#if volunteerId === null}
		<p class="text-sm text-gray-600 dark:text-gray-300">Save the volunteer first, then add documents.</p>
	{:else}
		{#if documents.length === 0}
			<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">No documents yet.</p>
		{:else}
			<ul class="mb-4 divide-y divide-gray-200 dark:divide-gray-700">
				{#each documents as doc (doc.id)}
					<li class="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
						<div class="min-w-0 flex-1">
							<div class="truncate font-medium text-gray-900 dark:text-gray-100">{doc.name}</div>
							<div class="text-sm text-gray-600 dark:text-gray-300">
								{fmtSize(doc.size)} · added {fmtDate(doc.createdAt)}
							</div>
						</div>
						<div class="flex items-center gap-3 text-sm">
							<a
								class="text-primary-700 dark:text-primary-400 font-medium underline"
								href={`/volunteers/${volunteerId}/documents/${doc.id}`}
								target="_blank"
								rel="noopener">View</a
							>
							<a
								class="text-primary-700 dark:text-primary-400 font-medium underline"
								href={`/volunteers/${volunteerId}/documents/${doc.id}?download=1`}>Download</a
							>
							<Button
								type="button"
								outline
								color="red"
								size="xs"
								aria-label={`Delete ${doc.name}`}
								onclick={() => {
									toDelete = doc;
									deleteOpen = true;
								}}
							>
								<TrashBinOutline class="h-4 w-4" />
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
			<input
				bind:this={fileInput}
				type="file"
				{accept}
				onchange={onPick}
				disabled={busy}
				aria-label="Choose a document to upload"
				class="block w-full min-w-0 cursor-pointer rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 file:mr-3 file:cursor-pointer file:border-0 file:bg-gray-200 file:px-3 file:py-2 file:text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:file:bg-gray-600 dark:file:text-white"
			/>
			<Button type="button" color="dark" class="shrink-0" disabled={!picked || busy} onclick={upload}>
				{busy ? 'Uploading…' : 'Upload'}
			</Button>
		</div>
		{#if error}
			<Helper color="red" class="mt-2" role="alert">{error}</Helper>
		{/if}
	{/if}
</section>

<Modal title="Delete document" bind:open={deleteOpen} size="xs">
	<p class="break-words text-gray-600 dark:text-gray-300">
		Delete "{toDelete?.name}"? The file is removed and can't be recovered.
	</p>
	{#snippet footer()}
		<Button type="button" color="red" disabled={busy} onclick={remove}>Yes, delete</Button>
		<Button type="button" outline color="dark" onclick={() => (deleteOpen = false)}>Cancel</Button>
	{/snippet}
</Modal>
