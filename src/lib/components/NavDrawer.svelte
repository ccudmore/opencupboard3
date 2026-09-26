<script lang="ts">
  import { Drawer, Sidebar, SidebarGroup, SidebarItem } from "flowbite-svelte";
  import { BarsFromLeftOutline } from "flowbite-svelte-icons";
  import { page } from "$app/state";
  import { getPermittedApps } from "$lib/components/NavPermissions";
  const apps = getPermittedApps(page?.data?.user?.roles);
  let drawerOpen = $state(false);
  let spanClass = "flex-1 ms-3 whitespace-nowrap";
</script>

<BarsFromLeftOutline class="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" onclick={() => (drawerOpen = true)}/> 
<Drawer bind:open={drawerOpen} class="w-64 bg-gray-50 p-0 dark:bg-gray-800">
  <h5 class="px-6 py-4 text-base font-semibold text-gray-500 uppercase dark:text-gray-400">Menu</h5>
  <Sidebar alwaysOpen class="z-50 h-full text-sm w-80" position="absolute">
    <!--EventPicker data={data} events={data.events}/-->
    <SidebarGroup>
      {#each apps as { label, href, icon: Icon, subContent }}
        <SidebarItem {label} {href} {spanClass}>
          {#snippet icon()}
            <Icon class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white"></Icon>
          {/snippet}
          {#snippet subtext()}
            <span class="ms-3 inline-flex items-center justify-center rounded-full bg-gray-200 px-2 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              {subContent}
            </span>
          {/snippet}
        </SidebarItem>
      {/each}
    </SidebarGroup>
  </Sidebar>
</Drawer>