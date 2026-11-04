<script lang="ts">
	import { Tabs, TabItem, Badge } from 'flowbite-svelte';
	import { AddressBookSolid, AwardSolid, CalendarMonthSolid, ClockSolid, FileSolid, LockSolid, BookOpenSolid } from 'flowbite-svelte-icons';
	import ContactTab from './ContactTab.svelte';
	import SkillsTab from './SkillsTab.svelte';
	import AvailabilityTab from './AvailabilityTab.svelte';
	import CoursesTab from './CoursesTab.svelte';
	import LoginTab from './LoginTab.svelte';
	import Assignments from './Assignments.svelte';
	import Documents from './Documents.svelte';

	// The profile tabs (Contact/Address, Skills, Availability, Courses) edit the page's one Superforms form, saved
	// with the Save button above. Login, Events and Documents save with their own requests.
	let { form, errors, data, volunteerId }: { form: any; errors: any; data: any; volunteerId: string } = $props();
</script>

<div class="tabs-scroll p-1">
	<Tabs tabStyle="underline" divider={false} class="tabs-panel">
		<TabItem open>
			{#snippet titleSlot()}<div class="flex items-center gap-2"><AddressBookSolid size="md" />Contact</div>{/snippet}
			<ContactTab {form} {errors} loginEmail={data.account?.email ?? ''} />
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}<div class="flex items-center gap-2"><AwardSolid size="md" />Skills</div>{/snippet}
			<SkillsTab {form} />
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}<div class="flex items-center gap-2"><ClockSolid size="md" />Availability</div>{/snippet}
			<AvailabilityTab {form} {errors} />
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}<div class="flex items-center gap-2"><BookOpenSolid size="md" />Courses</div>{/snippet}
			<CoursesTab {form} {errors} />
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}<div class="flex items-center gap-2"><LockSolid size="md" />Login</div>{/snippet}
			<LoginTab account={data.account} status={data.status} assignmentCount={data.assignmentCount} documentCount={data.documents.length} />
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}
				<div class="flex items-center gap-2"><CalendarMonthSolid size="md" />Events{#if data.assignments.length}<Badge>{data.assignments.length}</Badge>{/if}</div>
			{/snippet}
			<Assignments {volunteerId} assignments={data.assignments} events={data.events} emailEnabled={data.emailEnabled} />
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}
				<div class="flex items-center gap-2"><FileSolid size="md" />Documents{#if data.documents.length}<Badge>{data.documents.length}</Badge>{/if}</div>
			{/snippet}
			<Documents {volunteerId} documents={data.documents} accept={data.accept} maxMb={data.maxMb} />
		</TabItem>
	</Tabs>
</div>
