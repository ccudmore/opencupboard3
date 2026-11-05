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
	import EmailPrompts from '$lib/components/EmailPrompts.svelte';

	// categories, volunteers and events come from +page.server.ts
	let { data }: PageProps = $props();

	// Local, editable copy of the events; re-synced whenever the load function re-runs.
	let events = $state<CalendarEvent[]>([]);
	$effect.pre(() => {
		events = data.events;
	});
		let error = $state('');
	// The appointment slots are listed for reference, but start switched off so they don't crowd the calendar
	let hidden = $state<string[]>(['Appointment']);


let prompts: ReturnType<typeof EmailPrompts> | undefined = $state();

	/** Offers to email the attendees of an event that was just added. */
	function offerConfirmation(ev: CalendarEvent) {
		const hasPeople = (ev.volunteers?.length ?? 0) > 0 || (ev.guests ?? []).some((g) => g.email);
		if (hasPeople) void prompts?.start(ev.id, 'confirmation', true);
	}

	/** Sends one change set to the named action in +page.server.ts. Returns whether it saved. */
	async function send(action: 'add' | 'update' | 'delete', changes: CalendarChanges): Promise<boolean> {
		error = '';
		let saved = false;
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
			} else {
				saved = true;
			}
		} catch {
			error = 'Could not reach the server. Your change was not saved.';
		}
		// Reload from the server so the calendar always shows what was actually saved
		// (this also rolls back the on-screen change if saving failed).
		await invalidateAll();
		return saved;
	}

</script>

<!-- mode is either readonly, full, or volunteers-->
<main class="mx-auto max-w-5xl p-4">
	<h1 class="mb-4">Calendar</h1>
	<Calendar
		bind:events
		categories={data.categories}
		volunteers={data.volunteers}
		sites={data.sites}
		bind:hiddenCategories={hidden}
		mode={data.mode}
		emailEnabled={data.emailEnabled}
		onemail={(ev, kind, occurrence) => prompts?.start(ev.id, kind, false, { occurrence })}
		onadd={async (ev, changes) => {
			if (await send('add', changes)) offerConfirmation(ev);
		}}
		onedit={(_, __, changes) => send('update', changes)}
		ondelete={(_, __, changes) => send('delete', changes)}
	/>
	{#if error}<p class="error-text mb-2" role="alert">{error}</p>{/if}
	<!--p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{events.length} events</p-->
	<CalendarSubscribe/>
	<EmailPrompts bind:this={prompts} emailEnabled={data.emailEnabled} previewAction="previewEmail" sendAction="sendEmail" idField="eventId" audience="attendee" />
</main>
