<script lang="ts">
	import HouseholdAddress from "$lib/components/Household/Address.svelte";
	import HouseholdNotes from "$lib/components/Household/Notes.svelte";
	import HouseholdSpecialRequests from "$lib/components/Household/SpecialRequests.svelte";
	import HouseholdMembers from "$lib/components/Household/Members.svelte";
	import HouseholdAppointments from "$lib/components/Household/Appointments.svelte";
	import { env } from '$env/dynamic/public';

	const title = env.PUBLIC_SPECIAL_REQUESTS_TITLE??"Speial Requests"

	let { form, errors, constraints} = $props()
</script>

<div class="mb-6 grid gap-6 md:grid-cols-3">
    <div class="border-dashed border-2 border-indigo-600 p-4">
		<HouseholdAddress form={form} errors={errors} constraints={constraints}/>
	</div>
    <div class="border-dashed border-2 border-indigo-600 p-4">
		<HouseholdNotes form={form} errors={errors} constraints={constraints}/>
	</div>
	<div class="border-dashed border-2 border-indigo-600 p-4">
		<HouseholdSpecialRequests form={form} errors={errors} constraints={constraints} title=title/>
	</div>
	<div class="border-dashed border-2 border-indigo-600 p-4 col-span-2">
		<HouseholdMembers form={form} errors={errors} constraints={constraints}/>
	</div>
	<div class="border-dashed border-2 border-indigo-600 p-4 col-span-1">
		<HouseholdAppointments form={form} errors={errors} constraints={constraints}/>
	</div>
</div>
