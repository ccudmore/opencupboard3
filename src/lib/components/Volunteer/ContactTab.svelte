<script lang="ts">
	import { Helper, Input, Label } from 'flowbite-svelte';
	import FieldError from '$lib/components/FieldError.svelte';

	// form and errors are the volunteer page's Superforms stores
	let { form, errors, loginEmail }: { form: any; errors: any; loginEmail: string } = $props();
</script>

<section class="tab-section">
	<h2 class="section-title">Contact</h2>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div class="min-w-0">
			<Label for="firstName">First name</Label>
			<Input id="firstName" autocomplete="off" bind:value={$form.firstName} />
			<FieldError messages={$errors.firstName} />
		</div>
		<div class="min-w-0">
			<Label for="lastName">Last name</Label>
			<Input id="lastName" autocomplete="off" bind:value={$form.lastName} />
			<FieldError messages={$errors.lastName} />
		</div>
		<div class="min-w-0">
			<Label for="login-email-shown">Email (login)</Label>
			<Input id="login-email-shown" type="email" value={loginEmail} readonly disabled />
			<Helper class="field-help">Change it on the Login tab.</Helper>
		</div>
		<div class="min-w-0">
			<Label for="email2">Second email (optional)</Label>
			<Input id="email2" type="email" autocomplete="off" bind:value={$form.email2} />
			<FieldError messages={$errors.email2} />
		</div>
		<div class="min-w-0">
			<Label for="phone1">Phone</Label>
			<Input id="phone1" type="tel" autocomplete="off" bind:value={$form.phone1} />
			<FieldError messages={$errors.phone1} />
		</div>
		<div class="min-w-0">
			<Label for="phone2">Second phone</Label>
			<Input id="phone2" type="tel" autocomplete="off" bind:value={$form.phone2} />
			<FieldError messages={$errors.phone2} />
		</div>
	</div>
</section>

<section class="tab-section">
	<h2 class="section-title">Address</h2>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<div class="min-w-0 md:col-span-2">
			<Label for="street">Street</Label>
			<Input id="street" autocomplete="off" bind:value={$form.street} />
			<FieldError messages={$errors.street} />
		</div>
		<div class="min-w-0">
			<Label for="unitNumber">Unit number (optional)</Label>
			<Input id="unitNumber" autocomplete="off" bind:value={$form.unitNumber} />
			<FieldError messages={$errors.unitNumber} />
		</div>
		<div class="min-w-0">
			<Label for="city">City</Label>
			<Input id="city" autocomplete="off" bind:value={$form.city} />
			<FieldError messages={$errors.city} />
		</div>
		<div class="min-w-0">
			<Label for="postalCode">Postal code</Label>
			<Input id="postalCode" autocomplete="off" bind:value={$form.postalCode} />
			<FieldError messages={$errors.postalCode} />
		</div>
		<div class="min-w-0">
			<Label for="province">Province</Label>
			<Input id="province" autocomplete="off" bind:value={$form.province} />
			<FieldError messages={$errors.province} />
		</div>
		<div class="min-w-0">
			<Label for="country">Country</Label>
			<Input id="country" autocomplete="off" bind:value={$form.country} />
			<FieldError messages={$errors.country} />
		</div>
	</div>
</section>
