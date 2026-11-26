<script lang="ts">
	let {
		labels,
		values,
		color = '#2563eb',
		format = (v: number) => v.toLocaleString(),
		tickFormat = format,
		seriesName = 'Value',
		ariaLabel = 'Chart'
	}: {
		labels: string[];
		values: number[];
		color?: string;
		/** for the numbers above the bars and in the tooltips */
		format?: (v: number) => string;
		/** for the labels down the side */
		tickFormat?: (v: number) => string;
		seriesName?: string;
		ariaLabel?: string;
	} = $props();

	const W = 800;
	const H = 340;
	const M = { top: 24, right: 20, bottom: 44, left: 64 };
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;

	const yAxis = $derived.by(() => {
		const max = Math.max(1, ...values);
		const rough = max / 5;
		const pow = Math.pow(10, Math.floor(Math.log10(rough)));
		const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
		const top = Math.ceil(max / step) * step;
		const ticks: number[] = [];
		for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
		return { top, ticks };
	});

	const slot = $derived(plotW / labels.length);
	const barW = $derived(Math.min(56, slot * 0.7));
	const x = (i: number) => M.left + slot * i + slot / 2;
	const y = (v: number) => M.top + plotH - (v / yAxis.top) * plotH;
	const labelEvery = $derived(Math.ceil(labels.length / 8));
	const showLabel = (i: number) => (labels.length - 1 - i) % labelEvery === 0;
	const showValues = $derived(labels.length <= 12);
</script>

<div class="w-full text-gray-500 dark:text-gray-400">
	<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img" aria-label={ariaLabel}>
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
				fill="currentColor">{tickFormat(t)}</text
			>
		{/each}
		{#each values as v, i (i)}
			{#if v > 0}
				<rect x={x(i) - barW / 2} y={y(v)} width={barW} height={y(0) - y(v)} rx="2" fill={color}>
					<title>{seriesName}, {labels[i]}: {format(v)}</title>
				</rect>
			{/if}
			{#if showValues && v > 0}
				<text x={x(i)} y={y(v) - 6} text-anchor="middle" font-size="11" fill="currentColor"
					>{format(v)}</text
				>
			{/if}
		{/each}
		{#each labels as l, i (i)}
			{#if showLabel(i)}
				<text x={x(i)} y={H - M.bottom + 18} text-anchor="middle" font-size="12" fill="currentColor"
					>{l}</text
				>
			{/if}
		{/each}
	</svg>
</div>
