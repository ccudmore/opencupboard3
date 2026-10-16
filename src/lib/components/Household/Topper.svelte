<script lang="ts">
	import { CloseCircleOutline, CheckCircleOutline } from "flowbite-svelte-icons";
	import { Select, Label } from "flowbite-svelte";
	import { isIdVerificationNeeded, calculateFamilySize, calculateChildCount } from "$lib/utils";

	let { form, errors, constraints } = $props();

	const householdStatuses = [
		{ value: "Active", name: "Active" },
		{ value: "Inactive", name: "Inactive" },
		{ value: "Archived", name: "Archived" },
	];

	const primaryMembers = $derived(
		($form.members ?? []).filter((m: { relationship: string }) => m.relationship === "Primary")
	);

	const idNeeded = $derived(
		$form?.members?.some((item: { idCheckDate: Date | null | undefined }) =>
			isIdVerificationNeeded(item?.idCheckDate)
		)
	);

	// Show the first few primary members; the rest sit behind a "+N more" toggle
	const MEMBER_LIMIT = 2;
	let showAllMembers = $state(false);
	const visibleMembers = $derived(
		showAllMembers ? primaryMembers : primaryMembers.slice(0, MEMBER_LIMIT)
	);
</script>

<div class="flex flex-col gap-3 p-3 md:flex-row md:items-start md:justify-between md:gap-6 md:p-2">
	<!-- Left: people, id status, household status -->
	<div class="min-w-0 flex-1 space-y-3">
		{#if primaryMembers.length > 0}
			<div>
				<div class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
					{primaryMembers.length > 1 ? "Primary Members" : "Primary Member"}
				</div>
				<div class="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-x-8 gap-y-2">
					{#each visibleMembers as member}
						<div class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
							<div class="text-lg font-bold text-gray-900 dark:text-white">
								{member.firstName} {member.lastName}
							</div>
							<div class="flex min-w-0 flex-col text-sm leading-tight text-gray-600 dark:text-gray-300">
								<span class="break-all">{member.email}</span>
								<span>{member.phone}</span>
							</div>
						</div>
					{/each}
				</div>
				{#if primaryMembers.length > MEMBER_LIMIT}
					<button
						type="button"
						class="mt-1 text-sm text-blue-700 hover:underline dark:text-blue-400"
						onclick={() => (showAllMembers = !showAllMembers)}
					>
						{showAllMembers ? "Show fewer" : `+${primaryMembers.length - MEMBER_LIMIT} more`}
					</button>
				{/if}
			</div>
		{/if}

		<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
			{#if idNeeded}
				<span
					class="inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-1.5 font-bold text-red-800
					       dark:bg-red-900/40 dark:text-red-300"
				>
					<CloseCircleOutline class="h-5 w-5" />
					Id validation needed
				</span>
			{:else}
				<span
					class="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-1.5 font-bold text-green-800
					       dark:bg-green-900/40 dark:text-green-300"
				>
					<CheckCircleOutline class="h-5 w-5" />
					All Ids up to date
				</span>
			{/if}

			<div class="flex items-center gap-2">
				<Label for="status" class="shrink-0 text-base font-bold">Status</Label>
				<Select id="status" size="sm" class="w-40" items={householdStatuses} bind:value={$form.status} />
			</div>
		</div>
	</div>

	<!-- Right: household summary -->
	<dl
		class="grid w-full shrink-0 grid-cols-[auto_auto] gap-x-6 gap-y-0.5 rounded-lg border border-blue-300 bg-blue-100 p-3
		       text-sm font-bold text-blue-900 md:w-auto
		       dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-100"
	>
		<dt>Unique ID:</dt>
		<dd>{$form.uniqueId}</dd>

		<dt>Can book next appointment on:</dt>
		<dd>Soon (WIP)</dd>

		<dt>Family Size:</dt>
		<dd>{calculateFamilySize($form.members)}</dd>

		<dt>Number of children &lt; 13:</dt>
		<dd>{calculateChildCount($form.members)}</dd>
	</dl>
</div>