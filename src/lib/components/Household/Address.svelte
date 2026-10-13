<script lang="ts">
    import { Input, Helper, Label } from "flowbite-svelte";

    let { form, errors, constraints } = $props();
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
    <!-- Street address: full width on both layouts -->
    <div class="md:col-span-2">
        <Label for="street" class="mb-2">Street Address</Label>
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
            <Helper class="mt-2 text-red-500">
                <span class="font-medium">{$errors.street}</span>
            </Helper>
        {/if}
    </div>

    <div>
        <Label for="city" class="mb-2">City</Label>
        <Input
            type="text"
            id="city"
            name="city"
            bind:value={$form.city}
            {...$constraints.city}
            required
        />
        {#if $errors.city}
            <Helper class="mt-2 text-red-500">
                <span class="font-medium">{$errors.city}</span>
            </Helper>
        {/if}
    </div>

    <div>
        <Label for="province" class="mb-2">Province</Label>
        <Input
            type="text"
            id="province"
            name="province"
            bind:value={$form.province}
            {...$constraints.province}
            required
        />
        {#if $errors.province}
            <Helper class="mt-2 text-red-500">
                <span class="font-medium">{$errors.province}</span>
            </Helper>
        {/if}
    </div>

    <div>
        <Label for="country" class="mb-2">Country</Label>
        <Input
            type="text"
            id="country"
            name="country"
            bind:value={$form.country}
            {...$constraints.country}
            required
        />
        {#if $errors.country}
            <Helper class="mt-2 text-red-500">
                <span class="font-medium">{$errors.country}</span>
            </Helper>
        {/if}
    </div>

    <div>
        <Label for="postalCode" class="mb-2">Postal Code</Label>
        <Input
            type="text"
            id="postalCode"
            name="postalCode"
            bind:value={$form.postalCode}
            {...$constraints.postalCode}
            required
        />
        {#if $errors.postalCode}
            <Helper class="mt-2 text-red-500">
                <span class="font-medium">{$errors.postalCode}</span>
            </Helper>
        {/if}
    </div>
</div>