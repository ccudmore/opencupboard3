<script lang="ts">
	
	import { Select, } from "flowbite-svelte";
	import { Modal, ButtonGroup, Textarea, Checkbox, Button, Label, Drawer, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, } from "flowbite-svelte";
	import {formattedDate} from "$lib/utils"
	import { ExclamationCircleOutline } from "flowbite-svelte-icons";
  	import { slide } from "svelte/transition";

  	let openComfirmDeleteModal = $state(false);

	const specialRequestStatuses = [
    	{ value: "Active", name: "Active" },
    	{ value: "Closed", name: "Closed" },
  	];

	function actionDelete({ action }: { action: string }) {
		if (action === "yes" && openSpecialRequestRow != null) {
			$form.datedRequests.splice(openSpecialRequestRow,1)
			form.set($form) // trigger reactivation
		}
		toggleSpecialRequestDrawer(openSpecialRequestRow||0)
	}

	function addSpecialRequest() {
		$form.datedRequests.push({type: 'Prayer', requestText: '', status: 'Active', createdAt: new Date(), });
		toggleSpecialRequestDrawer($form.datedRequests.length-1)
		form.set($form) // trigger reactivation
	}
		// for opening and closing the special request detail drawer
	let openSpecialRequestRow: number | null | undefined = $state();
	let openSpecialRequestDrawer = $state(false);

  	const toggleSpecialRequestDrawer = (i: number) => {
    	openSpecialRequestRow = openSpecialRequestRow === i ? null : i;
		openSpecialRequestDrawer = (openSpecialRequestRow != null)
  	};
	
	let hideClosedDatedRequests = $state(false)

	function confirmDelete() {
		openComfirmDeleteModal=true
	}
	/*
	function deleteSpecialRequest() {
		const result = confirm("Confirm deleting "+title+"?")
		if (result && openSpecialRequestRow != null) {
			$form.datedRequests.splice(openSpecialRequestRow,1)
			form.set($form) // trigger reactivation
		}
		toggleSpecialRequestDrawer(openSpecialRequestRow||0)
	}

*/

	let { form, errors, constraints, title} = $props()
</script>
<Label for="specialRequests" class="mb-2 text-lg font-semibold">{title}</Label>
<Table striped={true}>
	<TableHead>
    	<TableHeadCell>Date</TableHeadCell>
    	<TableHeadCell>Text</TableHeadCell>
		<TableHeadCell>Status</TableHeadCell>
  	</TableHead>
	<TableBody>
    	{#each $form.datedRequests as item, i}
			{#if item.type === 'Prayer' && (item.status === 'Active' || (hideClosedDatedRequests == false && item.status === 'Closed')) }
      			<TableBodyRow onclick={() => toggleSpecialRequestDrawer(i)}>	
					<TableBodyCell>
						{formattedDate($form.datedRequests[i].createdAt)}
					</TableBodyCell>
    	    		<TableBodyCell>
						{$form.datedRequests[i].requestText.substring(0,20)}
					</TableBodyCell>
        			<TableBodyCell>
						{$form.datedRequests[i].status}
					</TableBodyCell>
				</TableBodyRow>
			{/if}
    	{/each}
	</TableBody>
</Table>
<Checkbox bind:checked={hideClosedDatedRequests}>Hide closed</Checkbox>
<Button outline color="dark" onclick={addSpecialRequest}>New {title}</Button><br>

<Drawer placement="bottom" bind:open={openSpecialRequestDrawer} class="backdrop:bg-black/50 bg-gray-50 p-1 dark:bg-gray-800">	
	<div class="mb-2 text-lg font-semibold">{title}</div>
    {#if openSpecialRequestRow != null}
  		<div class="mt-0.5 gap-4 pl-10 pt-5 mb-0.5">
			<div>
   				<Label for="text" class="mb-2">Text</Label>
				<Textarea id="text" class="w-full" bind:value={$form.datedRequests[openSpecialRequestRow].requestText} {...$constraints.datedRequests?.requestText} />
			</div>
			<div>
   				<Label for="status" class="mb-2">Status</Label>
				<Select class="mb-2 w-1/4" items={specialRequestStatuses} bind:value={$form.datedRequests[openSpecialRequestRow].status} />
			</div>
			<div>
				Added {formattedDate($form.datedRequests[openSpecialRequestRow].createdAt)} by { $form.datedRequests[openSpecialRequestRow].createdBy}
			</div>
		</div>

	  	<div class="mt-0 pl-10 pb-10">
			<ButtonGroup class="*:ring-primary-700!">
				<Button outline color="dark" onclick={() => toggleSpecialRequestDrawer(openSpecialRequestRow||0)}>Update</Button>
				<Button outline color="dark" onclick={confirmDelete}>Delete</Button>
			</ButtonGroup>
		</div>
	{/if}
</Drawer>

<Modal form bind:open={openComfirmDeleteModal} size="xs" transition={slide} permanent onaction={({ action }) => actionDelete({action})}>
  <div class="text-center">
    <ExclamationCircleOutline class="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-200" />
    <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">Are you sure you want to delete this {title}?</h3>
    <div class="space-x-2">
      <Button type="submit" value="yes" color="red"id="confirm-action" data-modal-hide="confirmation-modal">Yes, I'm sure</Button>
      <Button type="submit" value="no" color="alternative">No, cancel</Button>
    </div>
  </div>
</Modal>