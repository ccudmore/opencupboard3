<script lang="ts">
	import HouseholdAddress from "$lib/components/Household/Address.svelte";
	import HouseholdNotes from "$lib/components/Household/Notes.svelte";
	import HouseholdSpecialRequests from "$lib/components/Household/SpecialRequests.svelte";
	import HouseholdMembers from "$lib/components/Household/Members.svelte";
	import Bookings from "$lib/components/Household/Bookings.svelte";
	import { Tabs, TabItem } from "flowbite-svelte";
	import AddressMap from "$lib/components/Household/AddressMap.svelte";
  import { HeartSolid, UsersGroupSolid, CalendarMonthSolid, MapPinAltSolid, AddressBookSolid, InfoCircleSolid, QuestionCircleSolid, } from "flowbite-svelte-icons";

	let { form, errors, constraints, validateForm, bookings, services, sites, eligibleDate, emailEnabled, enhance} = $props()

  const requestsTypes = [
    {name: 'Special', icon: QuestionCircleSolid},
    {name: 'Prayer', icon: HeartSolid},
  ]
</script>

<div class="p-1 tabs-scroll">
  <Tabs
    tabStyle="underline"
    divider={false}
    class="mt-3 p-1 rounded-xl bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-700"
  >
  <TabItem open>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <CalendarMonthSolid  size="md" />Appointments
      </div>
    {/snippet}
		<Bookings {bookings} {services} {sites} {eligibleDate} {emailEnabled} {form}/>
  </TabItem>

    <TabItem>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <UsersGroupSolid size="md" />Members
      </div>
    {/snippet}
		<HouseholdMembers {form} {errors} {constraints} {validateForm}/>
  </TabItem>

  <TabItem>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <AddressBookSolid size="md" />Address
      </div>
    {/snippet}
		<HouseholdAddress {form} {errors} {constraints}/>
  </TabItem>
  
  <TabItem>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <InfoCircleSolid size="md" />Information
      </div>
    {/snippet}
		<HouseholdNotes {form} {errors} {constraints}/>
  </TabItem>

  {#each requestsTypes as item}
  {@const Icon = item.icon}
  <TabItem>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <Icon size="md" />{item.name}
      </div>
    {/snippet}
		<HouseholdSpecialRequests {form} {errors} {constraints} type={item.name}/>
  </TabItem>
  {/each}

  <TabItem>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <MapPinAltSolid size="md" />Map
      </div>
    {/snippet}
    <AddressMap street={$form.street} street2={$form.street2} city={$form.city} province={$form.province} country={$form.country}/>
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
