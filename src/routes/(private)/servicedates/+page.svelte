<script lang="ts">
	import { Badge, Breadcrumb, BreadcrumbItem, Button, Input, Label, Modal, Select, Textarea, Toggle } from 'flowbite-svelte';
	import { HomeOutline, ChevronDoubleRightOutline, PlusOutline, ChevronDownOutline } from 'flowbite-svelte-icons';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { callAction } from '$lib/client/callAction';
	import MonthPicker from '$lib/components/ServiceDates/MonthPicker.svelte';
	import ServiceDateCard from '$lib/components/ServiceDates/ServiceDateCard.svelte';

	let { data } = $props();

	let open = $state<Record<string, boolean>>({});

	const dateFmt = $derived(new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: data.timeZone }));
	const timeFmt = $derived(new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: data.timeZone }));
	const today = $derived(new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: data.timeZone }).format(new Date()));

	const siteItems = $derived(data.sites.map((s: { id: string; name: string }) => ({ value: s.id, name: s.name })));

	async function reveal(id: string) {
		open[id] = true;
		await tick();
		document.getElementById(`service-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// Arriving with ?focus=YYYY-MM-DD (from the date picker, for a day that wasn't loaded)
	$effect(() => {
		const s = data.focus && data.services.find((x: { date: string }) => x.date === data.focus);
		if (s) void reveal(s.id);
	});

	function setShowPast(on: boolean) {
		goto(on ? '?past=1' : '?', { keepFocus: true, noScroll: true });
	}

	function pickDate(date: string) {
		const s = data.services.find((x: { date: string }) => x.date === date);
		if (s) return void reveal(s.id);
		if (data.markedDates.includes(date)) {
			// It's an earlier service date that isn't listed yet
			return void goto(`?past=1&focus=${date}`, { noScroll: true });
		}
		openNew(date);
	}

	// ------------------------------------------------ new service date
	let newOpen = $state(false);
	let newBusy = $state(false);
	let newError = $state('');
	let form = $state({ title: 'Service Date', date: '', startClock: '09:00', endClock: '12:00', siteId: '', note: '' });

	function openNew(date = '') {
		form = { title: 'Service Date', date: date || today, startClock: '09:00', endClock: '12:00', siteId: data.sites[0]?.id ?? '', note: '' };
		newError = '';
		newOpen = true;
	}

	async function createNew() {
		newBusy = true;
		newError = '';
		const r = await callAction('createServiceDate', form);
		newBusy = false;
		if (!r.ok) {
			newError = r.message;
			return;
		}
		newOpen = false;
		toast('Service date added. Now add its appointments.');
		const date = form.date;
		if (new Date(`${date}T00:00:00`) < new Date(`${today}T00:00:00`) && !data.showPast) {
			await goto(`?past=1&focus=${date}`, { noScroll: true });
		} else {
			await invalidateAll();
			await reveal(r.data.id);
		}
	}

	async function openAfterDuplicate(id: string) {
		await invalidateAll();
		await reveal(id);
	}
</script>

<svelte:head>
	<title>Service dates</title>
</svelte:head>

<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
	<BreadcrumbItem href="/" home>
		{#snippet icon()}
			<HomeOutline class="me-2 h-4 w-4" />
		{/snippet}Home
	</BreadcrumbItem>
	<BreadcrumbItem href="/servicedates">
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}
		Service dates
	</BreadcrumbItem>
</Breadcrumb>

<div class="bg-gray-50 p-3 sm:p-5 dark:bg-gray-900">
	<div class="mx-auto w-full max-w-6xl min-w-0">
		<div class="mb-4 flex flex-wrap items-center gap-3">
			<h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Service dates</h1>
			<div class="ms-auto flex flex-wrap items-center gap-4">
				<Toggle checked={data.showPast} onchange={(e: Event) => setShowPast((e.currentTarget as HTMLInputElement).checked)}>Show previous service dates</Toggle>
				<Button color="dark" onclick={() => openNew()}><PlusOutline class="me-2 h-3.5 w-3.5" />New service date</Button>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
			<div class="lg:sticky lg:top-4 lg:self-start">
				<MonthPicker marked={data.markedDates} {today} onpick={pickDate} />
			</div>

			<div class="min-w-0 space-y-3">
				{#if data.services.length === 0}
					<div class="rounded-lg bg-white p-4 text-gray-600 shadow-md dark:bg-gray-800 dark:text-gray-300">
						{data.showPast ? 'There are no service dates yet.' : 'There are no upcoming service dates.'} Use New service date to add one.
					</div>
				{/if}

				{#each data.services as s (s.id)}
					<div id={`service-${s.id}`} class="scroll-mt-4 rounded-lg bg-white shadow-md dark:bg-gray-800 {s.past ? 'opacity-90' : ''}">
						<button
							type="button"
							class="flex w-full min-w-0 items-start justify-between gap-3 p-3 text-left sm:p-4"
							aria-expanded={!!open[s.id]}
							onclick={() => (open[s.id] = !open[s.id])}
						>
							<div class="min-w-0">
								<div class="font-semibold text-gray-900 dark:text-white">{dateFmt.format(new Date(s.startTime))}</div>
								<div class="text-sm wrap-break-words text-gray-600 dark:text-gray-300">
									{s.title} · {timeFmt.format(new Date(s.startTime))} to {timeFmt.format(new Date(s.endTime))} · {s.siteName}
								</div>
								<div class="mt-2 flex flex-wrap gap-2">
									{#if s.status === 'CANCELLED'}<Badge color="red">Cancelled</Badge>{/if}
									{#if s.past && s.status !== 'CANCELLED'}<Badge color="gray">Past</Badge>{/if}
									<Badge color="green">{s.counts.open} open</Badge>
									<Badge color="blue">{s.counts.booked} booked</Badge>
									<Badge color="gray">{s.counts.total} appointments</Badge>
								</div>
							</div>
							<ChevronDownOutline class="mt-1 h-5 w-5 shrink-0 text-gray-600 transition-transform dark:text-gray-300 {open[s.id] ? 'rotate-180' : ''}" />
						</button>

						{#if open[s.id]}
							<div class="border-t border-gray-200 p-3 sm:p-4 dark:border-gray-700">
								<ServiceDateCard
									service={s}
									sites={data.sites}
									timeZone={data.timeZone}
									emailEnabled={data.emailEnabled}
									canManageVolunteers={data.canManageVolunteers}
									onopen={openAfterDuplicate}
								/>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<Modal title="New service date" bind:open={newOpen} size="sm">
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<div class="min-w-0 sm:col-span-2">
			<Label for="new-title" class="mb-1">Title</Label>
			<Input id="new-title" bind:value={form.title} />
		</div>
		<div class="min-w-0">
			<Label for="new-date" class="mb-1">Date</Label>
			<Input id="new-date" type="date" bind:value={form.date} />
		</div>
		<div class="min-w-0">
			<Label for="new-site" class="mb-1">Site</Label>
			<Select id="new-site" items={siteItems} bind:value={form.siteId} />
		</div>
		<div class="min-w-0">
			<Label for="new-start" class="mb-1">Starts</Label>
			<Input id="new-start" type="time" bind:value={form.startClock} />
		</div>
		<div class="min-w-0">
			<Label for="new-end" class="mb-1">Ends</Label>
			<Input id="new-end" type="time" bind:value={form.endClock} />
		</div>
		<div class="min-w-0 sm:col-span-2">
			<Label for="new-note" class="mb-1">Note</Label>
			<Textarea id="new-note" rows={2} class="block w-full max-w-full min-w-0" bind:value={form.note} />
		</div>
	</div>
	{#if newError}<p class="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{newError}</p>{/if}
	{#snippet footer()}
		<Button color="dark" disabled={newBusy} onclick={createNew}>{newBusy ? 'Adding…' : 'Add service date'}</Button>
		<Button outline color="dark" onclick={() => (newOpen = false)}>Cancel</Button>
	{/snippet}
</Modal>
