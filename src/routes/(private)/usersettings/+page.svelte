<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { Alert, Breadcrumb, BreadcrumbItem, Button, Card, Helper, Input, Label, Spinner } from 'flowbite-svelte';
	import { HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';
	import { page } from '$app/state';
	import { AVATARS } from '$lib/avatars';
	import { emailSchema, iconSchema } from '$lib/formschemas/usersettings';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const emailF: any = superForm(data.emailForm, {
		validators: zod4Client(emailSchema),
		resetForm: false,
		onUpdated({ form }) {
			if (form.message) toast(form.message);
			if (form.valid && form.message) invalidateAll(); // refresh the email shown in the menu
		},
		onError({ result }) {
			toast(`Error: ${result.error.message}`);
		}
	});
	const { form: emailForm, errors: emailErrors, enhance: emailEnhance, submitting: emailSubmitting, message: emailMessage } = emailF;

	// svelte-ignore state_referenced_locally
	const iconF: any = superForm(data.iconForm, {
		validators: zod4Client(iconSchema),
		resetForm: false,
		onUpdated({ form }) {
			if (form.message) toast(form.message);
			if (form.valid) invalidateAll(); // refresh the icon in the menu
		},
		onError({ result }) {
			toast(`Error: ${result.error.message}`);
		}
	});
	const { form: iconForm, errors: iconErrors, enhance: iconEnhance, submitting: iconSubmitting, tainted: iconTainted } = iconF;

	const currentImage = $derived(page.data.user?.image ?? '');
	const emailFailed = $derived(!!$emailMessage && !String($emailMessage).startsWith('Your email address has been updated'));
</script>

<svelte:head>
	<title>My settings</title>
</svelte:head>

<Breadcrumb class="bg-gray-50 px-5 py-3 dark:bg-gray-900">
	<BreadcrumbItem href="/" home>
		{#snippet icon()}
			<HomeOutline class="me-2 h-4 w-4" />
		{/snippet}Home
	</BreadcrumbItem>
	<BreadcrumbItem href="/usersettings">
		{#snippet icon()}
			<ChevronDoubleRightOutline class="mx-2 h-5 w-5 dark:text-white" />
		{/snippet}
		My settings
	</BreadcrumbItem>
</Breadcrumb>

<div class="bg-gray-50 p-3 sm:p-5 dark:bg-gray-900">
	<div class="mx-auto w-full max-w-2xl min-w-0 space-y-6">
		<!-- Icon -->
		<Card class="max-w-none p-4 sm:p-6">
			<div class="mb-4 flex items-center gap-4">
				<UserAvatar image={currentImage} size="lg" />
				<div class="min-w-0">
					<h1 class="text-xl font-semibold text-gray-900 dark:text-white">My icon</h1>
					<p class="text-sm text-gray-600 dark:text-gray-300">Pick the icon shown beside your name.</p>
				</div>
			</div>

			<form method="POST" action="?/icon" use:iconEnhance>
				<fieldset>
					<legend class="sr-only">Choose an icon</legend>
					<div class="grid grid-cols-4 gap-2 sm:grid-cols-6">
						{#each AVATARS as a (a.key)}
							<label class="relative cursor-pointer">
								<input type="radio" name="icon" value={a.key} bind:group={$iconForm.icon} class="peer sr-only" />
								<span
									class="flex aspect-square items-center justify-center rounded-xl border-2 border-transparent text-3xl
									       hover:bg-gray-100 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400
									       dark:hover:bg-gray-700 dark:peer-checked:border-blue-400 dark:peer-checked:bg-gray-700"
									title={a.label}
								>
									<span class="flex h-12 w-12 items-center justify-center rounded-full leading-none" style="background-color: {a.bg}">{a.emoji}</span>
									<span class="sr-only">{a.label}</span>
								</span>
							</label>
						{/each}
					</div>
				</fieldset>
				{#if $iconErrors.icon}<Helper color="red" class="mt-2">{$iconErrors.icon.join(', ')}</Helper>{/if}
				<div class="mt-4">
					<Button type="submit" color="dark" disabled={$iconSubmitting || !$iconForm.icon}>
						{#if $iconSubmitting}<Spinner class="me-2" size="4" />Saving…{:else}Save icon{/if}
					</Button>
				</div>
			</form>
		</Card>

		<!-- Email -->
		<Card class="max-w-none p-4 sm:p-6">
			<h2 class="mb-1 text-xl font-semibold text-gray-900 dark:text-white">Email address</h2>
			<p class="mb-4 text-sm wrap-break-word text-gray-600 dark:text-gray-300">
				You sign in with this address. Currently {page.data.user?.email}.
			</p>

			{#if !data.hasPassword}
				<Alert color="blue">Your email address is managed by your Google or Microsoft account, so it can't be changed here.</Alert>
			{:else}
				<form method="POST" action="?/email" use:emailEnhance class="space-y-4">
					{#if $emailMessage}
						<Alert color={emailFailed ? 'red' : 'green'} role={emailFailed ? 'alert' : 'status'}>{$emailMessage}</Alert>
					{/if}
					<div>
						<Label for="email" class="mb-2">New email address</Label>
						<Input id="email" name="email" type="email" autocomplete="email" bind:value={$emailForm.email} color={$emailErrors.email ? 'red' : undefined} />
						{#if $emailErrors.email}<Helper color="red" class="mt-1">{$emailErrors.email.join(', ')}</Helper>{/if}
					</div>
					<div>
						<Label for="password" class="mb-2">Your password</Label>
						<Input id="password" name="password" type="password" autocomplete="current-password" bind:value={$emailForm.password} color={$emailErrors.password ? 'red' : undefined} />
						{#if $emailErrors.password}
							<Helper color="red" class="mt-1">{$emailErrors.password.join(', ')}</Helper>
						{:else}
							<Helper class="mt-1">Enter your password to confirm the change.</Helper>
						{/if}
					</div>
					<Button type="submit" color="dark" disabled={$emailSubmitting}>
						{#if $emailSubmitting}<Spinner class="me-2" size="4" />Saving…{:else}Update email{/if}
					</Button>
				</form>
			{/if}
		</Card>
	</div>
</div>
