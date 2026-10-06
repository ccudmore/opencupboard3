<script lang="ts">
  import { enhance, applyAction } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { Modal, Label, Input, Helper, Button, Alert, Tags, Textarea } from 'flowbite-svelte';

  type Household = { id: string; name: string; address: string };

  // `open` is bindable so a button outside the component can toggle it.
  // `action` defaults to the current page's `createHousehold` action; pass an
  // absolute path (e.g. "/households?/createHousehold") if it lives elsewhere.
  let {
    open = $bindable(false),
    action = '?/createHousehold',
    onsaved
  }: {
    open?: boolean;
    action?: string;
    onsaved?: (household: Household) => void;
  } = $props();

  let name = $state('');
  let address = $state('');
  let submitted = $state(false);
  let saving = $state(false);
  let serverError = $state('');
  let serverFieldErrors = $state<{ name?: string; address?: string }>({});
    let dietaryOptions= ['Halal', 'Kosher', 'Lactose Free', 'Gluten Free']
    let languagesSpoken= ['English', 'French', 'Arabic', 'Spanish']
      let householdTags1 = $state([]); 
      let householdTags2 = $state([]); 

  const clientErrors = $derived({
    name: name.trim() ? '' : 'Household name is required.',
    address: address.trim() ? '' : 'Address is required.'
  });
//  const isValid = true;
  const isValid = $derived(!clientErrors.name && !clientErrors.address);

  const nameError = $derived(submitted ? clientErrors.name || serverFieldErrors.name || '' : '');
//  const addressError = '';
  
  const addressError = $derived(
    submitted ? clientErrors.address || serverFieldErrors.address || '' : ''
  );
  

  // Reset the form whenever the dialog closes.
  $effect(() => {
    if (!open) {
        name = '';
      address = '';
      submitted = false;
      serverError = '';
      serverFieldErrors = {};
    }
  });

  const handleSubmit: SubmitFunction = ({ cancel }) => {
    submitted = true;
    serverError = '';
    serverFieldErrors = {};

    if (!isValid) {
      cancel(); // client-side validation failed: don't hit the server
      return;
    }

    saving = true;

    return async ({ result, update }) => {
      saving = false;

      if (result.type === 'success') {
        onsaved?.(result.data?.household as Household);
        await update(); // re-runs load() functions so lists refresh
        open = false;
      } else if (result.type === 'failure') {
        serverFieldErrors = result.data?.errors ?? {};
        serverError = result.data?.message ?? '';
      } else {
        await applyAction(result); // redirect or unexpected error
      }
    };
  };
</script>

<Modal title="New household" bind:open autoclose={false} size="md">
  <form
    id="new-household-form"
    method="POST"
    {action}
    use:enhance={handleSubmit}
    novalidate
    class="flex flex-col gap-4"
  >
    {#if serverError}
      <Alert color="red">{serverError}</Alert>
    {/if}

<!---->
    <div>
      <Label for="household-name" class="mb-2">Household name</Label>
      <Input
        id="household-name"
        name="name"
        bind:value={name}
        required
        aria-invalid={!!nameError}
        color={nameError ? 'red' : undefined}
      />
      {#if nameError}
        <Helper class="mt-2" color="red">{nameError}</Helper>
      {/if}
    </div>

    <div>
      <Label for="household-address" class="mb-2">Address</Label>
      <Input
        id="household-address"
        name="address"
        bind:value={address}
        required
        aria-invalid={!!addressError}
        color={addressError ? 'red' : undefined}
      />
    </div>

<!---->
    
    <Input type="text" id="firstName" name="firstName" placeholder="First Name" class="w-100"/>
    <Input type="text" id="lastName" name="lastName" placeholder="Last Name" />
    <br>
    <Input type="street" id="street" name="street" placeholder="Street Address"  />
    <Input type="street2" id="street2" name="street2" placeholder="Street Address"/>
    <Input type="text" id="city" name="city" placeholder="City" />
    <Input type="text" id="postalCode" name="postalCode" placeholder="Postal Code" />
    <Input type="text" id="email" name="email" placeholder="Email Address" />
    <Input type="text" id="phone" name="phone" placeholder="Telephone Number" />
    <Tags bind:value={householdTags1} placeholder="Languages spoken" class="mt-5 mb-3" showHelper availableTags={languagesSpoken} unique/>

    <Tags bind:value={householdTags2} placeholder="Dietary restrictions" class="mt-5 mb-3" showHelper availableTags={dietaryOptions} unique/>
    <Textarea id="pets" class="w-full" name="pets" placeholder="Pets" />
    <Textarea id="notes" class="w-full" name="notes" placeholder="Notes" />
    <Textarea id="howHeard" class="w-full" name="howHeard" placeholder="How did you hear about us?" />






      {#if addressError}
        <Helper class="mt-2" color="red">{addressError}</Helper>
      {/if}
  </form>

  {#snippet footer()}
      <Button type="submit" form="new-household-form" disabled={saving} color="alternative" class="shrink-0 text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
      {saving ? 'Saving…' : 'Save'}
    </Button>
    <Button color="alternative" onclick={() => (open = false)} disabled={saving}>Cancel</Button>
  {/snippet}
</Modal>