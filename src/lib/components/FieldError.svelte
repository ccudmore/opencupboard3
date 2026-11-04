<script lang="ts">
	import { Helper } from 'flowbite-svelte';

	/** The messages Superforms gives for one field. Shows nothing when there are none. */
	let { messages }: { messages: string[] | undefined } = $props();
</script>

{#if messages && messages.length}
	<Helper color="red" class="field-help">{messages.join(', ')}</Helper>
{/if}
