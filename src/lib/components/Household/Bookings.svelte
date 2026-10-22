<script lang="ts">
	import { Select, Button, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Modal } from "flowbite-svelte";
	import {formattedDate, formattedDateTime} from "$lib/utils"
  	import { invalidateAll } from '$app/navigation';
	import {appointmentBookingStatusOptions} from '$lib/labels'

    function addAppointment() {
		alert("under construction")
		invalidateAll()
	}

    function sendBookingNotification(i: number, event: MouseEvent) {
		event.preventDefault(); 
		bookings[i].notificationSent = new Date()
	}

	function sendBookingReminder(i: number, event: MouseEvent) {
		event.preventDefault(); 
		bookings[i].reminderSent = new Date()
	}

	let { bookings} = $props()
</script>
<Table striped={true}>
  	<caption class="bg-white px-5 pb-3 pt-1 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white">
    	<div class="flex items-center justify-between p-1">
      		<span>Appointments</span>
      		<Button outline color="dark" onclick={addAppointment}>
        		Book New Appointment
      		</Button>
    	</div>
  	</caption>
	<TableHead>
    	<TableHeadCell>Date</TableHeadCell>
		<TableHeadCell>Status</TableHeadCell>
		<TableHeadCell>Notification</TableHeadCell>
		<TableHeadCell>Reminder</TableHeadCell>
  	</TableHead>
  	<TableBody>
    	{#each bookings as item, i}
      		<TableBodyRow>	
				<TableBodyCell>
					{formattedDateTime(bookings[i].appointment.startTime) }
				</TableBodyCell>
				<TableBodyCell>
					<Select class="mb-2" items={appointmentBookingStatusOptions} bind:value={bookings[i].status} required/>
				</TableBodyCell>
				<TableBodyCell>
					{#if bookings[i].notifications !== null}
						Sent: {formattedDate(bookings[i].notifications)}
					{:else}
					    <a href="/" onclick={(event) => sendBookingNotification(i,event)} class="text-primary-600 dark:text-primary-500 font-medium hover:underline">	
							Send
						</a>
					{/if}
				</TableBodyCell>
				<TableBodyCell>
					{#if bookings[i].reminders !== null}
						Sent: {formattedDate(bookings[i].reminders)}
					{:else}
					    <a href="/" onclick={(event) => sendBookingReminder(i,event)} class="text-primary-600 dark:text-primary-500 font-medium hover:underline">	
							Send
						</a>
					{/if}
				</TableBodyCell>
      		</TableBodyRow>	
			{/each}

	</TableBody>
</Table>