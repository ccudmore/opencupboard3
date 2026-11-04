<script lang="ts">
	import { Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';
	import { HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';

	/**
	 * The trail at the top of a page. Home is always first; give the pages after it.
	 * The last one is the current page, so it has no href.
	 * bar: draws it as a full-width bar (leave off when it sits inside another bar).
	 */
	let { items, bar = false }: { items: { label: string; href?: string }[]; bar?: boolean } = $props();
</script>

<Breadcrumb class={bar ? 'breadcrumb-bar' : ''}>
	<BreadcrumbItem href="/" home>
		{#snippet icon()}<HomeOutline class="breadcrumb-home" />{/snippet}Home
	</BreadcrumbItem>
	{#each items as item (item.label)}
		<BreadcrumbItem href={item.href}>
			{#snippet icon()}<ChevronDoubleRightOutline class="breadcrumb-sep" />{/snippet}
			{item.label}
		</BreadcrumbItem>
	{/each}
</Breadcrumb>
