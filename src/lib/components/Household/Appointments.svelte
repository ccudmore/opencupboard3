<script lang="ts">
	import { Select, Button, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Modal } from "flowbite-svelte";
	import {formattedDate, formattedDateTime} from "$lib/utils"
  	import { invalidateAll } from '$app/navigation';

    function addAppointment() {
		alert("under construction")
		invalidateAll()
	}

    function sendBookingNotification(i: number, event: MouseEvent) {
		event.preventDefault(); 
		$form.appointmentBookings[i].notificationSent = new Date()
	}

	function sendBookingReminder(i: number, event: MouseEvent) {
		event.preventDefault(); 
		$form.appointmentBookings[i].reminderSent = new Date()
	}

	let { form, errors, constraints} = $props()

	const validStatus = [
    	{ value: "No Show", name: "No Show" },
    	{ value: "Booked", name: "Booked" },
    	{ value: "Cancelled", name: "Cancelled" },
	]

</script>

<Table striped={true}>
  	<caption class="bg-white p-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white">
		Appointments
  	</caption>
	<TableHead>
    	<TableHeadCell>Date</TableHeadCell>
		<TableHeadCell>Status</TableHeadCell>
		<TableHeadCell>Notification</TableHeadCell>
		<TableHeadCell>Reminder</TableHeadCell>
  	</TableHead>
  	<TableBody>
    	{#each $form.appointmentBookings as item, i}
      		<TableBodyRow>	
				<TableBodyCell>
					{formattedDateTime($form.appointmentBookings[i].appointment.startTime) }
				</TableBodyCell>
				<TableBodyCell>
					<Select class="mb-2" items={validStatus} bind:value={$form.appointmentBookings[i].status} {...$constraints.appointmentBookings?.status} required/>
				</TableBodyCell>
				<TableBodyCell>
					{#if $form.appointmentBookings[i].notificationSent !== null}
						Sent: {formattedDate($form.appointmentBookings[i].notificationSent)}
					{:else}
					    <a href="/" onclick={(event) => sendBookingNotification(i,event)} class="text-primary-600 dark:text-primary-500 font-medium hover:underline">	
							Send
						</a>
					{/if}
				</TableBodyCell>
				<TableBodyCell>
					{#if $form.appointmentBookings[i].reminderSent !== null}
						Sent: {formattedDate($form.appointmentBookings[i].reminderSent)}
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
<Button outline color="dark" onclick={addAppointment}>Book Appointment</Button><br>
