<script lang="ts">
	import { STATE_DISPLAY_NAME } from "$app/env/public";
    import { Input, Helper, Label } from "flowbite-svelte";

    let { form, errors, constraints } = $props();
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
    <!-- Street address: full width on both layouts -->
    <div class="md:col-span-2">
        <Label for="street">Street Address</Label>
        <Input
            type="text"
            id="street"
            name="street"
            bind:value={$form.street}
            {...$constraints.street}
            required
        />
        <Input
            type="text"
            id="street2"
            name="street2"
            class="mt-2"
            bind:value={$form.street2}
            {...$constraints.street2}
        />
        {#if $errors.street}
            <Helper class="field-error">
                <span class="font-medium">{$errors.street}</span>
            </Helper>
        {/if}
    </div>

    <div>
        <Label for="city">City</Label>
        <Input
            type="text"
            id="city"
            name="city"
            bind:value={$form.city}
            {...$constraints.city}
            required
        />
        {#if $errors.city}
            <Helper class="field-error">
                <span class="font-medium">{$errors.city}</span>
            </Helper>
        {/if}
    </div>

    <div>
        <Label for="state">{STATE_DISPLAY_NAME}</Label>
        <Input
            type="text"
            id="state"
            name="state"
            bind:value={$form.state}
            {...$constraints.state}
            required
        />
        {#if $errors.state}
            <Helper class="field-error">
                <span class="font-medium">{$errors.state}</span>
            </Helper>
        {/if}
    </div>

    <div>
        <Label for="country">Country</Label>
        <Input
            type="text"
            id="country"
            name="country"
            bind:value={$form.country}
            {...$constraints.country}
            required
        />
        {#if $errors.country}
            <Helper class="field-error">
                <span class="font-medium">{$errors.country}</span>
            </Helper>
        {/if}
    </div>

    <div>
        <Label for="postalCode">Postal Code</Label>
        <Input
            type="text"
            id="postalCode"
            name="postalCode"
            bind:value={$form.postalCode}
            {...$constraints.postalCode}
            required
        />
        {#if $errors.postalCode}
            <Helper class="field-error">
                <span class="font-medium">{$errors.postalCode}</span>
            </Helper>
        {/if}
    </div>
</div>