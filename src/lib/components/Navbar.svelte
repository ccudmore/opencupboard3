<script lang="ts">
  //import {AppsMenu,  UserMenu, NotificationList, NavDrawer  } from '$lib';
  import { DarkMode, NavBrand, Navbar, Search } from 'flowbite-svelte';
</script>
<Navbar class="mx-10 sm:mx-0">
  <NavBrand href="/" class="mx-10">
    <img src="/images/flowbite-svelte-icon-logo.svg" class="me-2.5 h-6 sm:h-8" alt="Flowbite Logo" />
    <span class="ml-px self-center text-xl font-semibold whitespace-nowrap sm:text-2xl dark:text-white"> The Community Table </span>
  </NavBrand>
    <div class="hidden lg:block lg:ps-3">
      <form>
        <Search size="md" class="mt-1 w-96 border focus:outline-none" />
      </form>
  </div>
  <div class="ms-auto flex items-center text-gray-500 sm:order-2 dark:text-gray-300">
      <DarkMode />
    </div>

</Navbar>
