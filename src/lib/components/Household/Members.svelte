<script lang="ts">
	import { Input, Select, } from "flowbite-svelte";
	import { ButtonGroup, Button, Helper, Label, Drawer, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Modal } from "flowbite-svelte";
  	import { CloseCircleOutline, CheckCircleOutline, } from "flowbite-svelte-icons";
	import { toast } from "svelte-sonner";
	import {formattedDate} from "$lib/utils"
	import {nextIdVerificationDate,isIdVerificationNeeded} from "$lib/utils"
  	import { ExclamationCircleOutline } from "flowbite-svelte-icons";
  	import { slide } from "svelte/transition";

	// for opening and closing the member detail drawer
	let openMemberRow: number | null | undefined = $state();
	let openMemberDrawer = $state(false);
  	let openComfirmDeleteModal = $state(false);

  	const toggleMemberDrawer = (i: number) => {
    	openMemberRow = openMemberRow === i ? null : i;
		openMemberDrawer = (openMemberRow != null)
  	};

    // for opening and closing the id confirmation modal
	let idVerificationRow: number | null | undefined = $state();
	let idVerificationModal = $state(false);

    function toggleIdConfirmation(i: number, event: MouseEvent) {
    	idVerificationRow = openMemberRow === i ? null : i;
		idVerificationModal=true
		event.stopPropagation()

		return false
  	};

	
    const validIdTypes = [
    	{ value: "Drivers License", name: "Drivers License" },
    	{ value: "ID Card", name: "ID Card" },
    	{ value: "Bill", name: "Bill" },
    	{ value: "Other", name: "Other" },
	]

	const validRelationships = [
    	{ value: "Primary", name: "Primary" },
    	{ value: "Parent", name: "Parent" },
    	{ value: "Child", name: "Child" },
    	{ value: "Grandparent", name: "Grandparent" },
    	{ value: "Sibling", name: "Sibling" },
    	{ value: "other", name: "Other" },
	]

    function updateId({ action, data }: { action: string; data: FormData }) {
		const idType = (data.get("idtype") as string)

	    if (action === "confirm" && idType && idVerificationRow != null) {
			$form.members[idVerificationRow].idChecked = idType
			$form.members[idVerificationRow].idCheckDate = new Date()
		}
		toast("Id updated")
		return true;
	}

	function confirmDelete() {
		openComfirmDeleteModal=true
	}

	function actionDelete({ action }: { action: string }) {
		if (action === "yes" && openMemberRow != null) {
			$form.members.splice(openMemberRow,1)
			form.set($form) // trigger reactivation
		}
		toggleMemberDrawer(openMemberRow||0)
	}

	/*
	function deleteHouseholdMember() {
		const result = confirm("Confirm deleting husehold member?")
		if (result && openMemberRow != null) {
			$form.members.splice(openMemberRow,1)
			form.set($form) // trigger reactivation
		}
		toggleMemberDrawer(openMemberRow||0)
	}
*/
	function addHouseholdMember() {
		$form.members.push({firstName: '', lastName: '', fullName: ''});
		toggleMemberDrawer($form.members.length-1)
		form.set($form) // trigger reactivation
	}
    	let { form, errors, constraints} = $props()

</script>

