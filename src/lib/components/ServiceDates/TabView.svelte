<script lang="ts">
	import { Tabs, TabItem } from 'flowbite-svelte';
	import { UsersGroupSolid, CalendarMonthSolid, InfoCircleSolid } from 'flowbite-svelte-icons';
	import type { Service, Site } from './types';
	import DetailsTab from './DetailsTab.svelte';
	import AppointmentsTab from './AppointmentsTab.svelte';
	import VolunteersTab from './VolunteersTab.svelte';
	import { setActionRunner } from '$lib/client/actionRunner.svelte';

	let {
		service,
		sites,
		timeZone,
		emailEnabled,
		onopen,
		canManageVolunteers
	}: {
		service: Service;
		sites: Site[];
		timeZone: string;
		emailEnabled: boolean;
		onopen: (id: string) => void;
		canManageVolunteers: boolean;
	} = $props();

	// One shared runner (busy + run) for all three tabs. Must be called during init.
	setActionRunner();
</script>

<div class="tabs-scroll space-y-4 p-1">
	<Tabs
		tabStyle="underline"
		divider={false}
		class="tabs-panel"
	>
		<TabItem open>
			{#snippet titleSlot()}
				<div class="flex items-center gap-2">
					<InfoCircleSolid size="md" />Details
				</div>
			{/snippet}
			<DetailsTab {service} {sites} {timeZone} {emailEnabled} {onopen} {canManageVolunteers} />
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}
				<div class="flex items-center gap-2">
					<CalendarMonthSolid size="md" />Appointments
				</div>
			{/snippet}
			<AppointmentsTab {service} {sites} {timeZone} {emailEnabled} {onopen} {canManageVolunteers} />
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}
				<div class="flex items-center gap-2">
					<UsersGroupSolid size="md" />Volunteers
				</div>
			{/snippet}
			<VolunteersTab {service} {sites} {timeZone} {emailEnabled} {onopen} {canManageVolunteers} />
		</TabItem>
	</Tabs>
</div>

