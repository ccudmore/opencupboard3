<script lang="ts">
	import DetailsTab from "./DetailsTab.svelte";
	import { Tabs, TabItem } from "flowbite-svelte";
  import { HeartSolid, UsersGroupSolid, CalendarMonthSolid, MapPinAltSolid, AddressBookSolid, InfoCircleSolid, QuestionCircleSolid, } from "flowbite-svelte-icons";
  import type { Service, Site, Appointment } from './types';
  import AppointmentsTab from "./AppointmentsTab.svelte";
    import VolunteersTab from "./VolunteersTab.svelte";

    let { service,
          sites,
          timeZone,
          emailEnabled,
          onopen,
          canManageVolunteers,
        }: {
            service:Service;
            sites: Site[];
            timeZone: string;
            emailEnabled: boolean;
            onopen: (id: string) => void;
            canManageVolunteers: boolean;
        }  = $props();
		


</script>

<div class="p-1 tabs-scroll space-y-4"> <!-- space-y-4 is from the servicedatecard -->
  <Tabs
    tabStyle="underline"
    divider={false}
    class="mt-3 p-1 rounded-xl bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-700"
  >
  <TabItem open>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <CalendarMonthSolid  size="md" />Details
      </div>
    {/snippet}

		<DetailsTab {service} {sites} {timeZone} {emailEnabled} {onopen} {canManageVolunteers}/>
  </TabItem>

    <TabItem open>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <CalendarMonthSolid  size="md" />Appointments
      </div>
    {/snippet}
		<AppointmentsTab {service} {sites} {timeZone} {emailEnabled} {onopen} {canManageVolunteers}/>
  </TabItem>

      <TabItem open>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <CalendarMonthSolid  size="md" />Volunteers
      </div>
    {/snippet}
		<VolunteersTab {service} {sites} {timeZone} {emailEnabled} {onopen} {canManageVolunteers}/>
  </TabItem>


</Tabs>
</div>

<style>
  .tabs-scroll :global([role='tablist']) {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs-scroll :global([role='tab']) {
    flex-shrink: 0;
    white-space: nowrap;
  }
</style>
