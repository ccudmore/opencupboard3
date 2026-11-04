<script lang="ts">
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Alert, Button, ButtonGroup } from 'flowbite-svelte';
	import { ExclamationCircleOutline } from 'flowbite-svelte-icons';
	import { volunteerSchema } from '$lib/formschemas/volunteer';
	import TabView from '$lib/components/Volunteer/TabView.svelte';

	let { data } = $props();

	// superForm only needs the initial value; it manages its own state afterwards
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, message, tainted, isTainted }: any = superForm(data.form, {
		taintedMessage: 'Are you sure you want to leave? Your changes will not be saved.',
		dataType: 'json', // the form has lists (skills, training courses), sent from the store, not the page
		validators: zod4Client(volunteerSchema),
		resetForm: false,
		onUpdated({ form }) {
			if (form.message) toast(form.message);
			else if (!form.valid) toast('Please fix the highlighted fields on the Contact, Skills, Availability or Courses tab.');
		},
		onError({ result }) {
			toast(`Error: ${result.error.message}`);
		}
	});

	// Nothing is saved until Save is clicked; Close leaves the page and the edits are discarded
	function close() {
		goto('/volunteers');
	}

	const title = $derived(`${$form.firstName} ${$form.lastName}`.trim() || 'Volunteer');
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<!-- Navigation and actions. The form is only the buttons: the fields are saved from the form's data, wherever they are on the page -->
<form method="POST" action="?/save" use:enhance class="page-bar">
	<a href="/volunteers" class="text-sm font-medium text-blue-700 hover:underline sm:hidden dark:text-blue-400">‹ Volunteers</a>
	<div class="hidden sm:block">
		<PageBreadcrumb items={[{ label: 'Volunteers', href: '/volunteers' }, { label: `${title}` }]} />
	</div>
	<div class="flex flex-wrap items-center gap-3">
		{#if isTainted($tainted)}
			<span role="status" class="unsaved-badge">
				<ExclamationCircleOutline class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
				Unsaved changes
			</span>
		{/if}
		<ButtonGroup class="*:ring-primary-700!">
			<Button outline size="md" type="submit" disabled={$submitting} class="px-4 font-semibold sm:px-6">{$submitting ? 'Saving…' : 'Save'}</Button>
			<Button outline size="md" type="button" onclick={close} class="px-4 font-semibold sm:px-6">Close</Button>
		</ButtonGroup>
	</div>
</form>

<div class="mx-auto w-full max-w-4xl min-w-0 space-y-3 p-3 sm:p-5">
	<h1>{title}</h1>
	{#if data.status === 'ARCHIVED'}
		<Alert color="yellow">This volunteer is archived. Restore them on the Login tab to use them again.</Alert>
	{/if}
	{#if $message && typeof $message === 'string'}
		<p class="text-sm text-gray-700 dark:text-gray-200" role="status">{$message}</p>
	{/if}

	<TabView {form} {errors} {data} volunteerId={page.params.volunteerId ?? ''} />
</div>
