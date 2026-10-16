<script lang="ts">
	import { Select } from 'flowbite-svelte';
	import Calendar, {
		type CalendarMode,
		type CalendarEvent
	} from '$lib/components/Calendar.svelte';
	import type { PageProps } from './$types';

	// categories, volunteers and events come from +page.server.ts
	let { data }: PageProps = $props();

	// Local, editable copy of the events; re-synced whenever the load function re-runs.
	let events = $state<CalendarEvent[]>([]);
	$effect.pre(() => {
		events = data.events;
	});
</script>

<!-- mode is either readonly, full, or volunteers-->
<main class="mx-auto max-w-5xl p-4">
	<h1 class="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">Calendar</h1>
	<Calendar
		bind:events
		categories={data.categories}
		volunteers={data.volunteers}
		mode={data.mode}
		onadd={(e) => console.log('added', e)}
		onedit={(e, scope) => console.log('edited', scope, e)}
		ondelete={(e, scope) => console.log('deleted', scope, e)}
	/>
	<!--p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{events.length} events</p-->
</main>