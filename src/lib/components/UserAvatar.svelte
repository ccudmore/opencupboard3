<script lang="ts">
	import { Avatar } from 'flowbite-svelte';
	import { avatarFor } from '$lib/avatars';

	let { image = '', size = 'sm' }: { image?: string | null; size?: 'sm' | 'lg' } = $props();

	const icon = $derived(avatarFor(image));
	const box = $derived(size === 'lg' ? 'h-16 w-16 text-4xl' : 'h-8 w-8 text-lg');
</script>

{#if icon}
	<span
		class="inline-flex shrink-0 items-center justify-center rounded-full leading-none select-none {box}"
		style="background-color: {icon.bg}"
		role="img"
		aria-label={icon.label}
	>
		{icon.emoji}
	</span>
{:else}
	<Avatar size={size === 'lg' ? 'lg' : 'sm'} src={image ?? ''} alt="User Avatar" {...{ referrerpolicy: 'no-referrer' } as any} />
{/if}
