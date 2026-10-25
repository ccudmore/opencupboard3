<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { enhance as plainEnhance } from '$app/forms';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		Breadcrumb,
		BreadcrumbItem,
		Button,
		ButtonGroup,
		Helper,
		Input,
		Label,
		Modal,
		Textarea
	} from 'flowbite-svelte';
	import { HomeOutline, ChevronDoubleRightOutline, PlusOutline, TrashBinOutline, ExclamationCircleOutline } from 'flowbite-svelte-icons';
	import { volunteerSchema, WEEKDAYS } from '$lib/formschemas/volunteer';
	import Documents from '$lib/components/Volunteer/Documents.svelte';
	import Assignments from '$lib/components/Volunteer/Assignments.svelte';

	let { data } = $props();

	// superForm only needs the initial value; it manages its own state afterwards
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, message, tainted, isTainted }: any = superForm(data.form, {
		taintedMessage: 'Are you sure you want to leave? Your changes will not be saved.',
		dataType: 'json', // the form has a list (training courses)
		validators: zod4Client(volunteerSchema),
		resetForm: false,
		onUpdated({ form }) {
			if (form.message) toast(form.message);
			else if (!form.valid) toast('Please fix the highlighted fields.');
		},
		onError({ result }) {
			toast(`Error: ${result.error.message}`);
		}
	});

	let deleteOpen = $state(false);

	// Nothing is saved until Save is clicked; Close leaves the page and the edits are discarded
	function close() {
		goto('/volunteers');
	}

	const title = $derived(data.isNew ? 'New volunteer' : `${$form.firstName} ${$form.lastName}`.trim() || 'Volunteer');

	// Native checkboxes, styled so they are clear in light and dark mode
	const checkClass = 'h-5 w-5 shrink-0 cursor-pointer rounded accent-primary-600 dark:accent-primary-400';

	function addCourse() {
		$form.trainingCourses = [...$form.trainingCourses, { name: '', completed: '' }];
	}
	function removeCourse(i: number) {
		$form.trainingCourses = $form.trainingCourses.filter((_: unknown, n: number) => n !== i);
	}

	function toggleDay(day: string, on: boolean) {
		const days: string[] = $form.availability.days.filter((d: string) => d !== day);
		if (on) days.push(day);
		// keep Monday..Sunday order
		$form.availability.days = WEEKDAYS.filter((d) => days.includes(d));
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#snippet fieldError(messages: string[] | undefined)}
	{#if messages && messages.length}
		<Helper color="red" class="mt-1">{messages.join(', ')}</Helper>
	{/if}
{/snippet}

<form method="POST" action="?/save" use:enhance>
	<!-- Navigation and actions, as on the household page -->
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-gray-50 px-3 py-2 sm:px-5 dark:bg-gray-900">
		<a href="/volunteers" class="text-sm font-medium text-blue-700 hover:underline sm:hidden dark:text-blue-400">‹ Volunteers</a>
		<div class="hidden sm:block">
			<Breadcrumb>
	<BreadcrumbItem href="/" home>
		{#snippet icon()}
			<HomeOutline class="me-2 h-4 w-4" />
		{/snippet}Home
	</BreadcrumbItem>
	<BreadcrumbItem href="/volunteers">
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}
		Volunteers
	</BreadcrumbItem>
	<BreadcrumbItem>
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}
		{data.isNew ? 'New' : title}
	</BreadcrumbItem>
</Breadcrumb>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			{#if isTainted($tainted)}
				<span
					role="status"
					class="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
				>
					<ExclamationCircleOutline class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
					Unsaved changes
				</span>
			{/if}
			<ButtonGroup class="*:ring-primary-700!">
				<Button outline size="md" type="submit" disabled={$submitting} class="px-4 font-semibold sm:px-6">{$submitting ? 'Saving…' : 'Save'}</Button>
				<Button outline size="md" type="button" onclick={close} class="px-4 font-semibold sm:px-6">Close</Button>
			</ButtonGroup>
		</div>
	</div>

	<div class="mx-auto w-full max-w-4xl min-w-0 space-y-6 p-3 sm:p-5">
		<h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
<!-- Name and contact -->
		<section class="rounded-lg bg-white p-4 shadow-md sm:p-5 dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Contact</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div class="min-w-0">
					<Label for="firstName" class="mb-2">First name</Label>
					<Input id="firstName" autocomplete="off" bind:value={$form.firstName} />
					{@render fieldError($errors.firstName)}
				</div>
				<div class="min-w-0">
					<Label for="lastName" class="mb-2">Last name</Label>
					<Input id="lastName" autocomplete="off" bind:value={$form.lastName} />
					{@render fieldError($errors.lastName)}
				</div>
				<div class="min-w-0">
					<Label for="email1" class="mb-2">Email</Label>
					<Input id="email1" type="email" autocomplete="off" bind:value={$form.email1} />
					{@render fieldError($errors.email1)}
				</div>
				<div class="min-w-0">
					<Label for="email2" class="mb-2">Second email</Label>
					<Input id="email2" type="email" autocomplete="off" bind:value={$form.email2} />
					{@render fieldError($errors.email2)}
				</div>
				<div class="min-w-0">
					<Label for="phone1" class="mb-2">Phone</Label>
					<Input id="phone1" type="tel" autocomplete="off" bind:value={$form.phone1} />
					{@render fieldError($errors.phone1)}
				</div>
				<div class="min-w-0">
					<Label for="phone2" class="mb-2">Second phone</Label>
					<Input id="phone2" type="tel" autocomplete="off" bind:value={$form.phone2} />
					{@render fieldError($errors.phone2)}
				</div>
			</div>
		</section>

		<!-- Address -->
		<section class="rounded-lg bg-white p-4 shadow-md sm:p-5 dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Address</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div class="min-w-0 md:col-span-2">
					<Label for="street" class="mb-2">Street</Label>
					<Input id="street" autocomplete="off" bind:value={$form.street} />
					{@render fieldError($errors.street)}
				</div>
				<div class="min-w-0">
					<Label for="city" class="mb-2">City</Label>
					<Input id="city" autocomplete="off" bind:value={$form.city} />
					{@render fieldError($errors.city)}
				</div>
				<div class="min-w-0">
					<Label for="postalCode" class="mb-2">Postal code</Label>
					<Input id="postalCode" autocomplete="off" bind:value={$form.postalCode} />
					{@render fieldError($errors.postalCode)}
				</div>
				<div class="min-w-0">
					<Label for="province" class="mb-2">Province</Label>
					<Input id="province" autocomplete="off" bind:value={$form.province} />
					{@render fieldError($errors.province)}
				</div>
				<div class="min-w-0">
					<Label for="country" class="mb-2">Country</Label>
					<Input id="country" autocomplete="off" bind:value={$form.country} />
					{@render fieldError($errors.country)}
				</div>
			</div>
		</section>

		<!-- Availability -->
		<section class="rounded-lg bg-white p-4 shadow-md sm:p-5 dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Availability</h2>
			<fieldset>
				<legend class="mb-2 text-sm font-medium text-gray-900 dark:text-white">Days available</legend>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each WEEKDAYS as day (day)}
						<label class="flex cursor-pointer items-center gap-2 text-gray-900 dark:text-gray-100">
							<input
								type="checkbox"
								class={checkClass}
								checked={$form.availability.days.includes(day)}
								onchange={(e) => toggleDay(day, (e.currentTarget as HTMLInputElement).checked)}
							/>
							{day}
						</label>
					{/each}
				</div>
			</fieldset>
			<div class="mt-4 min-w-0">
				<Label for="availability-notes" class="mb-2">Notes</Label>
				<Textarea
					id="availability-notes"
					rows={3}
					class="block w-full max-w-full min-w-0"
					bind:value={$form.availability.notes}
				/>
				{@render fieldError($errors.availability?.notes)}
			</div>
		</section>

		<!-- Training -->
		<section class="rounded-lg bg-white p-4 shadow-md sm:p-5 dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Training courses</h2>
			{#if $form.trainingCourses.length === 0}
				<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">No courses recorded.</p>
			{/if}
			<div class="space-y-3">
				{#each $form.trainingCourses as _course, i (i)}
					<div class="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_11rem_auto]">
						<div class="min-w-0">
							<Label for={`course-name-${i}`} class="mb-1 sm:sr-only">Course</Label>
							<Input id={`course-name-${i}`} placeholder="Course name" bind:value={$form.trainingCourses[i].name} />
							{@render fieldError($errors.trainingCourses?.[i]?.name)}
						</div>
						<div class="min-w-0">
							<Label for={`course-date-${i}`} class="mb-1 sm:sr-only">Completed</Label>
							<Input id={`course-date-${i}`} type="date" bind:value={$form.trainingCourses[i].completed} />
							{@render fieldError($errors.trainingCourses?.[i]?.completed)}
						</div>
						<Button type="button" outline color="red" size="sm" aria-label="Remove course" onclick={() => removeCourse(i)}>
							<TrashBinOutline class="h-4 w-4" />
						</Button>
					</div>
				{/each}
			</div>
			<Button type="button" outline color="dark" size="sm" class="mt-3" onclick={addCourse}>
				<PlusOutline class="mr-2 h-3.5 w-3.5" />Add course
			</Button>
		</section>

		{#if $message && typeof $message === 'string'}
			<p class="text-sm text-gray-700 dark:text-gray-200" role="status">{$message}</p>
		{/if}

		<div class="flex flex-wrap gap-2">
			<Button type="submit" color="dark" disabled={$submitting}>{$submitting ? 'Saving…' : 'Save'}</Button>
			<Button type="button" outline color="dark" onclick={close}>Close</Button>
			{#if !data.isNew}
				<Button type="button" outline color="red" class="sm:ml-auto" onclick={() => (deleteOpen = true)}>
					Delete volunteer
				</Button>
			{/if}
		</div>
	</div>
</form>

<div class="mx-auto w-full max-w-4xl min-w-0 px-3 pb-5 sm:px-5">
	<!-- Outside the form above: these save with their own requests -->
	<div class="mt-1">
		<Assignments
			volunteerId={data.isNew ? null : (page.params.volunteerId ?? null)}
			assignments={data.assignments}
			events={data.events}
			emailEnabled={data.emailEnabled}
		/>
	</div>

	<div class="mt-6">
		<Documents
			volunteerId={data.isNew ? null : (page.params.volunteerId ?? null)}
			documents={data.documents}
			accept={data.accept}
			maxMb={data.maxMb}
		/>
	</div>
</div>

<!-- A separate form, outside the one above: forms can't be nested -->
<Modal title="Delete volunteer" bind:open={deleteOpen} size="xs">
	<p class="text-gray-600 dark:text-gray-300">
		Delete {title}?
		{#if data.assignmentCount > 0}
			They will also be removed from {data.assignmentCount}
			{data.assignmentCount === 1 ? 'event' : 'events'}, including past ones.
		{/if}
		{#if data.documents.length > 0}
			Their {data.documents.length} uploaded {data.documents.length === 1 ? 'document' : 'documents'} will be deleted too.
		{/if}
		This can't be undone.
	</p>
	{#snippet footer()}
		<form method="POST" action="?/delete" use:plainEnhance class="flex gap-2">
			<Button type="submit" color="red">Yes, delete</Button>
			<Button type="button" outline color="dark" onclick={() => (deleteOpen = false)}>Cancel</Button>
		</form>
	{/snippet}
</Modal>