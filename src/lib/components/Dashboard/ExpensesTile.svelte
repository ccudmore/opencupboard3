<script lang="ts">
	import Tile from './Tile.svelte';

	let { pending }: { pending: number } = $props();
</script>

<Tile title="Expenses" href="/expenses" linkLabel="Review expenses">
	<p class="text-3xl font-semibold text-gray-900 dark:text-white">{pending}</p>
	<p class="muted">{pending === 1 ? 'expense is' : 'expenses are'} waiting for approval</p>
</Tile>
