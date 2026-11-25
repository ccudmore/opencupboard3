<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Alert, Button, Label, Select, Spinner, Toggle } from 'flowbite-svelte';
	import PageBreadcrumb from '#lib/components/PageBreadcrumb.svelte';

	let { data } = $props();

	// ------------------------------------------------------------ filters
	const servedChoices = [
		{ value: 0, name: 'All active households' },
		{ value: 3, name: 'Completed a booking in the last 3 months' },
		{ value: 6, name: 'Completed a booking in the last 6 months' },
		{ value: 12, name: 'Completed a booking in the last 12 months' }
	];

	function applyFilters(served: number, people: boolean) {
		const params = new URLSearchParams();
		if (served) params.set('served', String(served));
		if (people) params.set('people', '1');
		const qs = params.toString();
		void goto(qs ? `?${qs}` : '?', { reset: false, replace: true });
	}

	// ------------------------------------------------------------ address look-up progress
	let progress = $state({ running: false, total: 0, finished: 0, error: null as string | null });
	$effect(() => {
		progress = data.progress;
	});

	// While the background look-up runs, check on it every few seconds and refresh the map
	$effect(() => {
		if (!progress.running) return;
		const timer = setInterval(async () => {
			try {
				const res = await fetch('/reports/household-heatmap/status');
				if (res.ok) progress = await res.json();
			} catch {
				/* try again on the next tick */
			}
			if (!progress.running) await invalidateAll();
		}, 3000);
		return () => clearInterval(timer);
	});

	// ------------------------------------------------------------ map
	let mapEl: HTMLDivElement;
	let L: typeof import('leaflet') | undefined;
	let HeatLayer: typeof import('leaflet.heat').HeatLayer | undefined;
	let map: import('leaflet').Map | undefined;
	let heat: import('leaflet').Layer | undefined;
	let ready = $state(false);

	onMount(() => {
		let destroyed = false;
		(async () => {
			const leaflet = (await import('leaflet')).default;
			({ HeatLayer } = await import('leaflet.heat'));
			await import('leaflet/dist/leaflet.css');
			if (destroyed) return;
			L = leaflet;
			map = leaflet.map(mapEl).setView([45.4215, -75.6972], 11);
			leaflet
				.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
					maxZoom: 19,
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				})
				.addTo(map);
			ready = true;
		})();
		return () => {
			destroyed = true;
			map?.remove();
			map = undefined;
		};
	});

	let fitted = false;
	$effect(() => {
		const points = data.points;
		if (!ready || !map || !L || !HeatLayer) return;
		if (heat) map.removeLayer(heat);
		const max = Math.max(1, ...points.map((p) => p.count));
		const layer = new HeatLayer(
			points.map((p) => [p.lat, p.lng, p.count / max] as [number, number, number]),
			{ radius: 32, blur: 24, minOpacity: 0.35, maxZoom: 15 }
		) as unknown as import('leaflet').Layer;
		heat = layer;
		layer.addTo(map);
		// Frame the data the first time it appears, but don't move the map on later refreshes
		if (!fitted && points.length) {
			map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
				padding: [40, 40],
				maxZoom: 14
			});
			fitted = true;
		}
	});

	const unit = $derived(data.weightByPeople ? 'people' : 'households');
	const toLocate = $derived(data.counts.pending);
</script>

<div class="p-4">
	<PageBreadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Household heat map' }]} />
	<h1 class="mt-4 mb-1 text-2xl font-semibold text-gray-900 dark:text-white">Household heat map</h1>
	<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
		Where households are concentrated. To protect privacy, households are grouped into squares of about
		500 m and no exact addresses are shown.
	</p>

	<div class="mb-4 flex flex-wrap items-end gap-4">
		<div class="min-w-64">
			<Label for="served" class="mb-2">Show</Label>
			<Select
				id="served"
				items={servedChoices}
				value={data.servedMonths}
				onchange={(e: Event) =>
					applyFilters(Number((e.target as HTMLSelectElement).value), data.weightByPeople)}
			/>
		</div>
		<Toggle
			checked={data.weightByPeople}
			onchange={(e: Event) =>
				applyFilters(data.servedMonths, (e.target as HTMLInputElement).checked)}
		>
			Count people instead of households
		</Toggle>
		<div class="text-sm text-gray-700 dark:text-gray-300">
			Showing <strong>{data.total}</strong>
			{unit}
			{#if !data.weightByPeople}
				({data.points.length} {data.points.length === 1 ? 'area' : 'areas'})
			{/if}
		</div>
	</div>

	{#if progress.running}
		<Alert color="blue" class="mb-4">
			<Spinner size="4" class="me-2" />
			Looking up addresses: {progress.finished} of {progress.total} done. This takes about a second per
			household, and the map updates when it finishes. You can leave this page.
		</Alert>
	{:else if toLocate > 0}
		<Alert color="yellow" class="mb-4">
			<div class="flex flex-wrap items-center gap-3">
				<span>
					{toLocate} active {toLocate === 1 ? 'household has' : 'households have'} no map location yet.
				</span>
				<form
					method="POST"
					action="?/locate"
					use:enhance={() =>
						async ({ result }) => {
							if (result.type === 'success' && result.data?.progress)
								progress = result.data.progress as typeof progress;
						}}
				>
					<Button type="submit" size="xs">Look up addresses</Button>
				</form>
			</div>
		</Alert>
	{/if}
	{#if progress.error}
		<Alert color="red" class="mb-4">
			The address look-up stopped: {progress.error}. Press “Look up addresses” to continue.
		</Alert>
	{/if}

	<div
		bind:this={mapEl}
		class="h-[65vh] min-h-96 w-full rounded-lg border border-gray-200 dark:border-gray-600"
	></div>

	<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
		{data.counts.located} of {data.counts.total} active households are on the map.
		{#if data.counts.noAddress}{data.counts.noAddress} have no street or postal code.{/if}
		{#if data.counts.notFound}{data.counts.notFound} addresses couldn't be found; check them on the household
			page.{/if}
	</p>
</div>
