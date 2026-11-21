<script lang="ts">
	import { Input, Select, } from "flowbite-svelte";
	import { ButtonGroup, Button, Helper, Label, Drawer, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Modal } from "flowbite-svelte";
  	import { CloseCircleOutline, CheckCircleOutline, } from "flowbite-svelte-icons";
	import { toast } from "svelte-sonner";
	import {formattedDate} from "#lib/utils.ts"
	import {nextIdVerificationDate,isIdVerificationNeeded} from "#lib/utils.ts"
  	import { ExclamationCircleOutline } from "flowbite-svelte-icons";
  	import { slide } from "svelte/transition";
	import { idTypeOptions, idTypeLabels, relationshipOptions, relationshipLabels } from '#lib/labels.ts'
	import IdScanner from './IdScanner.svelte';
	import { page } from '$app/state';
	import { birthYearOf, type LicenceInfo } from '#lib/idScan/aamva.ts';

	// for opening and closing the member detail drawer
	let openMemberRow: number | null | undefined = $state();
	let openMemberDrawer = $state(false);
  	let openComfirmDeleteModal = $state(false);

  	// Opens the drawer on row i, or closes it if it is already open on that row. It looks at whether the
  	// drawer is actually open, not just the row number, because closing with the X, Esc or a click outside
  	// leaves the row number behind, and the next click on the same row must open it again.
  	const toggleMemberDrawer = (i: number) => {
		const closing = openMemberDrawer && openMemberRow === i;
    	openMemberRow = closing ? null : i;
		openMemberDrawer = !closing
  	};

    // for opening and closing the id confirmation modal
	let idVerificationRow: number | null | undefined = $state();
	let idVerificationModal = $state(false);
	let idType = $state(''); // nothing is pre-selected: the person says which ID they were shown

	// scanning a licence from the member drawer fills in this member's name and birth year
	let drawerScanning = $state(false);
	let drawerOther = $state(false);
	$effect(() => {
		if (!openMemberDrawer) { drawerScanning = false; drawerOther = false; }
	});
	function onDrawerScan(found: LicenceInfo) {
		if (openMemberRow == null) return;
		const member = $form.members[openMemberRow];
		if (found.givenNames) member.firstName = found.givenNames;
		if (found.familyName) member.lastName = found.familyName;
		const year = birthYearOf(found);
		if (year) member.birthYear = year;
		member.idChecked = 'DRIVERS_LICENSE';
		member.idCheckDate = new Date();
		form.set($form); // the member was changed in place, so tell the form
		drawerScanning = false;
		drawerOther = false;
		toast('Filled in from the licence');
	}

    function toggleIdConfirmation(i: number, event: MouseEvent) {
    	idVerificationRow = openMemberRow === i ? null : i;
		idType = '';
		idVerificationModal=true
		event.stopPropagation()

		return false
  	};

	function toastMemberErrors(errors: { [s: string]: unknown; } | ArrayLike<unknown>) {
  		const rows = Object.keys(errors).map((i) => Number(i) + 1);
		const first = Object.values(errors)[0];
		const firstFieldErrors = first && typeof first === "object"
			? Object.values(first as Record<string, unknown>)[0]
			: undefined;
		const message = Array.isArray(firstFieldErrors) && typeof firstFieldErrors[0] === "string"
			? firstFieldErrors[0]
			: "Validation failed";

  		toast(`${rows.length} rows failed: ${message} (rows ${rows.join(", ")})`);
	}
	
	function updateId({ action, data }: { action: string; data: FormData }) {
	    if (action === "confirm" && idType && idVerificationRow != null) {
			const member = $form.members[idVerificationRow]
			member.idChecked = idType
			member.idCheckDate = new Date()
			form.set($form) // the member was changed in place, so tell the form (this turns the ID status green)
			toast("Id updated")
		}
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

	async function validateMemberUpdate(openMemberRow: number) {
    	const result = await validateForm({ update: true });
    	if (result.valid) {
			toggleMemberDrawer(openMemberRow)
    	} else {
			toastMemberErrors(result.errors.members)
		}
	}

	// the member just added with "New Member", until it has been filled in
	let newMemberRow: number | null = null;

	function addHouseholdMember() {
		$form.members.push({firstName: '', lastName: '',});
		newMemberRow = $form.members.length-1
		toggleMemberDrawer($form.members.length-1)
		form.set($form) // trigger reactivation
	}

	// Closing the drawer (the X, Esc, or clicking outside it) on a new member that is still blank
	// throws that member away, so cancelling does not leave an empty row behind.
	$effect(() => {
		if (openMemberDrawer || newMemberRow == null) return;
		const row = newMemberRow;
		newMemberRow = null;
		const m = $form.members[row];
		if (m && !m.firstName?.trim() && !m.lastName?.trim() && !m.phone && !m.email) {
			$form.members.splice(row, 1);
			form.set($form);
		}
	});
    let { form, errors, constraints, validateForm} = $props()

</script>

<!-- ID status and the Confirm ID button, shared by the table and the phone cards -->
{#snippet idStatus(i: number)}
	{#if isIdVerificationNeeded($form.members[i].idCheckDate)}
		<span class="inline-flex items-center gap-2 font-bold">
			<CloseCircleOutline class="text-red-500" />
			<Button size="sm" outline color="dark" onclick={(e: MouseEvent) => toggleIdConfirmation(i, e)}>Confirm ID</Button>
		</span>
	{:else}
		<span class="inline-flex items-center gap-2 font-bold">
			<CheckCircleOutline class="text-green-500" />
			<Button size="sm" outline color="dark" onclick={(e: MouseEvent) => toggleIdConfirmation(i, e)}>Confirm ID</Button>
		</span>
		<div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
			Next check: {nextIdVerificationDate($form.members[i].idCheckDate)}
		</div>
	{/if}
{/snippet}

<!-- Heading and action, shared by both layouts -->
<div class="flex flex-wrap items-center justify-between gap-2 bg-white px-5 pb-3 pt-3 dark:bg-gray-800">
	<h2>Household Members</h2>
	<Button outline color="dark" onclick={addHouseholdMember}>
		New  Member
	</Button>
</div>

{#if $form.members.length === 0}
	<p class="px-5 pb-5 text-gray-500 dark:text-gray-400">No household members yet.</p>
{:else}
	<!-- Tablet and desktop: table -->
	<div class="hidden md:block">
		<Table striped={true}>
			<TableHead>
				<TableHeadCell>First Name</TableHeadCell>
				<TableHeadCell>Last Name</TableHeadCell>
				<TableHeadCell>Relationship</TableHeadCell>
				<TableHeadCell>Id Status</TableHeadCell>
			</TableHead>
			<TableBody>
				{#each $form.members as _, i}
					<TableBodyRow onclick={() => toggleMemberDrawer(i)}>
						<TableBodyCell>
							{$form.members[i].firstName}
						</TableBodyCell>
						<TableBodyCell>
							{$form.members[i].lastName}
						</TableBodyCell>
						<TableBodyCell>
							{relationshipLabels[$form.members[i].relationship as keyof typeof relationshipLabels]}
						</TableBodyCell>
						<TableBodyCell>
							{@render idStatus(i)}
						</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	</div>

	<!-- Phones: one card per member -->
	<ul class="space-y-3 px-3 pb-4 md:hidden">
		{#each $form.members as _, i}
			<li class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
				<button type="button" class="w-full text-left" onclick={() => toggleMemberDrawer(i)}>
					<div class="font-semibold text-gray-900 dark:text-white">
						{$form.members[i].firstName} {$form.members[i].lastName}
					</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">
						{relationshipLabels[$form.members[i].relationship as keyof typeof relationshipLabels]}
					</div>
				</button>
				<div class="mt-3">
					{@render idStatus(i)}
				</div>
			</li>
		{/each}
	</ul>
{/if}

<Modal title="Identification Check" form size="md" bind:open={idVerificationModal} onaction={({ action,data }) => updateId({action,data})}>
	<Label for="idtype" class="mb-1">ID type presented</Label>
	<Select id="idtype" class="mb-2" items={idTypeOptions} name="idtype" placeholder="Select the ID type" required bind:value={idType} />
	{#snippet footer()}
    	<Button outline type="submit" value="confirm" color="dark">Confirm</Button>
    	<Button outline type="submit" value="cancel" color="dark" formnovalidate>Cancel</Button>
  	{/snippet}
</Modal>

<Drawer placement="bottom" bind:open={openMemberDrawer} class="max-h-[85vh] overflow-y-auto backdrop:bg-black/50 bg-white p-1 text-gray-900 dark:bg-gray-800 dark:text-white">
	<div class="mb-2 px-4 text-lg font-semibold text-gray-900 sm:pl-10 dark:text-white">Household Member</div>
		{#if openMemberRow != null}
	  		<div class="mt-0.5 mb-0.5 grid grid-cols-1 gap-4 px-4 pt-5 sm:grid-cols-2 sm:pl-10 lg:grid-cols-3">
			<div>
				<Label for="firstName">First Name</Label>
				<Input type="text" id="firstName" name="firstName" autocomplete="off" bind:value={$form.members[openMemberRow].firstName} {...$constraints.members?.firstName} />
				{#if $errors.members?.[openMemberRow]?.firstName}
					<Helper class="field-error">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.firstName}</span>
					</Helper>
				{/if}
			</div>
			<div>
   				<Label for="lastName">Last Name</Label>
				<Input type="text" id="lastName" name="lastName" autocomplete="off" bind:value={$form.members[openMemberRow].lastName} {...$constraints.members?.lastName} />
				{#if $errors.members?.[openMemberRow]?.lastName}
					<Helper class="field-error">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.lastName}</span>
					</Helper>
				{/if}
			</div>
			<div>
   				<Label for="relationship">Relationship</Label>
				<Select class="mb-2" items={relationshipOptions} bind:value={$form.members[openMemberRow].relationship} {...$constraints.members?.relationship} required/>
			</div>
			<div>
   				<Label for="phone">Phone Number</Label>
				<Input type="tel" inputmode="tel" autocomplete="off" id="phone" name="phone" bind:value={$form.members[openMemberRow].phone} {...$constraints.members?.phone} />
				{#if $errors.members?.[openMemberRow]?.phone}
					<Helper class="field-error">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.phone}</span>
					</Helper>
				{/if}
			</div>
			<div>
   				<Label for="email">Email Address</Label>
				<Input type="text" inputmode="email" autocomplete="off" id="email" name="email" bind:value={$form.members[openMemberRow].email} {...$constraints.members?.email} />
				{#if $errors.members?.[openMemberRow]?.email}
					<Helper class="field-error">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.email}</span>
					</Helper>
				{/if}
			</div>
			<div>
   				<Label for="birthYear">Birth Year</Label>
				<Input type="number" inputmode="numeric" id="birthYear" name="birthYear" bind:value={$form.members[openMemberRow].birthYear} {...$constraints.members?.birthYear} />
				{#if $errors.members?.[openMemberRow]?.birthYear}
					<Helper class="field-error">
						<span class="font-medium">{$errors.members?.[openMemberRow]?.birthYear}</span>
					</Helper>
				{/if}
			</div>
		</div>

		<div class="mt-4 space-y-2 px-4 sm:pl-10">
			{#if drawerScanning}
				<IdScanner onscan={onDrawerScan} onother={() => (drawerOther = true)} />
				<Button type="button" outline color="dark" onclick={() => (drawerScanning = false)}>Stop scanning</Button>
			{:else}
				<Button type="button" outline color="blue" onclick={() => { drawerOther = false; drawerScanning = true; }}>Scan driver’s licence to fill in name and birth year</Button>
			{/if}
			{#if drawerOther}<p class="text-sm text-yellow-700 dark:text-yellow-400">That barcode isn't a driver's licence or provincial ID, so nothing was filled in.</p>{/if}
			<p class="hint">Scanning also records the ID as checked today. The card is not saved.</p>
		</div>

		<div class="mt-0 px-4 pb-5 pt-5 sm:pl-10">
			{#if $form.members[openMemberRow].idChecked}
				<p class="text-gray-500 dark:text-gray-400">
					ID type {idTypeLabels[$form.members[openMemberRow].idChecked as keyof typeof idTypeLabels] ?? $form.members[openMemberRow].idChecked} checked on {formattedDate($form.members?.[openMemberRow]?.idCheckDate)}
				</p>
			{:else}
				<p class="text-red-600 dark:text-red-500">No ID Provided</p>
			{/if}
		</div>

		<p class="px-4 text-sm text-gray-500 sm:pl-10 dark:text-gray-400">
			Added on {formattedDate($form.members[openMemberRow].createdAt)} by {page.data.userNames?.[$form.members[openMemberRow].createdBy ?? ''] ?? $form.members[openMemberRow].createdBy}
		</p>

		<div class="mt-0 px-4 pb-10 sm:pl-10">
			<ButtonGroup class="*:ring-primary-700!">
				<Button outline onclick={() => validateMemberUpdate(openMemberRow||0)}>Update</Button>
				<Button outline onclick={confirmDelete}>Delete</Button>
			</ButtonGroup>
		</div>
	{/if}
</Drawer>

<Modal form bind:open={openComfirmDeleteModal} size="xs" transition={slide} permanent onaction={({ action }) => actionDelete({action})}>
  <div class="text-center">
    <ExclamationCircleOutline class="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-200" />
    <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">Are you sure you want to delete this household member?</h3>
    <div class="space-x-2">
		<ButtonGroup class="*:ring-primary-700!">
    		<Button type="submit" value="yes" color="red" id="confirm-action" data-modal-hide="confirmation-modal">Yes, I'm sure</Button>
    		<Button outline type="submit" value="no" color="dark">No, cancel</Button>
		</ButtonGroup>
    </div>
  </div>
</Modal>