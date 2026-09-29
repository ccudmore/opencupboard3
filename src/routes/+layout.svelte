<script lang="ts">
	import { signOut } from '$lib/auth-client';
	import { goto, invalidateAll } from '$app/navigation';
	import type { LayoutData } from './$types';
	import '../app.css';
	import { Navbar } from '$lib'
    import { page } from "$app/state";
	import { Toaster } from 'svelte-sonner';


	let headerHeight = $state(0);


	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const favicon = '/images/logo.svg'
	async function handleSignOut() {
		await signOut();
		await invalidateAll();
		await goto('/login');
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<header class="fixed top-0 z-40 mx-auto w-full flex-none border-b border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800" bind:offsetHeight={headerHeight}>
<Toaster />
{#if page?.data?.user}
  <Navbar/>
{/if}
</header>
<div style="padding-top: {headerHeight}px">
<!--div class="bg-gray-50 p-0 dark:bg-gray-800 text-black dark:text-white" style="padding-top: {headerHeight}px"-->
  {@render children?.()}
</div>