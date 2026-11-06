<script lang="ts">
	import type { Snippet } from 'svelte';

	/** The frame every home page tile shares: a title, an optional link to the full page, and the content. */
	let { title, href, linkLabel = 'Open', children }: { title: string; href?: string; linkLabel?: string; children: Snippet } = $props();
</script>

<section class="flex min-w-0 flex-col rounded-lg bg-white p-4 shadow-md dark:bg-gray-800">
	<div class="mb-3 flex items-baseline justify-between gap-3">
		<h2 class="section-title">{title}</h2>
		{#if href}<a class="shrink-0 text-sm text-blue-700 underline dark:text-blue-400" {href}>{linkLabel}</a>{/if}
	</div>
	{@render children()}
</section>
