<script lang="ts">
  	import { CloseCircleOutline, CheckCircleOutline, HomeOutline, ChevronDoubleRightOutline } from "flowbite-svelte-icons";
	import { Select, Label, } from "flowbite-svelte";

    let { form, errors, constraints} = $props()
	import {isIdVerificationNeeded, calculateFamilySize, calculateChildCount} from "$lib/utils"

	const householdStatuses = [
    	{ value: "Active", name: "Active" },
    	{ value: "Inactive", name: "Inactive" },
    	{ value: "Archived", name: "Archived" },
  	];

</script>	    

<div>
	{#each $form.members as member}
		{#if member.relationship === 'Primary'}
			<span class="font-bold text-xl">{member.firstName} {member.lastName}</span>
			<span class="text-sm">{member.email} {member.phone}</span>
			<br>
		{/if}
	{/each}
<!--<div class="grid w-100 auto-cols-max grid-flow-col justify-left items-left bg-blue-200 border-2 font-bold p-1 grid-cols-2">-->
<div class="grid  grid-cols-2 gap-1 w-150 bg-blue-200 border font-bold">
  <div>Unique ID:</div>
  <div> {$form.uniqueId}</div>
  <div>Can book next appointment on:</div>
  <div>Soon (WIP)</div>
  <div>Family Size:</div>
  <div>{calculateFamilySize($form.members)}</div>
  <div>Number of children &lt; 13: </div>
  <div>{calculateChildCount($form.members)}</div>
</div>
	
	<span class="font-bold inline-flex items-center gap-2">
		{#if $form?.members?.some((item: { idCheckDate: Date | null | undefined; } ) => isIdVerificationNeeded(item?.idCheckDate))}
			<CloseCircleOutline class="text-red-500 align-middle"/>
			Id validation needed
		{:else}
			<CheckCircleOutline class="text-green-500" />
			All Ids up to date
		{/if}	
	</span>

	<span>
<Label for="status" class="mb-2 font-bold">Status</Label>
<Select underline class="mb-2" items={householdStatuses} bind:value={$form.status} />
</span>
	<br>
</div>