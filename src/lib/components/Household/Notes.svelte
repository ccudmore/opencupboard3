<script lang="ts">
	import { Label, Tags, Textarea, MultiSelect } from "flowbite-svelte";

	import { deliveryTypeOptions, serviceTimeOptions } from '#lib/labels.ts'

	let dietaryOptions = ['Halal', 'Kosher', 'Lactose Free', 'Gluten Free']

	let languagesSpoken = ['English', 'French', 'Arabic', 'Spanish']

	let { form, errors, constraints } = $props()

	// One look for every field on this tab: the same background, border, text colour and chips,
	// whether it is a tag box, a multi-select or a text area.
	const box = 'bg-gray-50 text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600'
	// the chips inside the tag boxes
	const tagChips = {
		tag: 'dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500',
		span: 'dark:text-gray-200'
	}
	// the multi-select's chips, made to look like the tag boxes' chips
	const multiChips =
		'[&>div]:rounded-lg [&>div]:border [&>div]:border-gray-300 [&>div]:bg-gray-100 [&>div]:p-2 [&>div]:text-sm [&>div]:text-gray-900 dark:[&>div]:border-gray-500 dark:[&>div]:bg-gray-600 dark:[&>div]:text-gray-200 dark:[&_button]:text-gray-200'
</script>

<div class="space-y-4">
	<div>
		<Label for="dietaryRestrictions" class="mb-2">Dietary Restrictions</Label>
		<Tags id="dietaryRestrictions" class="{box} dark:[&_button]:text-gray-200 dark:[&_ul]:bg-gray-700"
			classes={tagChips}
			bind:value={$form.dietaryRestrictions} showAvailableTags={true} showHelper availableTags={dietaryOptions} unique placeholder="Add restriction(s)"/>
	</div>

	<div>
		<Label for="preferredServiceTypes" class="mb-2">Service Type</Label>
		<MultiSelect id="preferredServiceTypes" class={box} classes={{ span: multiChips }} items={deliveryTypeOptions} bind:value={$form.preferredServiceTypes} />
	</div>

	<div>
		<Label for="preferredTimeOfDay" class="mb-2">Preferred Service Time</Label>
		<MultiSelect id="preferredTimeOfDay" placeholder="Preferred times" class={box} classes={{ span: multiChips }} bind:value={$form.preferredTimeOfDay} items={serviceTimeOptions} />
	</div>

	<div>
		<Label for="languagesSpoken" class="mb-2">Languages Spoken</Label>
		<Tags id="languagesSpoken" class="{box} dark:[&_button]:text-gray-200 dark:[&_ul]:bg-gray-700"
			classes={tagChips}
			bind:value={$form.languagesSpoken} showAvailableTags={true} showHelper availableTags={languagesSpoken} unique placeholder="Add language(s)"/>
	</div>

	<div>
		<Label for="pets" class="mb-2">Pets</Label>
		<Textarea id="pets" name="pets" classes={{ wrapper: box }} bind:value={$form.pets} {...$constraints.pets}/>
	</div>

	<div>
		<Label for="notes" class="mb-2">Notes</Label>
		<Textarea id="notes" name="notes" classes={{ wrapper: box }} bind:value={$form.notes} {...$constraints.notes}/>
	</div>

	<div>
		<Label for="howHeard" class="mb-2">How did you hear about us?</Label>
		<Textarea id="howHeard" name="howHeard" classes={{ wrapper: box }} bind:value={$form.howHeard} {...$constraints.howHeard}/>
	</div>
</div>