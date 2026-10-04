<script lang="ts">
	import { Button, ButtonGroup } from 'flowbite-svelte';
	import { ChevronLeftOutline, ChevronRightOutline } from 'flowbite-svelte-icons';

	let {
		page,
		pageSize,
		total,
		onpage,
		maxButtons = 5
	}: {
		page: number;
		pageSize: number;
		total: number;
		onpage: (page: number) => void;
		maxButtons?: number;
	} = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const startRange = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	const endRange = $derived(Math.min(page * pageSize, total));

	const pagesToShow = $derived.by(() => {
		let start = Math.max(1, page - Math.floor(maxButtons / 2));
		const end = Math.min(totalPages, start + maxButtons - 1);
		start = Math.max(1, end - maxButtons + 1);
		return Array.from({ length: end - start + 1 }, (_, i) => start + i);
	});

	function go(target: number) {
		if (target < 1 || target > totalPages || target === page) return;
		onpage(target);
	}
</script>

<div
	class="flex flex-col items-start justify-between space-y-3 p-4 md:flex-row md:items-center md:space-y-0"
	aria-label="Table navigation"
>
	<span class="text-sm font-normal text-gray-500 dark:text-gray-400">
		Showing
		<span class="font-semibold text-gray-900 dark:text-white">{startRange}-{endRange}</span>
		of
		<span class="font-semibold text-gray-900 dark:text-white">{total}</span>
	</span>

	<ButtonGroup>
		<Button onclick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
			<ChevronLeftOutline size="xs" class="m-1.5" />
		</Button>
		{#each pagesToShow as pageNumber (pageNumber)}
			<Button
				onclick={() => go(pageNumber)}
				color="alternative"
				class={pageNumber === page
					? 'bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700'
					: ''}
				aria-current={pageNumber === page ? 'page' : undefined}
			>
				{pageNumber}
			</Button>
		{/each}
		<Button onclick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Next page">
			<ChevronRightOutline size="xs" class="m-1.5" />
		</Button>
	</ButtonGroup>
</div>