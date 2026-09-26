<script lang="ts">
	import { signOut } from '$lib/auth-client';
	import { goto, invalidateAll } from '$app/navigation';
	import type { LayoutData } from './$types';
	import '../app.css';
	import { Navbar } from '$lib'
    import favicon from '$lib/assets/favicon.svg';
    import { page } from "$app/state";

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	async function handleSignOut() {
		await signOut();
		await invalidateAll();
		await goto('/login');
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if page?.data?.user}
<header class="fixed top-0 z-40 mx-auto w-full flex-none border-b border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800">
  <Navbar/>
</header>
{/if}

<div class="bg-gray-50 p-0 dark:bg-gray-800">
  {@render children?.()}
</div>