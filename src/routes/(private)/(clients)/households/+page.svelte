<script lang="ts">
	import { goto } from '$app/navigation';
	import { Section } from 'flowbite-svelte-blocks';
	import { householdStatusLabels } from '$lib/labels'
	import { HouseholdStatus } from '$prisma/browser';
	import {
		Button,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Table,
		Search,
		Toggle,
    Breadcrumb,
    BreadcrumbItem
	} from 'flowbite-svelte';
	import { PlusOutline, HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';
	import SearchPagination from '$lib/components/SearchPagination.svelte';
	import NewHousehold from '$lib/components/Household/NewHousehold.svelte';

	let { data } = $props();

	let newModal = $state(false);

	let activeOnly: boolean = $state(true);
	let searchTerm = $state('');

	$effect(() => {
		searchTerm = data.q;
	});

	function pageUrl(q: string, page: number, active: boolean) {
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		if (page > 1) params.set('page', String(page));
		if (!active) params.set('shownonactive','')
		return `?${params.toString()}`;
	}

	function go(page: number) {
		goto(pageUrl(data.q, page, activeOnly), { keepFocus: true, noScroll: true });
	}

	$effect(() => {
		const term = searchTerm.trim();
		if (term === data.q) return;
		const timer = setTimeout(() => {
			goto(pageUrl(term, 1, activeOnly), { keepFocus: true, noScroll: true, replaceState: true });
		}, 300);
		return () => clearTimeout(timer);
	});

	function onToggle(checked: boolean) {
		goto(pageUrl(searchTerm.trim(), 1, checked), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
</script>

<svelte:head>
	<title>Households</title>
</svelte:head>

<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
  <BreadcrumbItem href="/" home>
    {#snippet icon()}
      <HomeOutline class="me-2 h-4 w-4" />
    {/snippet}Home
  </BreadcrumbItem>
  <BreadcrumbItem href="/households">
    {#snippet icon()}
      <ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
    {/snippet}
    Households
  </BreadcrumbItem>
</Breadcrumb>

<Section name="advancedTable" sectionClass="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
  <div class="overflow-hidden bg-white shadow-md sm:rounded-lg dark:bg-gray-800">
    <!-- Search, new button and filter: stacked on phones, one row from md up -->
    <div class="flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div class="w-full md:w-64">
        <Search bind:value={searchTerm} placeholder="Search" size="md" />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 md:ml-auto md:justify-end">
        <Button outline color="dark" class="shrink-0" onclick={() => (newModal = true)}>
          <PlusOutline class="mr-2 h-3.5 w-3.5" />New Household
        </Button>
        <Toggle
          color="green"
          class="whitespace-nowrap"
          bind:checked={activeOnly}
          onchange={(e) => onToggle((e.target as HTMLInputElement).checked)}
        >
          Active only
        </Toggle>
      </div>
    </div>

    {#if data.households.length === 0}
      <p class="px-4 pb-4 text-gray-500 dark:text-gray-400">No households found.</p>
    {:else}
      <!-- Tablet and desktop: table -->
      <div class="hidden md:block">
        <Table hoverable={true}>
          <TableHead>
            <TableHeadCell class="px-4 py-3" scope="col">Name</TableHeadCell>
            <TableHeadCell class="px-4 py-3" scope="col">Address</TableHeadCell>
            <TableHeadCell class="px-4 py-3" scope="col">Phone</TableHeadCell>
            <TableHeadCell class="px-4 py-3" scope="col">Email</TableHeadCell>
            <TableHeadCell class="px-4 py-3" scope="col">Status</TableHeadCell>
          </TableHead>
          <TableBody class="divide-y">
            {#each data.households as household (household.id)}
              <TableBodyRow class="cursor-pointer" onclick={() => goto(`/households/${household.id}`)}>
                <TableBodyCell class="px-4 py-3">
                  {#each household.members as member (member.id)}
                    {member.firstName} {member.lastName}<br>
                  {/each}
                </TableBodyCell>
                <TableBodyCell class="px-4 py-3">
                  {household.street}
                </TableBodyCell>
                <TableBodyCell class="px-4 py-3">
                  {#each household.members as member (member.id)}
                    {member.phone}<br>
                  {/each}
                </TableBodyCell>
                <TableBodyCell class="px-4 py-3">
                  {#each household.members as member (member.id)}
                    {member.email}<br>
                  {/each}
                </TableBodyCell>
                <TableBodyCell class="px-4 py-3">
                  {householdStatusLabels[household.status]}
                </TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      </div>

      <!-- Phones: one tappable card per household -->
      <ul class="divide-y divide-gray-200 md:hidden dark:divide-gray-700">
        {#each data.households as household (household.id)}
          <li>
            <a
              href={`/households/${household.id}`}
              class="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  {#each household.members as member (member.id)}
                    <div class="truncate font-semibold text-gray-900 dark:text-white">
                      {member.firstName} {member.lastName}
                    </div>
                  {/each}
                </div>
                <span
                  class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium
                    {household.status === HouseholdStatus.ACTIVE
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}"
                >
                  {householdStatusLabels[household.status]}
                </span>
              </div>

              {#if household.street}
                <div class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{household.street}</div>
              {/if}

              {#if household.members.some((m) => m.phone)}
                <div class="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                  {household.members.map((m) => m.phone).filter(Boolean).join(' · ')}
                </div>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="p-4">
      <SearchPagination page={data.page} pageSize={data.pageSize} total={data.total} onpage={go} />
    </div>
  </div>
</Section>
<NewHousehold data={data.form} bind:open={newModal} />