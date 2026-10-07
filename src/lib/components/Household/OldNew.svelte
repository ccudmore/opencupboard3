<script lang="ts">
	import { Input, Textarea, Tags, Button, } from "flowbite-svelte";
	import { toast } from "svelte-sonner";
	import {superForm} from "sveltekit-superforms/client"

    let dietaryOptions= ['Halal', 'Kosher', 'Lactose Free', 'Gluten Free']
	let languagesSpoken= ['English', 'French', 'Arabic', 'Spanish']

    let { data } = $props()

	function handleSuccess() {
        toast('Added successfully!');
    }

    function handleError(message: string) {
        toast(message);
    }

    const {form, errors, enhance, constraints} = superForm(data.form, {
        dataType: 'json',
		taintedMessage: "Are you sure you want to leave?",
		autoFocusOnError: "detect",
		onResult({ result }) {
			if (result.type === 'success' || result.type == 'redirect') {
                handleSuccess();
            } else if (result.type === 'failure') {
                handleError(result?.data?.message);
            }
        },
	})
</script>	
    
<p class="text-xl">New Household</p>
<form action="?/createHousehold" method="POST" class="p-2" use:enhance>
    <Input type="text" id="firstName" name="firstName" placeholder="First Name" class="w-100" bind:value={$form.firstName} {...$constraints.firstName}/>
    {#if $errors.firstName}<small>{$errors.firstName}</small>{/if}
    <Input type="text" id="lastName" name="lastName" placeholder="Last Name" bind:value={$form.lastName}  {...$constraints.lastName}/>
    {#if $errors.lastName}<small>{$errors.lastName}</small>{/if}
    <br>
    <Input type="street" id="street" name="street" placeholder="Street Address"  bind:value={$form.street} {...$constraints.street}/>				{#if $errors.street}<small>{$errors.street}</small>{/if}
    <Input type="street2" id="street2" name="street2" placeholder="Street Address"  bind:value={$form.street2} {...$constraints.street2}/>				{#if $errors.street}<small>{$errors.street}</small>{/if}
    <Input type="text" id="city" name="city" placeholder="City" bind:value={$form.city} {...$constraints.city}/>
    {#if $errors.city}<small>{$errors.city}</small>{/if}
    <Input type="text" id="postalCode" name="postalCode" placeholder="Postal Code" bind:value={$form.postalCode} {...$constraints.postalCode}/>
    {#if $errors.postalCode}<small>{$errors.postalCode}</small>{/if}
    <Input type="text" id="email" name="email" placeholder="Email Address" bind:value={$form.email} {...$constraints.email}/>
    {#if $errors.email}<small>{$errors.email}</small>{/if}
    <Input type="text" id="phone" name="phone" placeholder="Telephone Number" bind:value={$form.phone} {...$constraints.phone}/>
    {#if $errors.phone}<small>{$errors.phone}</small>{/if}
    <Tags placeholder="Languages spoken" class="mt-5 mb-3" bind:value={$form.languagesSpoken} showHelper availableTags={languagesSpoken} unique/>

    <Tags placeholder="Dietary restrictions" class="mt-5 mb-3" bind:value={$form.dietaryRestrictions} showHelper availableTags={dietaryOptions} unique/>
    <Textarea id="pets" class="w-full" name="pets" placeholder="Pets" bind:value={$form.pets} {...$constraints.pets}/>
    {#if $errors.pets}<small>{$errors.pets}</small>{/if}
    <Textarea id="notes" class="w-full" name="notes" placeholder="Notes" bind:value={$form.notes} {...$constraints.notes}/>
    {#if $errors.notes}<small>{$errors.notes}</small>{/if}
    <Textarea id="howHeard" class="w-full" name="howHeard" placeholder="How did you hear about us?" bind:value={$form.howHeard} {...$constraints.howHeard}/>
    {#if $errors.howHeard}<small>{$errors.howHeard}</small>{/if}

    <Button outline color="dark" type="submit">Add Household</Button>
	<!--SuperDebug data={$form} /-->
</form>