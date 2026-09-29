<script lang="ts">
	import { Button, Input, Label, Alert, DarkMode } from 'flowbite-svelte';
	import { EnvelopeSolid, LockSolid } from 'flowbite-svelte-icons';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	async function handleRegister(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';

		if (password !== confirmPassword) {
			errorMessage = 'Passwords do not match.';
			return;
		}

		if (password.length < 8) {
			errorMessage = 'Password must be at least 8 characters.';
			return;
		}

		loading = true;

		const { error } = await authClient.signUp.email({
			email,
			password,
			name: email.split('@')[0]
		});

		loading = false;

		if (error) {
			errorMessage = error.message ?? 'Unable to create your account. Please try again.';
			return;
		}

		await goto('/');
	}

</script>

<svelte:head>
	<title>Create account</title>
</svelte:head>

<div class="relative flex min-h-screen w-full flex-col md:flex-row">
	<!-- Dark mode toggle -->
	<div class="absolute right-4 top-4 z-10">
		<DarkMode class="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" />
	</div>

	<!-- Logo: compact strip on mobile, full left half from md up -->
	<div class="flex h-24 w-full flex-shrink-0 items-center justify-center bg-gray-50 p-4 dark:bg-gray-800 md:h-auto md:w-1/2 md:p-8">
		<img src="/logo.svg" alt="Company logo" class="h-full max-h-16 w-auto md:h-auto md:w-full md:max-h-none md:max-w-sm" />
	</div>

	<!-- Registration controls: takes remaining space on mobile, right half from md up -->
	<div class="flex w-full flex-1 items-center justify-center bg-white p-8 dark:bg-gray-900 md:w-1/2 md:flex-none">
		<div class="w-full max-w-sm space-y-6">
			<div class="space-y-1 text-center md:text-left">
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create your account</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400">Sign up to get started</p>
			</div>

			{#if errorMessage}
				<Alert color="red">{errorMessage}</Alert>
			{/if}

			<form class="space-y-4" onsubmit={handleRegister}>
				<div>
					<Label for="email" class="mb-2">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="you@example.com"
						required
						bind:value={email}
					>
						{#snippet left()}
							<EnvelopeSolid class="h-4 w-4 text-gray-500 dark:text-gray-400" />
						{/snippet}
					</Input>
				</div>

				<div>
					<Label for="password" class="mb-2">Password</Label>
					<Input
						id="password"
						type="password"
						placeholder="••••••••"
						required
						minlength={8}
						bind:value={password}
					>
						{#snippet left()}
							<LockSolid class="h-4 w-4 text-gray-500 dark:text-gray-400" />
						{/snippet}
					</Input>
				</div>

				<div>
					<Label for="confirm-password" class="mb-2">Confirm password</Label>
					<Input
						id="confirm-password"
						type="password"
						placeholder="••••••••"
						required
						minlength={8}
						bind:value={confirmPassword}
					>
						{#snippet left()}
							<LockSolid class="h-4 w-4 text-gray-500 dark:text-gray-400" />
						{/snippet}
					</Input>
				</div>

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Creating account…' : 'Create account'}
				</Button>
			</form>

			<p class="text-center text-sm text-gray-500 dark:text-gray-400">
				Already have an account?
				<a href="/login" class="font-medium text-primary-600 hover:underline dark:text-primary-500">
					Log in
				</a>
			</p>
		</div>
	</div>
</div>
