<script lang="ts">
	import { CloseCircleOutline, CheckCircleOutline } from "flowbite-svelte-icons";
	import { Select, Label } from "flowbite-svelte";
	import { isIdVerificationNeeded, formattedDate, calculateFamilySize, calculateChildCount, calculateNextServiceDate } from "$lib/utils"; // craig - fix thie import of servicedate2
	import {householdStatusOptions} from '$lib/labels'
	import { ClientRelationship } from '$prisma/enums';

	let { form, errors, constraints, bookings, enhance } = $props();

	const primaryMembers = $derived(
//		($form.members ?? []).filter((m: { relationship: string }) => m.relationship === "Primary")
		($form.members ?? []).filter((m: { relationship: ClientRelationship }) => m.relationship === ClientRelationship.PRIMARY)
	);

	const idNeeded = $derived(
		$form?.members?.some((item: { idCheckDate: Date | null | undefined }) =>
			isIdVerificationNeeded(item?.idCheckDate)
		)
	);

	const familySize = $derived(calculateFamilySize($form.members));
	const childCount = $derived(calculateChildCount($form.members));
	const nextServiceDate = $derived(calculateNextServiceDate(bookings));

	// Show the first few primary members; the rest sit behind a "+N more" toggle
	const MEMBER_LIMIT = 2;
	let showAllMembers = $state(false);
	const visibleMembers = $derived(
		showAllMembers ? primaryMembers : primaryMembers.slice(0, MEMBER_LIMIT)
	);
</script>

<div class="space-y-3 p-3 lg:p-2">
	<!-- Row 1: members on the left, status on the right -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
		{#if primaryMembers.length > 0}
			<section class="min-w-0 flex-1">
				<h2 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
					{primaryMembers.length > 1 ? "Primary Members" : "Primary Member"}
					<span class="ms-2 font-normal normal-case tracking-normal">· ID {$form.uniqueId}</span>
				</h2>

				<ul class="grid gap-x-8 gap-y-3 sm:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
					{#each visibleMembers as member}
						<li class="min-w-0">
							<div class="text-xl font-bold leading-tight text-gray-900 dark:text-white">
								{member.firstName} {member.lastName}
							</div>
							<div class="truncate text-sm text-gray-600 dark:text-gray-300">
								{[member.phone, member.email].filter(Boolean).join(" · ")}
							</div>
						</li>
					{/each}
				</ul>

				{#if primaryMembers.length > MEMBER_LIMIT}
					<button
						type="button"
						class="mt-1 text-sm text-blue-700 hover:underline dark:text-blue-400"
						onclick={() => (showAllMembers = !showAllMembers)}
					>
						{showAllMembers ? "Show fewer" : `+${primaryMembers.length - MEMBER_LIMIT} more`}
					</button>
				{/if}
			</section>
		{/if}

		<div class="flex shrink-0 items-center gap-2">
			<Label for="status" class="shrink-0 text-sm text-gray-500 dark:text-gray-400">Status</Label>
			<Select id="status" size="sm" class="w-36" items={householdStatusOptions} bind:value={$form.status} />
		</div>
	</div>

	<!-- Row 2: one horizontal summary strip -->
	<div class="flex flex-wrap items-stretch gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
		<!-- ID validation status -->
		<div
			role="status"
			class="flex items-center gap-3 rounded-lg border px-4 py-2 {idNeeded
				? 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300'
				: 'border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300'}"
		>
			{#if idNeeded}
				<CloseCircleOutline class="h-7 w-7 shrink-0" />
				<span class="font-bold">Id validation needed</span>
			{:else}
				<CheckCircleOutline class="h-7 w-7 shrink-0" />
				<span class="font-bold">Id validation up to date</span>
			{/if}
		</div>

		<!-- Stat tiles -->
		{#each [
			{ label: "Family size", value: familySize },
			{ label: "Children under 13", value: childCount },
			{ label: "Next appointment", value: nextServiceDate?formattedDate(nextServiceDate):'Now', small: true, highlight: !nextServiceDate }
		] as stat}
    	<dl
        class="flex min-w-28 flex-col-reverse justify-center rounded-lg border px-5 py-2 text-center
        {stat.highlight
            ? 'border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900'
            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}"
    >
        <dt class="text-xs text-gray-500 dark:text-gray-400">{stat.label}</dt>
        <dd class="{stat.small ? 'text-base' : 'text-2xl'} font-bold text-gray-900 dark:text-white">
            {stat.value}
        </dd>
    	</dl>
		{/each}
	</div>
</div>