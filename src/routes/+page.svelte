<script lang="ts">
	import type { PageData } from './$types';
	import AppointmentsTile from '$lib/components/Dashboard/AppointmentsTile.svelte';
	import ExpensesTile from '$lib/components/Dashboard/ExpensesTile.svelte';
	import MyShiftsTile from '$lib/components/Dashboard/MyShiftsTile.svelte';
	import VolunteersTile from '$lib/components/Dashboard/VolunteersTile.svelte';

	let { data }: { data: PageData } = $props();
	const hasTiles = $derived(!!(data.myShifts || data.appointments || data.expenses || data.volunteers));
</script>

<svelte:head><title>Home</title></svelte:head>

<div class="page-content space-y-4">
	<h1>Home</h1>

	{#if hasTiles}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#if data.myShifts}
				<MyShiftsTile {...data.myShifts} timeZone={data.timeZone} />
			{/if}
			{#if data.appointments}
				<AppointmentsTile {...data.appointments} timeZone={data.timeZone} />
			{/if}
			{#if data.volunteers}
				<VolunteersTile {...data.volunteers} timeZone={data.timeZone} />
			{/if}
			{#if data.expenses}
				<ExpensesTile {...data.expenses} />
			{/if}
		</div>
	{:else}
		<p class="muted">There is nothing to show here yet. Use the menu to get to the pages you can use.</p>
	{/if}
</div>
