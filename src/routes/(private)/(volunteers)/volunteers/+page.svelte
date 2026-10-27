<script lang="ts">
	import { goto } from '$app/navigation';
	import { Section } from 'flowbite-svelte-blocks';
	import {
		Button,
		Search,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Breadcrumb,
		BreadcrumbItem
	} from 'flowbite-svelte';
	import { PlusOutline, HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';
	import SearchPagination from '$lib/components/SearchPagination.svelte';

	let { data } = $props();

	let searchTerm = $state('');
	$effect(() => {
		searchTerm = data.q;
	});

	function pageUrl(q: string, page: number) {
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		if (page > 1) params.set('page', String(page));
		return `?${params.toString()}`;
	}

	function go(page: number) {
		goto(pageUrl(data.q, page), { keepFocus: true, noScroll: true });
	}

	// Search as the person types, after a short pause
	$effect(() => {
		const term = searchTerm.trim();
		if (term === data.q) return;
		const timer = setTimeout(() => {
			goto(pageUrl(term, 1), { keepFocus: true, noScroll: true, replaceState: true });
		}, 300);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>Volunteers</title>
</svelte:head>

<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
	<BreadcrumbItem href="/" home>
		{#snippet icon()}
			<HomeOutline class="me-2 h-4 w-4" />
		{/snippet}Home
	</BreadcrumbItem>
	<BreadcrumbItem href="/volunteers">
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}
		Volunteers
	</BreadcrumbItem>
</Breadcrumb>

<Section name="advancedTable" sectionClass="bg-gray-50 dark:bg-gray-900 p-3 sm:p-5">
	<div class="overflow-hidden bg-white shadow-md sm:rounded-lg dark:bg-gray-800">
		<div class="flex flex-col gap-3 p-4 md:flex-row md:items-center">
			<div class="w-full md:w-64">
				<Search bind:value={searchTerm} placeholder="Search" size="md" />
			</div>
			<div class="flex flex-wrap gap-2 md:ml-auto">
				<Button outline color="dark" class="shrink-0" onclick={() => goto('/volunteers/shifts')}>Shifts</Button>
				<Button outline color="dark" class="shrink-0" onclick={() => goto('/volunteers/new')}>
					<PlusOutline class="mr-2 h-3.5 w-3.5" />New Volunteer
				</Button>
			</div>
		</div>

		{#if data.volunteers.length === 0}
			<p class="px-4 pb-4 text-gray-500 dark:text-gray-400">No volunteers found.</p>
		{:else}
			<!-- Tablet and desktop: table -->
			<div class="hidden md:block">
				<Table hoverable={true}>
					<TableHead>
						<TableHeadCell class="px-4 py-3" scope="col">Name</TableHeadCell>
						<TableHeadCell class="px-4 py-3" scope="col">Phone</TableHeadCell>
						<TableHeadCell class="px-4 py-3" scope="col">Email</TableHeadCell>
						<TableHeadCell class="px-4 py-3" scope="col">City</TableHeadCell>
					</TableHead>
					<TableBody class="divide-y">
						{#each data.volunteers as v (v.id)}
							<TableBodyRow class="cursor-pointer" onclick={() => goto(`/volunteers/${v.id}`)}>
								<TableBodyCell class="px-4 py-3">{v.lastName}, {v.firstName}</TableBodyCell>
								<TableBodyCell class="px-4 py-3">{v.phone1 ?? ''}</TableBodyCell>
								<TableBodyCell class="px-4 py-3">{v.email1 ?? ''}</TableBodyCell>
								<TableBodyCell class="px-4 py-3">{v.city ?? ''}</TableBodyCell>
							</TableBodyRow>
						{/each}
					</TableBody>
				</Table>
			</div>

			<!-- Phones: one tappable card per volunteer -->
			<ul class="divide-y divide-gray-200 md:hidden dark:divide-gray-700">
				{#each data.volunteers as v (v.id)}
					<li>
						<a href={`/volunteers/${v.id}`} class="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700">
							<div class="truncate font-semibold text-gray-900 dark:text-white">{v.firstName} {v.lastName}</div>
							{#if v.phone1 || v.email1}
								<div class="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-300">
									{[v.phone1, v.email1].filter(Boolean).join(' · ')}
								</div>
							{/if}
							{#if v.city}
								<div class="truncate text-sm text-gray-600 dark:text-gray-300">{v.city}</div>
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