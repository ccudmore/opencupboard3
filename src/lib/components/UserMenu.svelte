<script lang="ts">
    import { Avatar, Dropdown, DropdownHeader, DropdownItem, DropdownDivider } from 'flowbite-svelte';
    import { LockOutline } from "flowbite-svelte-icons";
    import { page } from "$app/state";
	import { signOut } from '$lib/auth-client';
    import { goto, invalidateAll } from '$app/navigation';

   const user = $derived({
        name: page?.data?.user?.name ?? "",
        email: page?.data?.user?.email ?? "",
        avatar: page?.data?.user?.image ?? "",
    });

    async function doSignout() {
        await signOut();
        await invalidateAll();
        await goto('/login');  
    }

</script>
<button class="ms-3 rounded-full ring-gray-400 focus:ring-4 dark:ring-gray-600">
    <Avatar size="sm" src={user.avatar} tabindex={0} />
</button>

<Dropdown simple> <!-- craig want bottom-end in here -->
{#if page?.data?.user}
    <DropdownHeader>
        <span class="block text-sm">{user.name}</span>
        <span class="block truncate text-sm font-medium">{user.email}</span>
    </DropdownHeader>
    <DropdownDivider />
    <DropdownItem>
        {#snippet icon()}
            <LockOutline class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white" />
        {/snippet}
        Change Password
    </DropdownItem>
        <DropdownItem>
        {#snippet icon()}
            <LockOutline class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white" />
        {/snippet}
        Settings
    </DropdownItem>
    <DropdownDivider />
    <DropdownItem onclick={doSignout}>
        {#snippet icon()}
            <LockOutline class="h-50 w-50 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white" />
        {/snippet}
        Sign out
    </DropdownItem>
{:else}
    <DropdownItem as="a" href="/login">
        {#snippet icon()}
            <LockOutline class="h-50 w-50 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white" />
        {/snippet}
        Sign in
    </DropdownItem>
{/if}

</Dropdown>
