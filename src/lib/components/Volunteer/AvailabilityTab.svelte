<script lang="ts">
	import { Button, Label, Textarea } from 'flowbite-svelte';
	import { PERIODS, WEEKDAYS, slotKey } from '$lib/formschemas/volunteer';
	import FieldError from '$lib/components/FieldError.svelte';

	let { form, errors }: { form: any; errors: any } = $props();

	const has = (day: string, period: string) => $form.availability.slots.includes(slotKey(day as never, period as never));

	function toggle(day: string, period: string, on: boolean) {
		const key = slotKey(day as never, period as never);
		const rest: string[] = $form.availability.slots.filter((s: string) => s !== key);
		$form.availability.slots = on ? [...rest, key] : rest;
	}

	/** Ticks or clears a whole day (a row) or a whole time of day (a column). */
	function setAll(keys: string[], on: boolean) {
		const rest: string[] = $form.availability.slots.filter((s: string) => !keys.includes(s));
		$form.availability.slots = on ? [...rest, ...keys] : rest;
	}
	const rowKeys = (day: string) => PERIODS.map((p) => slotKey(day as never, p));
	const columnKeys = (period: string) => WEEKDAYS.map((d) => slotKey(d, period as never));
	const allOn = (keys: string[]) => keys.every((k) => $form.availability.slots.includes(k));
</script>

<section class="tab-section">
	<h2 class="section-title mb-1">Availability</h2>
	<p class="hint mb-4">Tick the times this volunteer is usually available. Select a day or a time of day to tick or clear the whole row or column.</p>

	<div class="overflow-x-auto">
		<table class="w-full text-center text-gray-900 dark:text-gray-100">
			<thead>
				<tr>
					<td class="p-0"></td>
					{#each PERIODS as period (period)}
						<th scope="col" class="font-medium">
							<Button type="button" size="xs" outline color="dark" onclick={() => setAll(columnKeys(period), !allOn(columnKeys(period)))}>{period}</Button>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each WEEKDAYS as day (day)}
					<tr class="border-t border-gray-200 dark:border-gray-700">
						<th scope="row" class="text-left font-medium">
							<Button type="button" size="xs" outline color="dark" onclick={() => setAll(rowKeys(day), !allOn(rowKeys(day)))}>{day}</Button>
						</th>
						{#each PERIODS as period (period)}
							<td>
								<input type="checkbox" aria-label="{day} {period.toLowerCase()}" checked={has(day, period)} onchange={(e) => toggle(day, period, (e.currentTarget as HTMLInputElement).checked)} />
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<FieldError messages={$errors.availability?.slots?._errors ?? $errors.availability?.slots} />

	<div class="mt-4">
		<Label for="availability-notes" class="mb-2">Notes</Label>
		<Textarea id="availability-notes" rows={3} bind:value={$form.availability.notes} />
		<FieldError messages={$errors.availability?.notes} />
	</div>
</section>
