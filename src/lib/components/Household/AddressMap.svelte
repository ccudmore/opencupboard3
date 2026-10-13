<!--
  AddressMap.svelte
  Builds an address from its parts, geocodes it with Nominatim, and shows it
  on an OpenStreetMap map via Leaflet.

  Setup:  npm install leaflet && npm install -D @types/leaflet
  Svelte 5 (runes). Safe for SSR: Leaflet is loaded only in the browser.

  Usage:
    <AddressMap
      street="111 Wellington St"
      city="Ottawa"
      province="ON"
      country="Canada"
    />
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Map as LeafletMap, Marker } from 'leaflet';

	interface Props {
		street?: string;
		/** Unit / suite / floor. Shown in the popup but not used for geocoding. */
		street2?: string;
		city?: string;
		province?: string;
		country?: string;
		/** CSS height of the map. */
		height?: string;
		/** Called after a successful geocode. */
		onlocate?: (result: { lat: number; lng: number; displayName: string }) => void;
	}

	let {
		street = '',
		street2 = '',
		city = '',
		province = '',
		country = '',
		height = '400px',
		onlocate
	}: Props = $props();

	type Status = 'idle' | 'loading' | 'ready' | 'notfound' | 'error';

	let status = $state<Status>('idle');
	let displayName = $state('');
	let errorMessage = $state('');
	let ready = $state(false); // true once the Leaflet map exists

	let mapEl: HTMLDivElement;
	let L: typeof import('leaflet');
	let map: LeafletMap | undefined;
	let marker: Marker | undefined;
	let markerIcon: import('leaflet').Icon;
	let controller: AbortController | undefined;

	// Geocoding query. Unit numbers (street2) tend to confuse Nominatim, so they're left out.
	const geocodeQuery = $derived(
		[street, city, province, country]
			.map((part) => part?.trim())
			.filter(Boolean)
			.join(', ')
	);

	// What the popup shows: the full address including the unit.
	const label = $derived(
		[street, street2, city, province, country]
			.map((part) => part?.trim())
			.filter(Boolean)
			.join(', ')
	);

	onMount(() => {
		let destroyed = false;

		(async () => {
			L = (await import('leaflet')).default;
			await import('leaflet/dist/leaflet.css');

			// Bundlers break Leaflet's default marker icon paths; set them explicitly.
			const [icon, icon2x, shadow] = await Promise.all([
				import('leaflet/dist/images/marker-icon.png?url'),
				import('leaflet/dist/images/marker-icon-2x.png?url'),
				import('leaflet/dist/images/marker-shadow.png?url')
			]);
			if (destroyed) return;

			// Use an explicit icon instead of patching L.Icon.Default: the default icon
			// prepends an auto-detected image path, which breaks under Vite's hashed assets.
			markerIcon = L.icon({
				iconUrl: icon.default,
				iconRetinaUrl: icon2x.default,
				shadowUrl: shadow.default,
				iconSize: [25, 41],
				iconAnchor: [12, 41],
				popupAnchor: [1, -34],
				shadowSize: [41, 41]
			});

			map = L.map(mapEl).setView([45.4215, -75.6972], 11); // neutral default until geocoded
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
			}).addTo(map);

			ready = true;
		})();

		return () => {
			destroyed = true;
			controller?.abort();
			map?.remove();
			map = undefined;
		};
	});

	// Geocode once the map is ready, and again whenever any address part changes.
	$effect(() => {
		const q = geocodeQuery;
		if (ready && q) geocode(q);
	});

	async function geocode(q: string) {
		if (!map) return;

		controller?.abort();
		controller = new AbortController();
		status = 'loading';
		errorMessage = '';

		const params = new URLSearchParams({
			q,
			format: 'jsonv2',
			limit: '1',
			addressdetails: '0'
		});

		try {
			const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
				signal: controller.signal,
				headers: { Accept: 'application/json' }
			});
			if (!res.ok) throw new Error(`Geocoding failed (HTTP ${res.status})`);

			const results: Array<{ lat: string; lon: string; display_name: string }> =
				await res.json();

			if (results.length === 0) {
				status = 'notfound';
				return;
			}

			const lat = parseFloat(results[0].lat);
			const lng = parseFloat(results[0].lon);
			displayName = results[0].display_name;

			map.setView([lat, lng], 17);
			if (marker) {
				marker.setLatLng([lat, lng]);
			} else {
				marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
			}
			marker.bindPopup(label || displayName);

			status = 'ready';
			onlocate?.({ lat, lng, displayName });
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Something went wrong.';
		}
	}
</script>

<div class="address-map">
	<div class="status" aria-live="polite">
		{#if status === 'loading'}
			<span class="muted">Locating address…</span>
		{:else if status === 'notfound'}
			<span class="warn">Couldn't find that address on the map.</span>
		{:else if status === 'error'}
			<span class="warn">{errorMessage}</span>
		{/if}
	</div>

	<div bind:this={mapEl} class="map" style:height></div>
</div>

<style>
	.address-map {
		display: grid;
		gap: 0.5rem;
	}
	.status {
		min-height: 1.25rem;
		font-size: 0.875rem;
	}
	.warn {
		color: #b91c1c;
	}
	.muted {
		color: #555;
	}
	.map {
		width: 75%;
		border-radius: 8px;
		z-index: 0; /* keep Leaflet panes below site headers/modals */
	}
</style>