<script lang="ts">
	import {  } from "flowbite-svelte";
	import { Label, Tags, Textarea,MultiSelect } from "flowbite-svelte";

    const householdStatuses = [
    	{ value: "Active", name: "Active" },
    	{ value: "Inactive", name: "Inactive" },
    	{ value: "Archived", name: "Archived" },
  	];

	const deliveryTypes = [
    	{ value: "In Person", name: "In Person" },
    	{ value: "Delivery", name: "Delivery" },
    	{ value: "Pickup", name: "Pickup" },
  	];
	const deliveryTimes = [
    	{ value: "Wednesday Morning", name: "Wednesday Morning" },
    	{ value: "Wednesday Evening", name: "Wednesday Evening" },
    	{ value: "Thursday Morning", name: "Thursday Morning" },
    	{ value: "Thursday Evening", name: "Thursday Evening" },
  	];

    let dietaryOptions= ['Halal', 'Kosher', 'Lactose Free', 'Gluten Free']

	let languagesSpoken= ['English', 'French', 'Arabic', 'Spanish']

	let { form, errors, constraints} = $props()
</script>   
<Label for="dietaryRestrictions" class="mb-2">Dietary Restrictions</Label>
<Tags id="dietaryRestrictions" class="mt-5 mb-3" bind:value={$form.dietaryRestrictions} showHelper availableTags={dietaryOptions} unique/>
<Label for="preferredServiceTypes" class="mb-2">Service Type</Label>
<MultiSelect class="mb-2" items={deliveryTypes} bind:value={$form.preferredServiceTypes} />
<Label for="preferredTimeOfDay" class="mb-2">Prefered Service Time</Label>
<MultiSelect id="preferredTimeOfDay" placeholder="Preferred times" class="mt-5 mb-3" bind:value={$form.preferredTimeOfDay}   items={deliveryTimes}  />
<Label for="languagesSpoken" class="mb-2">Languages Spoken</Label>
<Tags placeholder="Languages spoken" class="mt-5 mb-3" bind:value={$form.languagesSpoken} showHelper availableTags={languagesSpoken} unique/>
<Label for="pets" class="mb-2">Pets</Label>
<Textarea id="pets" class="w-full" name="pets" bind:value={$form.pets} {...$constraints.pets}/>
<Label for="notes" class="mb-2">Notes</Label>
<Textarea id="notes" class="w-full" name="notes" bind:value={$form.notes} {...$constraints.notes}/>
<Label for="howHeard" class="mb-2">How did you hear about us?</Label>
<Textarea id="howHeard" class="w-full" name="howHeard" bind:value={$form.howHeard} {...$constraints.howHeard}/>