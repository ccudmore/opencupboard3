<script lang="ts">
  import { AppsMenu, UserMenu, NavDrawer } from '$lib'
  import NotificationsMenu from '$lib/components/NotificationsMenu.svelte'
  import { DarkMode, NavBrand, Navbar } from 'flowbite-svelte';
  import { SearchOutline, CloseOutline } from 'flowbite-svelte-icons';
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import { env } from '$env/dynamic/public'
  import SearchBox from '$lib/components/SearchBox.svelte';
  import Logo from '$lib/Logo.svelte'

  const organizationName = env.PUBLIC_ORGANIZATION_NAME ?? 'Open Cupboard'

  // Below the large breakpoint the search box is a bar under the navbar, opened by the search button
  let searchOpen = $state(false)

  async function toggleSearch() {
    searchOpen = !searchOpen
    if (searchOpen) {
      await tick()
      document.querySelector<HTMLInputElement>('#search-anchor input')?.focus()
    }
  }

  // going somewhere (for example after picking a result) closes the bar
  $effect(() => {
    page.url.pathname
    page.url.search
    searchOpen = false
  })
</script>
<Navbar class="relative mx-10 sm:mx-0">
  <NavDrawer/>
  <NavBrand href="/" class="mx-10">
  	<Logo class="h-8" />
    <span class="ml-px self-center text-xl font-semibold whitespace-nowrap sm:text-2xl dark:text-white">{organizationName}</span>
  </NavBrand>
  <!-- one search box: a bar under the navbar on small screens (when opened), inline from lg up -->
  <div
    class="{searchOpen ? 'block' : 'hidden'} absolute inset-x-0 top-full z-40 border-y border-gray-200 bg-white p-3 shadow-md lg:static lg:block lg:border-0 lg:bg-transparent lg:p-0 lg:ps-3 lg:shadow-none dark:border-gray-600 dark:bg-gray-800 dark:lg:bg-transparent"
  >
  	<SearchBox />

  <!--
    <form>
      <Search size="md" class="mt-1 w-96 border focus:outline-none" />
    </form>
    -->
  </div>
  <div class="ms-auto flex items-center text-gray-500 sm:order-2 dark:text-gray-300">
    <!--AppsMenu /-->
    <button
      type="button"
      class="mr-1 rounded-lg p-2.5 text-gray-500 hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 focus:outline-none lg:hidden dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
      aria-label={searchOpen ? 'Close search' : 'Search'}
      aria-expanded={searchOpen}
      onclick={toggleSearch}
    >
      {#if searchOpen}<CloseOutline class="h-5 w-5" />{:else}<SearchOutline class="h-5 w-5" />{/if}
    </button>
    <NotificationsMenu />
    <DarkMode />
    <UserMenu />
  </div>

</Navbar>