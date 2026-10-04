<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { geocode } from '$lib/geocode';
  import { toast } from "svelte-sonner";
  import { env } from '$env/dynamic/public';
  //import pkg from 'maplibre-gl';

//  import { PUBLIC_MAPTILER_API_KEY } from "$env/dynamic/public";
  let { street, street2, city, province, country } = $props()

  //let map: pkg.Map | undefined
  let mapContainer: HTMLDivElement;

  onMount(async () => {
    /*
    const {Map, NavigationControl, Marker} = pkg; 
    const maplibregl = await import('maplibre-gl');

    const address = street + ' ' +(street2??'') + ' ' + city + ' ' + province + ' ' + country
    let coords
    try {
     coords = await geocode(address, env.PUBLIC_MAPTILER_API_KEY??'craig');
    } catch (e) { //its of type error
      if (e instanceof Error) {
        toast(e.message)
      } else {
        toast("Unable to determine map location")
      }
      return
    }
    map = new maplibregl.Map({
      container: mapContainer,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${PUBLIC_MAPTILER_API_KEY}`,
      center: [coords.lng, coords.lat],
      zoom: 14
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    new maplibregl.Marker({color: "#FF0000"})
      .setLngLat([coords.lng,coords.lat])
      .addTo(map);
  });
  onDestroy(() => {
    if (map !== undefined) {
      map.remove();
    }
      */
  });
</script>

<div class="w-200 h-100" bind:this={mapContainer}></div>