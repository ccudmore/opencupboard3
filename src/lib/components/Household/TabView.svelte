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
  const title = env.PUBLIC_SPECIAL_REQUESTS_TITLE??"Speial Requests"

</script>

<div>
<Tabs classes={{ active: "p-4 text-white bg-blue-500 rounded-t-lg dark:bg-blue-600 dark:text-white" }}>
  <TabItem open title="Address">
		<HouseholdAddress form={form} errors={errors} constraints={constraints}/>
  </TabItem>
  <TabItem title="Additional Information">
		<HouseholdNotes form={form} errors={errors} constraints={constraints}/>
  </TabItem>
  <TabItem title={title}>
		<HouseholdSpecialRequests form={form} errors={errors} constraints={constraints} title={title}/>
  </TabItem>
  <TabItem title="Household Members">
		<HouseholdMembers form={form} errors={errors} constraints={constraints}/>
  </TabItem>
  <TabItem title="Appointments">
		<HouseholdAppointments form={form} errors={errors} constraints={constraints}/>
  </TabItem>
  <TabItem title="Map">
    <Map street={$form.street} street2={$form.street2} city={$form.city} province={$form.province} country={$form.country}/>
  </TabItem>
</Tabs>
</div>