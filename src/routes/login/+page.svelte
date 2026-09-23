<script lang="ts">
	import { signIn } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	const redirectTo = page.url.searchParams.get('redirectTo') || '/dashboard';

	async function handlePasswordLogin(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		loading = true;

		const { error } = await signIn.email({ email, password });

		loading = false;
		if (error) {
			errorMessage = error.message ?? 'Sign in failed';
			return;
		}
		await goto(redirectTo);
	}

	function handleGoogleLogin() {
		signIn.social({ provider: 'google', callbackURL: redirectTo });
	}

	function handleMicrosoftLogin() {
		signIn.social({ provider: 'microsoft', callbackURL: redirectTo });
	}
</script>

<h1>Sign in</h1>

<form onsubmit={handlePasswordLogin}>
	<label>
		Email
		<input type="email" bind:value={email} required autocomplete="email" />
	</label>
	<label>
		Password
		<input type="password" bind:value={password} required autocomplete="current-password" />
	</label>

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	<button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
</form>

<div class="divider">or</div>

<button type="button" onclick={handleGoogleLogin}>Continue with Google</button>
<button type="button" onclick={handleMicrosoftLogin}>Continue with Microsoft</button>

<p><a href="/register">Need an account? Register</a></p>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 320px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.error {
		color: #b00020;
	}
	.divider {
		margin: 1rem 0;
		color: #888;
	}
	button {
		margin-bottom: 0.5rem;
	}
</style>
