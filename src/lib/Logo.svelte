<script lang="ts">
	let { class: className = 'h-10' }: { class?: string } = $props();
</script>

<img src="/logo/light" alt="Logo" class="{className} dark:hidden" />
<img src="/logo/dark" alt="Logo" class="{className} hidden dark:block" />