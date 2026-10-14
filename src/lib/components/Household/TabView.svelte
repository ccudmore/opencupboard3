<script lang="ts">
	import HouseholdAddress from "$lib/components/Household/Address.svelte";
	import HouseholdNotes from "$lib/components/Household/Notes.svelte";
	import HouseholdSpecialRequests from "$lib/components/Household/SpecialRequests.svelte";
	import HouseholdMembers from "$lib/components/Household/Members.svelte";
	import HouseholdAppointments from "$lib/components/Household/Appointments.svelte";
	import { Tabs, TabItem } from "flowbite-svelte";
  import { env } from '$env/dynamic/public';
	import AddressMap from "$lib/components/Household/AddressMap.svelte";
  import { UserCircleSolid, UsersGroupSolid, CalendarMonthSolid, MapPinAltSolid, AddressBookSolid, InfoCircleSolid, QuestionCircleSolid, } from "flowbite-svelte-icons";

	let { form, errors, constraints, validateForm} = $props()
  const title = env.PUBLIC_SPECIAL_REQUESTS_TITLE??"Special Requests"

const active =
    'inline-block px-4 py-2 text-sm font-medium rounded-lg shadow-sm ' +
    'bg-blue-800 text-white ' +
    'dark:bg-blue-300 dark:text-blue-950';

  const inactive =
    'inline-block px-4 py-2 text-sm font-medium rounded-lg ' +
    'text-gray-500 hover:text-gray-900 hover:bg-gray-200 ' +
    'dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700';

</script>

<div>
<Tabs
  tabStyle="underline"
  divider={false}
  class="mt-3 p-4 rounded-xl bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-700"
>

  <TabItem open>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <AddressBookSolid size="md" />Address
      </div>
    {/snippet}
		<HouseholdAddress form={form} errors={errors} constraints={constraints}/>
  </TabItem>
  
  <TabItem>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <InfoCircleSolid size="md" />Additional Information
      </div>
    {/snippet}
		<HouseholdNotes form={form} errors={errors} constraints={constraints}/>
  </TabItem>

  <TabItem>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <QuestionCircleSolid size="md" />{title}
      </div>
    {/snippet}
		<HouseholdSpecialRequests form={form} errors={errors} constraints={constraints} title={title}/>
  </TabItem>

  <TabItem>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <UsersGroupSolid size="md" />Household Members
      </div>
    {/snippet}
		<HouseholdMembers form={form} errors={errors} constraints={constraints} validateForm={validateForm}/>
  </TabItem>

  <TabItem>
    {#snippet titleSlot()}
      <div class="flex items-center gap-2">
        <CalendarMonthSolid  size="md" />Appointments
      </div>
    {/snippet}
		<HouseholdAppointments form={form} errors={errors} constraints={constraints}/>
  </TabItem>

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
