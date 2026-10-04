<script lang="ts">
	import { goto } from '$app/navigation';
	import { Section } from 'flowbite-svelte-blocks';
	import {
		Button,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		TableSearch,
		Table,
		Search,
		Toggle,
	} from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import SearchPagination from '$lib/components/SearchPagination.svelte';

	let { data } = $props();

	let activeOnly: boolean = $state(true);
	let searchTerm = $state('');

	$effect(() => {
		searchTerm = data.q;
	});

	function pageUrl(q: string, page: number, active: boolean) {
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		if (page > 1) params.set('page', String(page));
		params.set('s', active ? 'active' : '');
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

<Section name="advancedTable" sectionClass="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
  <div class="overflow-hidden bg-white shadow-md sm:rounded-lg dark:bg-gray-800">
	<div class="flex flex-col gap-3 p-4 md:flex-row md:items-center">
  <div class="w-full md:w-64">
    <Search bind:value={searchTerm} placeholder="Search" size="md" />
  </div>

  <div class="flex shrink-0 items-center gap-4 md:ml-auto">
    <Button color="alternative" class="shrink-0 text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
      <PlusOutline class="mr-2 h-3.5 w-3.5" />Add household
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


    <Table hoverable={true}>
    <TableHead>
      <TableHeadCell class="px-4 py-3" scope="col">Name</TableHeadCell>
      <TableHeadCell class="px-4 py-3" scope="col">Address</TableHeadCell>
      <TableHeadCell class="px-4 py-3" scope="col">Phone</TableHeadCell>
      <TableHeadCell class="px-4 py-3" scope="col">Email</TableHeadCell>
      <TableHeadCell class="px-4 py-3" scope="col">Status</TableHeadCell>
    </TableHead>
    <TableBody class="divide-y">
      	{#each data.guests as guest (guest.id)}
          <TableBodyRow onclick={(e) => goto(`households/${guest.memberOf?.id}`)}>
            <TableBodyCell class="px-4 py-3">{guest.firstName} {guest.lastName}</TableBodyCell>
			<TableBodyCell class="px-4 py-3">{guest.memberOf?.street}</TableBodyCell>
            <TableBodyCell class="px-4 py-3">{guest.phone}</TableBodyCell>
            <TableBodyCell class="px-4 py-3">{guest.email}</TableBodyCell>
            <TableBodyCell class="px-4 py-3">{guest.memberOf?.status}</TableBodyCell>
          </TableBodyRow>
		    {:else}
			    <TableBodyRow>
				    <TableBodyCell colspan={5} class="py-8 text-center">
					      {data.q ? `No guests match "${data.q}".` : 'No guests yet.'}
				    </TableBodyCell>
			    </TableBodyRow>
        {/each}
    </TableBody>
	</Table>
    <div class="p-4">
	    <SearchPagination page={data.page} pageSize={data.pageSize} total={data.total} onpage={go} />
    </div>
	</div>	
</Section>