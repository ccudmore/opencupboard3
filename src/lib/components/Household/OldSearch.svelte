<script lang="ts">
    import { writable } from 'svelte/store';
	import { page } from '$app/state';  
	import { Search } from "flowbite-svelte";
 	import { goto } from '$app/navigation';

    const searchTerm = writable('');

	let { data } = $props();

  	$effect(() => {
    	goto(`?q=${encodeURIComponent($searchTerm.toString())}`, { keepFocus: true, replaceState: true, noScroll: true });
  	})

</script>	
<div>
	<br>	
	<p class="text-xl">Existing Household</p>
	<Search clearable bind:value={$searchTerm} clearableOnClick={() => { searchTerm.set('')}} />
	{#if data?.households?.length > 0}
		{#each data.households as household}
			<a href="{page.url.pathname}/{household.memberOf.id}" role="button" class="outline constrast" style="width: 100%;">
				<header class="font-semibold">{household.firstName} {household.lastName}</header>
				<span class="text-sm">
					{household.email} {household.phone} 
					<hr class="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700">
				</span>
	 		</a>
		{/each}
	{:else if $searchTerm.trim() !== ''}
    	<p>No results found for "{$searchTerm}".</p>
	{/if}
</div>