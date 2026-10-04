<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { Search, Dropdown } from 'flowbite-svelte';
    import { hostname } from 'zod';

	type Result = {
		id: string;
		URL: string;
		desc1: string;
		desc2: string;
		desc3: string;
		category: string;
	};
	let query = $state('');
	let results = $state<Result[]>([]);
	let open = $state(false);
	let loading = $state(false);
	let errorMessage = $state('');
	let active = $state(-1);
	let anchorWidth = $state(0);

	let anchorEl: HTMLDivElement | undefined = $state();
	let inputEl: HTMLInputElement | undefined = $state();
	let listEl: HTMLUListElement | undefined = $state();
	let controller: AbortController | undefined;
	let timer: ReturnType<typeof setTimeout>;

	const listId = 'search-results';

	const SEARCH_PAGE_SIZE = 10;

	// Flowbite makes its trigger element focusable (tabindex=0). We only use the
	// wrapper as the anchor, so take it back out of the tab order.
	onMount(() => {
		tick().then(() => {
			if (anchorEl) anchorEl.tabIndex = -1;
		});
	});

	function onInput() {
		clearTimeout(timer);
		active = -1;
		const q = query.trim();

		if (q.length < 2) {
			controller?.abort();
			results = [];
			loading = false;
			errorMessage = '';
			open = false;
			return;
		}

		open = true;
		loading = true;
		timer = setTimeout(() => search(q), 250); // debounce
	}

	async function search(q: string) {
		controller?.abort(); // cancel any in-flight request
		const ctrl = new AbortController();
		controller = ctrl;
		errorMessage = '';

		try {
			const params = new URLSearchParams({ q, s: 'active', pageSize: SEARCH_PAGE_SIZE.toString() });
			const res = await fetch(`/search?${params}`, {
				signal: ctrl.signal
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data: { results: Result[] } = await res.json();
			console.log('Search results', data.results);
			results = data.results;
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
			results = [];
			errorMessage = 'Search failed. Try again.';
		} finally {
			if (!ctrl.signal.aborted) loading = false;
		}
	}

	function select(r: Result) {
		open = false;
//		goto(`${r.URL}`); // craig - Need the base URL
		goto(r.URL);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			active = -1;
			return;
		}
		if (!results.length) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			open = true;
			active = (active + 1) % results.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = active <= 0 ? results.length - 1 : active - 1;
		} else if (e.key === 'Enter' && active >= 0) {
			e.preventDefault();
			select(results[active]);
		}
	}

	// Keep the highlighted option visible inside the scrollable list.
	$effect(() => {
		if (active < 0 || !listEl) return;
		listEl.children[active]?.scrollIntoView({ block: 'nearest' });
	});
</script>

<div id="search-anchor" class="w-full max-w-md" bind:this={anchorEl} bind:clientWidth={anchorWidth}>
	<!--
		Flowbite's Dropdown would normally open on focus/mousedown of its trigger.
		We open it ourselves (after the debounced query), so those two events are
		stopped before they reach the anchor. Click-outside and Escape handling
		still come from the Dropdown.
	-->
	<Search
		size="md"
		class="mt-1 w-96 border focus:outline-none"
		placeholder="Search"
		autocomplete="off"
		spellcheck={false}
		role="combobox"
		aria-label="Search items"
		aria-expanded={open}
		aria-controls={listId}
		aria-autocomplete="list"
		aria-activedescendant={active >= 0 ? `option-${results[active].id}` : undefined}
		bind:value={query}
		bind:elementRef={inputEl}
		oninput={onInput}
		onkeydown={onKeydown}
		onmousedown={(e: MouseEvent) => e.stopPropagation()}
		onfocusin={(e: FocusEvent) => e.stopPropagation()}
		onfocus={() => {
			if (query.trim().length >= 2) open = true;
		}}
	/>
</div>

<Dropdown
	bind:isOpen={open}
	triggeredBy="#search-anchor"
	placement="bottom-start"
	offset={6}
	style="width: {anchorWidth}px"
	class="z-50 border border-gray-200 dark:border-gray-600"
>
	{#if errorMessage}
		<p class="px-4 py-3 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
	{:else if loading && results.length === 0}
		<p class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Searching…</p>
	{:else if results.length === 0}
		<p class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
			No items match “{query.trim()}”.
		</p>
	{/if}

	{#if results.length > 0}
		<ul id={listId} role="listbox" bind:this={listEl} class="max-h-72 overflow-y-auto overscroll-contain py-1">
			{#each results as r, i (r.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					id={`option-${r.id}`}
					role="option"
					aria-selected={i === active}
					class="flex cursor-pointer justify-between gap-4 px-4 py-2 text-sm text-gray-900 dark:text-white {i === active
						? 'bg-gray-100 dark:bg-gray-600'
						: ''}"
					onpointerenter={() => (active = i)}
					onclick={() => select(r)}
				>
					<span>{r.desc1}<br>{r.desc2}<br>{r.desc3}</span>
					<span class="whitespace-nowrap text-gray-500 dark:text-gray-300">{r.category}</span>
				</li>
			{/each}
		</ul>
	{/if}
</Dropdown>