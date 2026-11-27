<script lang="ts">
	import type { Service, Site } from './types';
	import TabView from "#lib/components/ServiceDates/TabView.svelte";

	let {
		service,
		sites,
		timeZone,
		emailEnabled,
		canManageVolunteers,
		initialTab = 'details',
		onopen
	}: {
		service: Service;
		sites: Site[];
		timeZone: string;
		emailEnabled: boolean;
		canManageVolunteers: boolean;
		/** the tab to show first */
		initialTab?: string;
		/** called with the id of a service date that should be opened (after a duplicate) */
		onopen: (id: string) => void;
	} = $props();
	const sectionClass = 'rounded-lg border border-gray-200 p-3 sm:p-4 dark:border-gray-700';
	const headingClass = 'mb-3 text-base font-semibold text-gray-900 dark:text-white';
</script>

<div class="space-y-4">

<TabView {service} {sites} {timeZone} {emailEnabled} {onopen} {canManageVolunteers} {initialTab} />
</div>