<Table striped={true}>
  	<caption class="bg-white p-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white">
		Household Members
  	</caption>
	<TableHead>
    	<TableHeadCell>First Name</TableHeadCell>
    	<TableHeadCell>Last Name</TableHeadCell>
		<TableHeadCell>Relationship</TableHeadCell>
		<TableHeadCell>Id Status</TableHeadCell>
  	</TableHead>
  	<TableBody>
    	{#each $form.members as item, i}
      		<TableBodyRow onclick={() => toggleMemberDrawer(i)}>	
				<TableBodyCell>
					{$form.members[i].firstName}
				</TableBodyCell>
        		<TableBodyCell>
					{$form.members[i].lastName}
				</TableBodyCell>
        		<TableBodyCell>
					{$form.members[i].relationship}
				</TableBodyCell>
        		<TableBodyCell>
					{#if isIdVerificationNeeded($form.members[i].idCheckDate)}
						<span class="font-bold inline-flex items-center gap-2">
							<CloseCircleOutline class="text-red-500"/>
							<Button class="h-2" outline color="dark" onclick={(e: MouseEvent) => toggleIdConfirmation(i,  e)}>Confirm ID</Button>
						</span>
					{:else}
						<span class="font-bold inline-flex items-center gap-2">
							<CheckCircleOutline class="text-green-500"/>
							<Button class="h-2" outline color="dark" onclick={(e: MouseEvent) => toggleIdConfirmation(i, e)}>Confirm ID</Button>
						</span><br>
						Next check: {nextIdVerificationDate($form.members[i].idCheckDate)}
					{/if}
				</TableBodyCell>
			</TableBodyRow>
    	{/each}
	</TableBody>
</Table>
<Button outline color="dark" onclick={addHouseholdMember}>New Household Member</Button><br>

<Modal title="Identification Check" form size="xs" bind:open={idVerificationModal} onaction={({ action,data }) => updateId({action,data})}>
	ID type presented<Select class="mb-2" items={validIdTypes} name="idtype"/>
	{#snippet footer()}
    	<Button type="submit" value="confirm" color="dark">Confirm</Button>
    	<Button type="submit" value="cancel" color="alternative">Cancel</Button>
  	{/snippet}
</Modal>

<Drawer placement="bottom" bind:open={openMemberDrawer} class="backdrop:bg-black/50 bg-gray-50 p-1 dark:bg-gray-800">	
	<div class="mb-2 text-lg font-semibold">Household Member</div>
	{#if openMemberRow != null}
  		<div class="mt-0.5 gap-4 pl-10 pt-5 grid mb-0.5 grid-cols-3">
			<div>
				<Label for="firstName" class="mb-2">First Name</Label>
				<Input type="text" id="firstName" name="firstName" bind:value={$form.members[openMemberRow].firstName} {...$constraints.members?.firstName} />
				{#if $errors.members?.[openMemberRow]?.firstName}
					<Helper class="mt-2 text-red-500">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.firstName}</span>
					</Helper>
				{/if}
			</div>
			<div>
   				<Label for="lastName" class="mb-2">Last Name</Label>
				<Input type="text" id="lastName" name="lastName" bind:value={$form.members[openMemberRow].lastName} {...$constraints.members?.lastName} />
				{#if $errors.members?.[openMemberRow]?.lastName}
					<Helper class="mt-2 text-red-500">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.lastName}</span>
					</Helper>
				{/if}
			</div>
			<div>
   				<Label for="relationship" class="mb-2">Relationship</Label>
				<Select class="mb-2" items={validRelationships} bind:value={$form.members[openMemberRow].relationship} {...$constraints.members?.relationship} required/>
			</div>
			<div>
   				<Label for="phone" class="mb-2">Phone Number</Label>
				<Input type="text" id="phone" name="phone" bind:value={$form.members[openMemberRow].phone} {...$constraints.members?.phone} />
				{#if $errors.members?.[openMemberRow]?.phone}
					<Helper class="mt-2 text-red-500">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.phone}</span>
					</Helper>
				{/if}
			</div>
			<div>
   				<Label for="email" class="mb-2">Email Address</Label>
				<Input type="text" id="email" name="email" bind:value={$form.members[openMemberRow].email} {...$constraints.members?.email} />
				{#if $errors.members?.[openMemberRow]?.email}
					<Helper class="mt-2 text-red-500">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.email}</span>
					</Helper>
				{/if}
			</div>
			<div>
   				<Label for="birthYear" class="mb-2">Birth Year</Label>
				<Input type="number" id="birthYear" name="birthYear" bind:value={$form.members[openMemberRow].birthYear} {...$constraints.members?.birthYear} />
				{#if $errors.members?.[openMemberRow]?.birthYear}
					<Helper class="mt-2 text-red-500">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.birthYear}</span>
					</Helper>
				{/if}
			</div>
		</div>

	  	<div class="mt-0 pl-10 pb-5 pt-5">
			{#if $form.members[openMemberRow].idChecked}
				<p>ID type {$form.members[openMemberRow].idChecked} checked on {formattedDate($form.members?.[openMemberRow]?.idCheckDate)}</p>
			{:else}
				<p class="text-red-500">No ID Provided</p>
			{/if}
		</div>
		Added on {formattedDate($form.members[openMemberRow].createdAt)} by { $form.members[openMemberRow].createdBy}
	  	<div class="mt-0 pl-10 pb-10">
			<ButtonGroup class="*:ring-primary-700!">
				<Button outline color="dark" onclick={() => toggleMemberDrawer(openMemberRow||0)}>Update</Button>
				<Button outline color="dark" onclick={confirmDelete}>Delete</Button>
			</ButtonGroup>
		</div>
	{/if}
</Drawer>

<Modal form bind:open={openComfirmDeleteModal} size="xs" transition={slide} permanent onaction={({ action }) => actionDelete({action})}>
  <div class="text-center">
    <ExclamationCircleOutline class="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-200" />
    <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">Are you sure you want to delete this household member?</h3>
    <div class="space-x-2">
      <Button type="submit" value="yes" color="red"id="confirm-action" data-modal-hide="confirmation-modal">Yes, I'm sure</Button>
      <Button type="submit" value="no" color="alternative">No, cancel</Button>
    </div>
  </div>
</Modal>