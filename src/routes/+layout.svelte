<script lang="ts">
	import { signOut } from '$lib/auth-client';
	import { goto, invalidateAll } from '$app/navigation';
	import type { LayoutData } from './$types';
	import '../app.css';
	import { Navbar } from '$lib'
    import favicon from '$lib/assets/favicon.svg';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	async function handleSignOut() {
		await signOut();
		await invalidateAll();
		await goto('/login');
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<header class="fixed top-0 z-40 mx-auto w-full flex-none border-b border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800">
  <Navbar/>
  <!--Navbar data={data}/-->
</header>
<div class="bg-gray-50 p-0 dark:bg-gray-800">
  {@render children?.()}
</div>
<!--
<nav>
	<a href="/">Home</a>
	<a href="/dashboard">Dashboard</a>
	<a href="/reports">Reports</a>
	<a href="/admin">Admin</a>

	<span class="spacer"></span>

	{#if data.user}
		<span>{data.user.name} · {data.user.roles.join(', ') || 'no roles'}</span>
		<button onclick={handleSignOut}>Sign out</button>
	{:else}
		<a href="/login">Sign in</a>
	{/if}
</nav>

<main>
	{@render children()}
</main>

<style>
	nav {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid #ddd;
	}
	.spacer {
		flex: 1;
	}
	main {
		padding: 2rem;
		max-width: 720px;
		margin: 0 auto;
	}
</style>
-->