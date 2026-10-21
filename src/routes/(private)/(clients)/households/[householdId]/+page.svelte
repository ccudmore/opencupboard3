<script lang="ts">
	import {superForm, type SuperFormErrors} from "sveltekit-superforms/client"
	import SuperDebug from "sveltekit-superforms/client/SuperDebug.svelte"
 	import { goto } from '$app/navigation';
	import { toast } from "svelte-sonner";

	import { Button, Input, ButtonGroup, Modal, Dropdown, DropdownItem, Breadcrumb, BreadcrumbItem} from "flowbite-svelte";
	import { ExclamationCircleOutline, HomeOutline, ChevronDoubleRightOutline, DotsVerticalOutline } from "flowbite-svelte-icons";	import TabView from "$lib/components/Household/TabView.svelte";
	import Topper from "$lib/components/Household/Topper.svelte";
	import {formattedDate} from "$lib/utils"
  	import { slide } from "svelte/transition";
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { householdSchema } from '$lib/formschemas/household';

	let { data } = $props()
	
  	let openComfirmDeleteModal = $state(false);

	function handleSuccess() {
        toast('Updated successfully!');
    }

type FieldErrors = Record<string, string[]>;

type FormErrors = {
  members?: Record<string, FieldErrors>;
  _errors?: string[];
  [field: string]: unknown;
};

function toastFormErrors(errors: FormErrors) {
  const { members, _errors, ...topLevel } = errors;

  // Form-level errors
  for (const message of _errors ?? []) {
    toast('Error saving information'+ message);
  }

  // Top-level field errors, e.g. street2
  for (const [field, messages] of Object.entries(topLevel)) {
    if (Array.isArray(messages)) {
      toast(`${field}: ${messages.join(", ")}`);
    }
  }

  // Per-member errors, grouped into one toast per distinct message
  if (members) {
    const byMessage = new Map<string, number[]>();

    for (const [index, fields] of Object.entries(members)) {
      for (const [field, messages] of Object.entries(fields)) {
        for (const message of messages) {
          const key = `${field}: ${message}`;
          const rows = byMessage.get(key) ?? [];
          rows.push(Number(index) + 1);
          byMessage.set(key, rows);
        }
      }
    }

    for (const [key, rows] of byMessage) {
      toast(`${key} (${rows.length} members: rows ${rows.join(", ")})`);
    }
  }
}

    function handleError() {
		toastFormErrors($errors)
    }
	
	// superForm only needs the initial value; it manages its own state afterwards
	// svelte-ignore state_referenced_locally
	const {form, errors, enhance, constraints, tainted, isTainted, validateForm } = superForm(data.form,
	{
		taintedMessage: "Are you sure you want to leave? Your work will not be saved.",
        dataType: 'json',
  		applyAction: true, // don't reload the page after the update
  		invalidateAll: 'force',
  		resetForm: true,
		validators: zod4(householdSchema),
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

		if (action === 'yes') { // craig - can this be done a an action?
    		const res = await fetch('?/deleteHousehold', {
 		    	method: 'POST',
      			headers: { 'Content-Type': 'multipart/form-data' },
      			body: JSON.stringify({ id: $form.id })
    		});
			toast("Household deleted") // craig - toast not working
			goto('/households');
		}		
	}
</script>

<form action="?/updateHousehold" method="POST" use:enhance>
	<Input type="hidden" id="id" name="id" value={$form.id} />
	<!--SuperDebug data={$form}/-->

	<!-- Breadcrumb and actions share one row -->
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-gray-50 px-5 py-2 dark:bg-gray-900">
		<Breadcrumb>
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

		<div class="flex flex-wrap items-center gap-3">
			{#if isTainted($tainted)}
				<span
					role="status"
					class="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900
					       dark:bg-amber-900/50 dark:text-amber-100"
				>
					<ExclamationCircleOutline class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
					Unsaved changes
				</span>
			{/if}

			<ButtonGroup class="*:ring-primary-700!">
				<Button outline size="lg" type="submit" class="px-6 font-semibold">Save</Button>
				<Button outline size="lg" onclick={close} class="px-6 font-semibold">Close</Button>
				<Button outline size="lg" id="more-actions" aria-label="More actions" class="px-3">
					<DotsVerticalOutline class="h-6 w-6" />
				</Button>
			</ButtonGroup>
			<Dropdown triggeredBy="#more-actions">
				<DropdownItem type="button" class="font-semibold text-red-600 dark:text-red-400" onclick={confirmDelete}>
					Delete household…
				</DropdownItem>
			</Dropdown>
		</div>
	</div>

	<div class="p-0">
		<Topper {form} {errors} {constraints} {enhance} bookings={data.bookings} />
		<TabView {form} {errors} {constraints} {enhance} {validateForm} bookings={data.bookings}/>
	</div>
</form>

Created by: {$form.createdBy} on {formattedDate($form.createdAt)}

<Modal form bind:open={openComfirmDeleteModal} size="xs" transition={slide} permanent onaction={({ action }) => actionDelete({action})}>
  <div class="text-center">
    <ExclamationCircleOutline class="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-200" />
    <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">Are you sure you want to delete this household?</h3>
    <div class="space-x-2">
      <Button type="submit" value="yes" color="red"id="confirm-action" data-modal-hide="confirmation-modal">Yes, I'm sure</Button>
      <Button outline type="submit" value="no" color="dark">No, cancel</Button>
    </div>
  </div>
</Modal>