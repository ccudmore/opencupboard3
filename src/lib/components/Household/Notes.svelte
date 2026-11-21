<script lang="ts">
	import {  } from "flowbite-svelte";
	import { Label, Tags, Textarea,MultiSelect } from "flowbite-svelte";

	import { deliveryTypeOptions, serviceTimeOptions } from '#lib/labels.ts'

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
<Label for="preferredServiceTypes">Service Type</Label>
<MultiSelect class="mb-2" items={deliveryTypeOptions} bind:value={$form.preferredServiceTypes} />
<Label for="preferredTimeOfDay">Prefered Service Time</Label>
<MultiSelect id="preferredTimeOfDay" placeholder="Preferred times" class="mt-5 mb-3" bind:value={$form.preferredTimeOfDay}   items={serviceTimeOptions}  />
<Label for="languagesSpoken" class="mt-5 mb-3">Languages Spoken</Label>

<Tags id="languagesSpoken" class="mt-5 mb-3 text-gray-900 dark:[&_button]:text-gray-200 dark:[&_ul]:bg-gray-700"
	classes={{
		tag: "dark:bg-gray-600",                    // the chips you've added
		span: "dark:text-gray-200",                 // text inside the chips
	}}
 bind:value={$form.languagesSpoken} showAvailableTags={true} showHelper availableTags={languagesSpoken} unique placeholder="Add language(s)"/>
<Label for="pets">Pets</Label>
<Textarea id="pets" name="pets" bind:value={$form.pets} {...$constraints.pets}/>
<Label for="notes">Notes</Label>
<Textarea id="notes" name="notes" bind:value={$form.notes} {...$constraints.notes}/>
<Label for="howHeard">How did you hear about us?</Label>
<Textarea id="howHeard" name="howHeard" bind:value={$form.howHeard} {...$constraints.howHeard}/>
