<script lang="ts">
	import { superForm, type SuperValidated, type Infer } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { PhoneInput, Modal, Label, Input, Textarea, MultiSelect, Button, Helper, Alert } from 'flowbite-svelte';
	import { newHouseholdSchema } from '$lib/formschemas/household';
    import { toast } from "svelte-sonner";
  import SuperDebug from 'sveltekit-superforms/SuperDebug.svelte';

let {
		data,
		open = $bindable(false)
	}: { data: SuperValidated<Infer<typeof newHouseholdSchema>>; open: boolean } = $props();

	// superForm only needs the initial value; it manages its own state afterwards
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, message, reset, constraints } = superForm(data, {
		validators: zod4Client(newHouseholdSchema),
		resetForm: true,
		onError({ result }) {
			toast(`Error: ${result.error.message}`);
		},
		onUpdated({ form }) {
			toast('updated '+form.data.firstName)
			if (form.valid) open = false;
		}
	});

	const languages = ['English', 'French', 'Arabic', 'Mandarin', 'Spanish', 'Somali'].map((l) => ({
		value: l,
		name: l
	}));
	const dietary = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free'].map((d) => ({
		value: d,
		name: d
	}));
</script>

<Modal title="New household" bind:open size="lg" onclose={() => reset()}>
	<form method="POST" action="?/createHousehold" use:enhance class="grid grid-cols-1 gap-4 md:grid-cols-2">
		{#if $message}
			<Alert color="red" class="md:col-span-2">{$message}</Alert>
		{/if}

		<div>
			<Label for="firstName" class="mb-1">First name</Label>
			<Input id="firstName" name="firstName" bind:value={$form.firstName}
				color={$errors.firstName ? 'red' : undefined} />
			{#if $errors.firstName}<Helper color="red">{$errors.firstName}</Helper>{/if}
		</div>

		<div>
			<Label for="lastName" class="mb-1">Last name</Label>
			<Input id="lastName" name="lastName" bind:value={$form.lastName}
				color={$errors.lastName ? 'red' : undefined} />
			{#if $errors.lastName}<Helper color="red">{$errors.lastName}</Helper>{/if}
		</div>

		<div>
			<Label for="email" class="mb-1">Email</Label>
			<Input id="email" name="email" type="email" bind:value={$form.email}
				color={$errors.email ? 'red' : undefined} />
			{#if $errors.email}<Helper color="red">{$errors.email}</Helper>{/if}
		</div>

		<div>
			<Label for="phone" class="mb-1">Phone</Label>
			<!--
			<Input id="phone" name="phone" type="tel" bind:value={$form.phone}
				color={$errors.phone ? 'red' : undefined} />
				-->
				<!---
				<PhoneInput id="phone" name="phone" type="tel" oninput={(e: Event) => ($form.phone = (e.currentTarget as HTMLInputElement).value)}
		-->
			<input
    			type="tel"
    			name="phone"
    			bind:value={$form.phone}
    			{...$constraints.phone}
				color={$errors.phone ? 'red' : undefined} />
			{#if $errors.phone}<Helper color="red">{$errors.phone}</Helper>{/if}
		</div>

		<div class="md:col-span-2">
			<Label for="street" class="mb-1">Street</Label>
			<Input id="street" name="street" bind:value={$form.street}
				color={$errors.street ? 'red' : undefined} />
			{#if $errors.street}<Helper color="red">{$errors.street}</Helper>{/if}
		</div>

		<div class="md:col-span-2">
			<Label for="street2" class="mb-1">Street 2 (optional)</Label>
			<Input id="street2" name="street2" bind:value={$form.street2} />
		</div>

		<div>
			<Label for="city" class="mb-1">City</Label>
			<Input id="city" name="city" bind:value={$form.city}
				color={$errors.city ? 'red' : undefined} />
			{#if $errors.city}<Helper color="red">{$errors.city}</Helper>{/if}
		</div>

		<div>
			<Label for="province" class="mb-1">Province</Label>
			<Input id="province" name="province" bind:value={$form.province} />
		</div>

		<div>
			<Label for="postalCode" class="mb-1">Postal code</Label>
			<Input id="postalCode" name="postalCode" bind:value={$form.postalCode}
				color={$errors.postalCode ? 'red' : undefined} />
			{#if $errors.postalCode}<Helper color="red">Enter a valid Canadian postal code</Helper>{/if}
		</div>

		<div>
			<Label for="country" class="mb-1">Country</Label>
			<Input id="country" name="country" bind:value={$form.country} />
		</div>

		<div>
			<Label class="mb-1">Languages spoken</Label>
			<MultiSelect items={languages} bind:value={$form.languagesSpoken} />
			{#each $form.languagesSpoken as l}<input type="hidden" name="languagesSpoken" value={l} />{/each}
		</div>

		<div>
			<Label class="mb-1">Dietary restrictions</Label>
			<MultiSelect items={dietary} bind:value={$form.dietaryRestrictions} />
			{#each $form.dietaryRestrictions as d}<input type="hidden" name="dietaryRestrictions" value={d} />{/each}
		</div>

		<div>
			<Label for="pets" class="mb-1">Pets</Label>
			<Input id="pets" name="pets" bind:value={$form.pets} />
		</div>

		<div>
			<Label for="howHeard" class="mb-1">How did you hear about us?</Label>
			<Input id="howHeard" name="howHeard" bind:value={$form.howHeard} />
		</div>

		<div class="md:col-span-2">
			<Label for="notes" class="mb-1">Notes</Label>
			<Textarea id="notes" name="notes" class="w-full" rows={3} bind:value={$form.notes} />
		</div>

		<div class="flex justify-end gap-2 md:col-span-2">
			<Button color="alternative" onclick={() => (open = false)}>Cancel</Button>
			<Button type="submit" disabled={$submitting} color="alternative">
				{$submitting ? 'Saving…' : 'Save'}
			</Button>
		</div>
	</form>
</Modal>
<!--SuperDebug data={form}/-->