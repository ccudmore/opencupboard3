<script lang="ts">
	import {  } from "flowbite-svelte";
	import { Label, Tags, Textarea,MultiSelect } from "flowbite-svelte";

	import { deliveryTypeOptions, serviceTimeOptions } from '$lib/labels'

    let dietaryOptions= ['Halal', 'Kosher', 'Lactose Free', 'Gluten Free']

	let languagesSpoken= ['English', 'French', 'Arabic', 'Spanish']

	let { form, errors, constraints} = $props()
</script>   
<Label for="dietaryRestrictions" class="mt-5 mb-3">Dietary Restrictions</Label>

<Tags id="dietaryRestrictions" class="mt-5 mb-3 text-gray-900 dark:[&_button]:text-gray-200 dark:[&_ul]:bg-gray-700" 
	classes={{
		tag: "dark:bg-gray-600",                    // the chips you've added
		span: "dark:text-gray-200",                 // text inside the chips
	}}
 bind:value={$form.dietaryRestrictions} showAvailableTags={true} showHelper availableTags={dietaryOptions} unique placeholder="Add restriction(s)"/>
<Label for="preferredServiceTypes" class="mb-2">Service Type</Label>
<MultiSelect class="mb-2" items={deliveryTypeOptions} bind:value={$form.preferredServiceTypes} />
<Label for="preferredTimeOfDay" class="mb-2">Prefered Service Time</Label>
<MultiSelect id="preferredTimeOfDay" placeholder="Preferred times" class="mt-5 mb-3" bind:value={$form.preferredTimeOfDay}   items={serviceTimeOptions}  />
<Label for="languagesSpoken" class="mb-2">Languages Spoken</Label>
<Tags placeholder="Languages spoken" class="mt-5 mb-3" bind:value={$form.languagesSpoken} showHelper showAvailableTags={true} availableTags={languagesSpoken} unique/>
<Label for="pets" class="mb-2">Pets</Label>
<Textarea id="pets" class="w-full" name="pets" bind:value={$form.pets} {...$constraints.pets}/>
<Label for="notes" class="mb-2">Notes</Label>
<Textarea id="notes" class="w-full" name="notes" bind:value={$form.notes} {...$constraints.notes}/>
<Label for="howHeard" class="mb-2">How did you hear about us?</Label>
<Textarea id="howHeard" class="w-full" name="howHeard" bind:value={$form.howHeard} {...$constraints.howHeard}/>