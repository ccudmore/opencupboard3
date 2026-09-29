<script lang="ts">
	import { Button, Input, Label, Alert, DarkMode } from 'flowbite-svelte';
	import { EnvelopeSolid, LockSolid } from 'flowbite-svelte-icons';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public'

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	const redirectTo = page.url.searchParams.get('redirectTo') ?? '/'
  	const organizationName = env.PUBLIC_ORGANIZATION_NAME ?? 'Open Cupboard'

	async function handleEmailLogin(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		loading = true;

		const { error } = await authClient.signIn.email({
			email,
			password
		});

		loading = false;

		if (error) {
			errorMessage = error.message ?? 'Unable to sign in. Check your credentials and try again.';
			return;
		}

		await goto(redirectTo);
	}

	async function handleSocialLogin(provider: 'google' | 'microsoft') {
		errorMessage = '';
		await authClient.signIn.social({
			provider,
			callbackURL: redirectTo
		});
	}
</script>

<svelte:head>
	<title>Log in</title>
</svelte:head>

<div class="relative flex min-h-screen w-full flex-col md:flex-row">
	<!-- Dark mode toggle -->
	<div class="absolute right-4 top-4 z-10">
		<DarkMode class="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" />
	</div>

	<!-- Logo: compact strip on mobile, full left half from md up -->
	<div class="flex h-24 w-full shrink-0 items-center justify-center bg-gray-50 p-4 dark:bg-gray-800 md:h-auto md:w-1/2 md:p-8">
		<div class="w-full max-w-sm space-y-6 flex flex-col items-center">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{organizationName}</h1>
			<img src="/images/logo.svg" alt="Organization logo" class="h-full max-h-16 w-auto md:h-auto md:w-full md:max-h-none md:max-w-sm" />
		</div>
	</div>

	<!-- Login controls: takes remaining space on mobile, right half from md up -->
	<div class="flex w-full flex-1 items-center justify-center bg-white p-8 dark:bg-gray-900 md:w-1/2 md:flex-none">
		<div class="w-full max-w-sm space-y-6">
			<div class="space-y-1 text-center md:text-left">
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400">Log in to your account to continue</p>
			</div>

			{#if errorMessage}
				<Alert color="red">{errorMessage}</Alert>
			{/if}

			<form class="space-y-4" onsubmit={handleEmailLogin}>
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
						bind:value={password}
					>
						{#snippet left()}
							<LockSolid class="h-4 w-4 text-gray-500 dark:text-gray-400" />
						{/snippet}
					</Input>
				</div>

				<div class="flex items-center justify-end">
					<a href="/forgot-password" class="text-sm text-primary-600 hover:underline dark:text-primary-500">
						Forgot password?
					</a>
				</div>

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Signing in…' : 'Sign in'}
				</Button>
			</form>

			<div class="flex items-center gap-3">
				<div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
				<span class="text-xs uppercase text-gray-400">or continue with</span>
				<div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
			</div>
<!-- craig clean this up -->
			<div class="space-y-3">
				<Button color="alternative" class="w-full" onclick={() => handleSocialLogin('google')}>
					<svg class="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.89c2.27-2.09 3.53-5.17 3.53-8.66z"/>
						<path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.89-3c-1.08.72-2.45 1.15-4.05 1.15-3.12 0-5.76-2.1-6.7-4.93H1.3v3.1A12 12 0 0 0 12 24z"/>
						<path fill="#FBBC05" d="M5.3 14.31A7.2 7.2 0 0 1 4.92 12c0-.8.14-1.58.38-2.31v-3.1H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.4l4-3.1z"/>
						<path fill="#EA4335" d="M12 4.76c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.23 0 12 0 7.31 0 3.26 2.69 1.3 6.6l4 3.1c.94-2.83 3.58-4.93 6.7-4.93z"/>
					</svg>
					Continue with Google
				</Button>

				<Button color="alternative" class="w-full" onclick={() => handleSocialLogin('microsoft')}>
					<svg class="mr-2 h-4 w-4" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
						<path fill="#F25022" d="M1 1h10v10H1z"/>
						<path fill="#7FBA00" d="M12 1h10v10H12z"/>
						<path fill="#00A4EF" d="M1 12h10v10H1z"/>
						<path fill="#FFB900" d="M12 12h10v10H12z"/>
					</svg>
					Continue with Microsoft
				</Button>
			</div>

			<p class="text-center text-sm text-gray-500 dark:text-gray-400">
				Don't have an account?
				<a href="/register" class="font-medium text-primary-600 hover:underline dark:text-primary-500">
					Sign up
				</a>
			</p>
		</div>
	</div>
</div>
