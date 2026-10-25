<script lang="ts">
	import { page } from '$app/state';
	import { Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';
	import { HomeOutline, ChevronDoubleRightOutline, UsersGroupSolid, AwardOutline } from 'flowbite-svelte-icons';

	let { children } = $props();

	// One tab per admin component. Add new ones here and under src/routes/(private)/(admin)/admin/.
	const tabs = [
		{ href: '/admin/users', label: 'Users', icon: UsersGroupSolid },
		{ href: '/admin/roles', label: 'Roles', icon: AwardOutline }
	];

	const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<svelte:head>
	<title>Admin</title>
</svelte:head>

<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
	<BreadcrumbItem href="/" home>
		{#snippet icon()}
			<HomeOutline class="me-2 h-4 w-4" />
		{/snippet}Home
	</BreadcrumbItem>
	<BreadcrumbItem href="/admin">
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}
		Admin
	</BreadcrumbItem>
</Breadcrumb>

<div class="bg-gray-50 p-3 sm:p-5 dark:bg-gray-900">
	<div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
		<!-- Tabs: scroll sideways on narrow screens instead of wrapping -->
		<nav aria-label="Admin sections" class="flex flex-nowrap overflow-x-auto border-b border-gray-200 px-1 dark:border-gray-700">
			{#each tabs as tab (tab.href)}
				{@const Icon = tab.icon}
				<a
					href={tab.href}
					aria-current={isActive(tab.href) ? 'page' : undefined}
					class="-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap
						{isActive(tab.href)
						? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
						: 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white'}"
				>
					<Icon size="md" />{tab.label}
				</a>
			{/each}
		</nav>

		<div class="min-w-0">
			{@render children()}
		</div>
	</div>
</div>
