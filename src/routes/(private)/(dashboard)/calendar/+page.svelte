<script lang="ts">
	import { Select } from 'flowbite-svelte';
	import Calendar, {
		type CalendarChanges,
		type CalendarEvent
	} from '$lib/components/Calendar.svelte';
	
	import { invalidateAll } from '$app/navigation';
	import { deserialize } from '$app/forms';

	import type { PageProps } from './$types';
	import CalendarSubscribe from '$lib/components/CalendarSubscribe.svelte';

	// categories, volunteers and events come from +page.server.ts
	let { data }: PageProps = $props();

	// Local, editable copy of the events; re-synced whenever the load function re-runs.
	let events = $state<CalendarEvent[]>([]);
	$effect.pre(() => {
		events = data.events;
	});
		let error = $state('');


/** Sends one change set to the named action in +page.server.ts. */
	async function send(action: 'add' | 'update' | 'delete', changes: CalendarChanges) {
		error = '';
		try {
			const body = new FormData();
			body.set('changes', JSON.stringify(changes));
			const res = await fetch(`?/${action}`, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await res.text());
			if (result.type === 'failure') {
				error = (result.data as { message?: string } | undefined)?.message ?? 'Could not save that change.';
			} else if (result.type === 'error') {
				error = result.error?.message ?? 'Could not save that change.';
			}
		} catch {
			error = 'Could not reach the server. Your change was not saved.';
		}
		// Reload from the server so the calendar always shows what was actually saved
		// (this also rolls back the on-screen change if saving failed).
		await invalidateAll();
	}

</script>

<!-- mode is either readonly, full, or volunteers-->
<main class="mx-auto max-w-5xl p-4">
	<h1 class="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">Calendar</h1>
	<Calendar
		bind:events
		categories={data.categories}
		volunteers={data.volunteers}
		mode={data.mode}
		onadd={(_, changes) => send('add', changes)}
		onedit={(_, __, changes) => send('update', changes)}
		ondelete={(_, __, changes) => send('delete', changes)}
	/>
	<!--p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{events.length} events</p-->
	<CalendarSubscribe/>
</main>
