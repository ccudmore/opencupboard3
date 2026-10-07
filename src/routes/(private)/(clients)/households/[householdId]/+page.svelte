<script lang="ts">
	import {superForm, type SuperFormErrors} from "sveltekit-superforms/client"
	import SuperDebug from "sveltekit-superforms/client/SuperDebug.svelte"
 	import { goto } from '$app/navigation';
	import { toast } from "svelte-sonner";
	
	import { Button, Input, ButtonGroup, Modal } from "flowbite-svelte";
	import { Breadcrumb, BreadcrumbItem } from "flowbite-svelte";
  	import { ExclamationCircleOutline, HomeOutline, ChevronDoubleRightOutline } from "flowbite-svelte-icons";
	import TabView from "$lib/components/Household/TabView.svelte";
	import Topper from "$lib/components/Household/Topper.svelte";
	import {formattedDate} from "$lib/utils"
  	import { slide } from "svelte/transition";

	let { data } = $props()
  	let openComfirmDeleteModal = $state(false);

	function handleSuccess() {
        toast('Updated successfully!');
    }

    function handleError() {
		const msg = JSON.stringify($errors.members)
        toast('Form submission failed and updated with errors! '+msg);
    }
	
	// superForm only needs the initial value; it manages its own state afterwards
	// svelte-ignore state_referenced_locally
	const {form, errors, enhance, constraints, tainted } = superForm(data.form,
	{
		taintedMessage: "Are you sure you want to leave? Your work will not be saved.",
        dataType: 'json',
  		applyAction: true, // don't reload the page after the update
  		invalidateAll: 'force',
  		resetForm: true,
		onSubmit() {
			    $form.members = $form.members.map((c) => ({
      ...c,
      fullName: `${c.firstName} ${c.lastName}`.trim()
    }));
			
		},
		onResult({ result }) {
            if (result.type === 'success') {
                handleSuccess();
            } else if (result.type === 'error' || result.type === 'failure') {
				handleError()
            }
        },
	})

	function close() {
		goto('/households');
	}

	function confirmDelete() {
		openComfirmDeleteModal=true
	}

	async function actionDelete({ action }: { action: string }) {

		if (action === 'yes') {
    		const res = await fetch('?/deleteHousehold', {
 		    	method: 'POST',
      			headers: { 'Content-Type': 'multipart/form-data' },
      			body: JSON.stringify({ id: data.household.id })
    		});
			toast("Household deleted") // craig - toast not working
			goto('/households');
		}		
	}
</script>

	<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
  		<BreadcrumbItem href="/" home>
   			{#snippet icon()}
    			<HomeOutline class="me-2 h-4 w-4" />
    		{/snippet}
			Home
  		</BreadcrumbItem>
  		<BreadcrumbItem href="/households">
    		{#snippet icon()}
      			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
   		 	{/snippet}
    		Household and Guests
  		</BreadcrumbItem>
  		<BreadcrumbItem>
    		{#snippet icon()}
      			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
    		{/snippet}
    		Edit
  		</BreadcrumbItem>
	</Breadcrumb>
	<Topper form={form} errors={errors} constraints={constraints}/>
	{#if tainted}
		You have unsaved changes.
	{/if}
	<form action="?/updateHousehold" method="POST" class="p-2" use:enhance>
		<Input type="hidden" id="id" name="id" value={data.household.id} />
		<!--SuperDebug data={$form}/-->
		<ButtonGroup class="*:ring-primary-700!">
			<Button outline color="dark" type="submit">Save</Button>
			<Button outline color="dark" onclick={confirmDelete}>Delete</Button>
			<Button outline color="dark" onclick={close}>Close</Button>
			<!--Button outline color="dark" onclick={dump}>Dump</Button-->
		</ButtonGroup>
		<TabView form={form} errors={errors} constraints={constraints}/>
	</form>

	Created by: {data.household.createdBy} on {formattedDate(data.household.createdAt)}

<Modal form bind:open={openComfirmDeleteModal} size="xs" transition={slide} permanent onaction={({ action }) => actionDelete({action})}>
  <div class="text-center">
    <ExclamationCircleOutline class="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-200" />
    <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">Are you sure you want to delete this household?</h3>
    <div class="space-x-2">
      <Button type="submit" value="yes" color="red"id="confirm-action" data-modal-hide="confirmation-modal">Yes, I'm sure</Button>
      <Button type="submit" value="no" color="alternative">No, cancel</Button>
    </div>
  </div>
</Modal>