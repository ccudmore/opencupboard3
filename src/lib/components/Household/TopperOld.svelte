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
</script>

<div class="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 md:p-6">
    <!-- Left column: people and status -->
    <div class="space-y-5">
{#if primaryMembers.length > 0}
    <div>
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {primaryMembers.length > 1 ? "Primary Members" : "Primary Member"}
        </div>
        <div class="space-y-2">
            {#each primaryMembers as member}
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div class="text-xl font-bold text-gray-900 dark:text-white">
                        {member.firstName} {member.lastName}
                    </div>
                    <div class="flex min-w-0 flex-col text-sm leading-tight text-gray-600 dark:text-gray-300">
                        <span class="break-all">{member.email}</span>
                        <span>{member.phone}</span>
                    </div>
                </div>
            {/each}
        </div>
    </div>
{/if}

        {#if idNeeded}
            <span
                class="inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 font-bold text-red-800
                       dark:bg-red-900/40 dark:text-red-300"
            >
                <CloseCircleOutline class="h-5 w-5" />
                Id validation needed
            </span>
        {:else}
            <span
                class="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 font-bold text-green-800
                       dark:bg-green-900/40 dark:text-green-300"
            >
                <CheckCircleOutline class="h-5 w-5" />
                All Ids up to date
            </span>
        {/if}



    <div
        class="flex w-full max-w-xs items-center gap-3 rounded-lg border-2 border-gray-300 bg-white p-3 shadow-sm
           dark:border-gray-600 dark:bg-gray-800"
>
        <Label for="status" class="shrink-0 text-base font-bold">Status</Label>
        <Select id="status" class="flex-1" items={householdStatuses} bind:value={$form.status} />
    </div>
    </div>

    <!-- Right column: summary and ID check -->
    <div class="space-y-4">
        <dl
            class="grid w-full grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-blue-300 bg-blue-100 p-3 font-bold text-blue-900
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
</div>