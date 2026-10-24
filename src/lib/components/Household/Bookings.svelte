<script lang="ts">
	import {
		Select,
		Button,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { formattedDate, formattedDateTime } from '$lib/utils';
	import { invalidateAll } from '$app/navigation';
	import { appointmentBookingStatusOptions } from '$lib/labels';

	let { bookings } = $props();

	function addAppointment() {
		alert('under construction');
		invalidateAll();
	}

	// For now these only update the page; nothing is saved or sent yet.
	function sendBookingNotification(i: number) {
		bookings[i].notifications = new Date();
	}

	function sendBookingReminder(i: number) {
		bookings[i].reminders = new Date();
	}

	const linkClass =
		'text-primary-600 dark:text-primary-500 font-medium hover:underline';
</script>

{#snippet statusCell(i: number)}
	<Select items={appointmentBookingStatusOptions} bind:value={bookings[i].status} required />
{/snippet}

{#snippet sentOrSend(sentAt: any, onsend: () => void)}
	{#if sentAt != null}
		Sent: {formattedDate(sentAt)}
	{:else}
		<button type="button" class={linkClass} onclick={onsend}>Send</button>
	{/if}
{/snippet}

<!-- Heading and action, shared by both layouts -->
<div class="flex flex-wrap items-center justify-between gap-2 bg-white px-5 pb-3 pt-3 dark:bg-gray-800">
	<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Appointments</h2>
	<Button outline color="dark" onclick={addAppointment}>New Appointment</Button>
</div>

{#if bookings.length === 0}
	<p class="px-5 pb-5 text-gray-500 dark:text-gray-400">No appointments booked yet.</p>
{:else}
	<!-- Tablet and desktop: table -->
	<div class="hidden md:block">
		<Table striped={true}>
			<TableHead>
				<TableHeadCell>Date</TableHeadCell>
				<TableHeadCell>Status</TableHeadCell>
				<TableHeadCell>Notification</TableHeadCell>
				<TableHeadCell>Reminder</TableHeadCell>
			</TableHead>
			<TableBody>
				{#each bookings as _, i}
					<TableBodyRow>
						<TableBodyCell>
							{formattedDateTime(bookings[i].appointment.startTime)}
						</TableBodyCell>
						<TableBodyCell>
							{@render statusCell(i)}
						</TableBodyCell>
						<TableBodyCell>
							{@render sentOrSend(bookings[i].notifications, () => sendBookingNotification(i))}
						</TableBodyCell>
						<TableBodyCell>
							{@render sentOrSend(bookings[i].reminders, () => sendBookingReminder(i))}
						</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	</div>

	<!-- Phones: one card per booking -->
	<ul class="space-y-3 px-3 pb-4 md:hidden">
		{#each bookings as _, i}
			<li class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
				<div class="mb-2 font-semibold text-gray-900 dark:text-white">
					{formattedDateTime(bookings[i].appointment.startTime)}
				</div>

				{@render statusCell(i)}

				<dl class="mt-3 grid grid-cols-2 gap-3 text-sm">
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Notification</dt>
						<dd class="text-gray-900 dark:text-white">
							{@render sentOrSend(bookings[i].notifications, () => sendBookingNotification(i))}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Reminder</dt>
						<dd class="text-gray-900 dark:text-white">
							{@render sentOrSend(bookings[i].reminders, () => sendBookingReminder(i))}
						</dd>
					</div>
				</dl>
			</li>
		{/each}
	</ul>
{/if}