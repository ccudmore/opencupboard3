<script lang="ts">
	type Series = { name: string; values: number[]; color: string };
	let { labels, series, ariaLabel = 'Chart' }: { labels: string[]; series: Series[]; ariaLabel?: string } =
		$props();

	const W = 800;
	const H = 340;
	const M = { top: 16, right: 36, bottom: 44, left: 52 };
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;

	// A round maximum for the y axis, and about five gridlines up to it
	const yAxis = $derived.by(() => {
		const max = Math.max(1, ...series.flatMap((s) => s.values));
		const rough = max / 5;
		const pow = Math.pow(10, Math.floor(Math.log10(rough)));
		const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
		const top = Math.ceil(max / step) * step;
		const ticks: number[] = [];
		for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
		return { top, ticks };
	});

	const x = (i: number) =>
		M.left + (labels.length === 1 ? plotW / 2 : (i * plotW) / (labels.length - 1));
	const y = (v: number) => M.top + plotH - (v / yAxis.top) * plotH;
	// About 8 month labels at most, counted back from the latest month so that one always shows
	const labelEvery = $derived(Math.ceil(labels.length / 8));
	const showLabel = (i: number) => (labels.length - 1 - i) % labelEvery === 0;
</script>

<div class="w-full text-gray-500 dark:text-gray-400">
	<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img" aria-label={ariaLabel}>
		<!-- gridlines and y labels -->
		{#each yAxis.ticks as t (t)}
			<line
				x1={M.left}
				x2={W - M.right}
				y1={y(t)}
				y2={y(t)}
				stroke="currentColor"
				stroke-opacity="0.25"
				stroke-width="1"
			/>
			<text
				x={M.left - 8}
				y={y(t)}
				text-anchor="end"
				dominant-baseline="middle"
				font-size="12"
				fill="currentColor">{t.toLocaleString()}</text
			>
		{/each}
		<!-- x labels -->
		{#each labels as l, i (i)}
			{#if showLabel(i)}
				<text
					x={x(i)}
					y={H - M.bottom + 18}
					text-anchor="middle"
					font-size="12"
					fill="currentColor">{l}</text
				>
			{/if}
		{/each}
		<!-- lines -->
		{#each series as s (s.name)}
			<polyline
				fill="none"
				stroke={s.color}
				stroke-width="2.5"
				stroke-linejoin="round"
				stroke-linecap="round"
				points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
			/>
			{#each s.values as v, i (i)}
				<circle cx={x(i)} cy={y(v)} r={labels.length > 24 ? 2.5 : 4} fill={s.color}>
					<title>{s.name}, {labels[i]}: {v.toLocaleString()}</title>
				</circle>
			{/each}
		{/each}
	</svg>

	<div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
		{#each series as s (s.name)}
			<span class="inline-flex items-center gap-2">
				<span class="inline-block h-3 w-3 rounded-sm" style="background:{s.color}"></span>
				{s.name}
			</span>
		{/each}
	</div>

	<details class="mt-4">
		<summary class="cursor-pointer text-sm text-gray-600 dark:text-gray-400">Show the numbers</summary>
		<div class="mt-2 overflow-x-auto">
			<table class="min-w-full text-left text-sm text-gray-700 dark:text-gray-300">
				<thead class="text-xs text-gray-500 uppercase dark:text-gray-400">
					<tr>
						<th class="py-1 pe-4">Month</th>
						{#each series as s (s.name)}<th class="py-1 pe-4 text-right">{s.name}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each labels as l, i (i)}
						<tr class="border-t border-gray-200 dark:border-gray-700">
							<td class="py-1 pe-4">{l}</td>
							{#each series as s (s.name)}
								<td class="py-1 pe-4 text-right tabular-nums">{s.values[i].toLocaleString()}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</div>
