<script lang="ts">
    import { Avatar, Dropdown, DropdownHeader, DropdownItem, DropdownDivider,  } from 'flowbite-svelte';
    import { ShieldCheckOutline, LockOutline, UserSettingsOutline } from "flowbite-svelte-icons";
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
    <Avatar size="sm" src={user.avatar} tabindex={0} alt="User Avatar" {...{ referrerpolicy: "no-referrer" } as any}/>
</button>

<Dropdown simple class="bottom-end">
    <DropdownHeader>
        <span class="block text-sm">{user.name}</span>
        <span class="block truncate text-sm font-medium">{user.email}</span>
    </DropdownHeader>
    <DropdownDivider />
    <DropdownItem href="/changepassword" class="flex items-center gap-2">
        <ShieldCheckOutline class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white" />
        Change Password
    </DropdownItem>
    <DropdownItem href="/usersettings" class="flex items-center gap-2">
        <UserSettingsOutline class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white" />
        Settings
    </DropdownItem>
    <DropdownDivider />
    <DropdownItem onclick={doSignout} class="flex items-center gap-2">
        <LockOutline class="h-5 w-5 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white" />
        Sign out
    </DropdownItem>
</Dropdown>