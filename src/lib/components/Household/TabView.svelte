<script lang="ts">
	import HouseholdAddress from "$lib/components/Household/Address.svelte";
	import HouseholdNotes from "$lib/components/Household/Notes.svelte";
	import HouseholdSpecialRequests from "$lib/components/Household/SpecialRequests.svelte";
	import HouseholdMembers from "$lib/components/Household/Members.svelte";
	import HouseholdAppointments from "$lib/components/Household/Appointments.svelte";
	import { Tabs, TabItem } from "flowbite-svelte";
	import Map from "$lib/components/Map.svelte";
  import { env } from '$env/dynamic/public';

	let { form, errors, constraints} = $props()
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
  tabStyle="none"
  divider={false}
  ulClass="inline-flex gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:border-gray-700"
  contentClass="mt-3 p-4 rounded-xl bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-700"
>
  <TabItem open title="Address" activeClass={active} inactiveClass={inactive}>
		<HouseholdAddress form={form} errors={errors} constraints={constraints}/>
  </TabItem>
  <TabItem title="Additional Information" activeClass={active} inactiveClass={inactive}>
		<HouseholdNotes form={form} errors={errors} constraints={constraints}/>
  </TabItem>
  <TabItem title={title} activeClass={active} inactiveClass={inactive}>
		<HouseholdSpecialRequests form={form} errors={errors} constraints={constraints} title={title}/>
  </TabItem>
  <TabItem title="Household Members" activeClass={active} inactiveClass={inactive}>
		<HouseholdMembers form={form} errors={errors} constraints={constraints}/>
  </TabItem>
  <TabItem title="Appointments" activeClass={active} inactiveClass={inactive}>
		<HouseholdAppointments form={form} errors={errors} constraints={constraints}/>
  </TabItem>
  <TabItem title="Map" activeClass={active} inactiveClass={inactive}>
    <Map street={$form.street} street2={$form.street2} city={$form.city} province={$form.province} country={$form.country}/>
  </TabItem>
</Tabs>
</div>
