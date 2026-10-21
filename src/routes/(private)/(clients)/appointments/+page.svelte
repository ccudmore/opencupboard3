<script lang="ts">
	    import type { JsonValue } from '@prisma/client/runtime/client';
import { Accordion, AccordionItem, Badge } from 'flowbite-svelte';
    	import { onMount } from 'svelte';

	let { data } = $props();


	function formatDate(iso: string) {
		// Parse as UTC so the date doesn't shift with the viewer's timezone
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}

//    	const isActive = (b: Booking) => b.status.toLowerCase() === 'active';
//	const firstActive = (a: Appointment) => a.bookings.find(isActive);
	const firstActive = (a: { id: string; startTime: Date; endTime: Date; status: string | null; locationId: string; createdAt: Date; createdBy: string | null; confirmations: JsonValue | null; reminders: JsonValue | null; householdId: string | null; eventId: string; }) => 1;
 
	let scrollEl: HTMLDivElement;
    let openAppts = $state<Record<string, boolean>>({});


	onMount(() => {
		const now = Date.now();
//		let idx = data.services.findIndex((s) => new Date(s.startDate).getTime() > now);
//		if (idx === -1) idx = data.services.length - 1; // everything is in the past: show the latest
//		const el = scrollEl?.querySelector<HTMLElement>(`[data-service="${idx}"]`);
//		if (el) scrollEl.scrollTop = el.offsetTop;
	});
</script>

<!--
<div class="mx-auto max-w-3xl p-4">
	<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Services</h1>
 
	<div bind:this={scrollEl} class="relative max-h-128 overflow-y-auto">
		{#each data.services as service, si}
			<div data-service={si} class="mb-2">
				<Accordion multiple>
					<AccordionItem>
						{#snippet header()}
							<div class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 pr-2">
								<span class="font-semibold capitalize">{service.title}</span>
								<span class="text-sm text-gray-500 dark:text-gray-400">
                                    {service.startTime}
								</span>
								<span class="ml-auto flex gap-2">
                                Availability counts go here
									<Badge color="blue">Available: {service.available}</Badge>
									<Badge color="purple">Taken: {service.taken}</Badge>
								</span>
							</div>
						{/snippet}
 
						{#snippet children()}
							<Accordion multiple flush>
								{#each service.appointments as appointment, ai}
									{@const key = `${si}-${ai}`}
									{@const active = firstActive(appointment)}
									<AccordionItem bind:open={openAppts[key]}>
										{#snippet header()}
											<div class="flex w-full items-center gap-3 pr-2">
												<span class="font-medium">{appointment.startTime}</span>
                                                show number of bookings
												<Badge color="gray">
													{appointment.bookings.length}
													{appointment.bookings.length === 1 ? 'booking' : 'bookings'}
												</Badge>
												{#if active && !openAppts[key]}
													<span class="text-sm text-gray-600 dark:text-gray-300">
														{active.firstName} {active.lastName}
													</span>
												{/if}
											</div>
										{/snippet}
 
										{#snippet children()}
											<ul class="divide-y divide-gray-200 dark:divide-gray-700">
												{#each appointment.bookings as booking}
													<li class="flex items-center justify-between py-2">
														<span class="text-gray-900 dark:text-white">
															{booking.firstName} {booking.lastName}
														</span>
														<Badge color={isActive(booking) ? 'green' : 'red'}>
															{booking.status}
														</Badge>
													</li>
												{:else}
													<li class="py-2 text-sm text-gray-500">No bookings</li>
												{/each}
											</ul>
										{/snippet}
									</AccordionItem>
								{/each}
							</Accordion>
						{/snippet}
					</AccordionItem>
				</Accordion>
			</div>
		{/each}
	</div>
</div>
-->