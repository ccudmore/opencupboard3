<script lang="ts">
	import { signUp } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	async function handleRegister(e: SubmitEvent) {
		e.preventDefault();
		errorMessage = '';
		loading = true;

		// role is intentionally not sent here — the server config marks
		// `role` as input: false, so every signup gets the "user" default.
		const { error } = await signUp.email({ name, email, password });

		loading = false;
		if (error) {
			errorMessage = error.message ?? 'Registration failed';
			return;
		}
		await goto('/dashboard');
	}
</script>

<h1>Create an account</h1>

<form onsubmit={handleRegister}>
	<label>
		Name
		<input type="text" bind:value={name} required autocomplete="name" />
	</label>
	<label>
		Email
		<input type="email" bind:value={email} required autocomplete="email" />
	</label>
	<label>
		Password
		<input
			type="password"
			bind:value={password}
			required
			minlength="8"
			autocomplete="new-password"
		/>
	</label>

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	<button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
</form>

<p><a href="/login">Already have an account? Sign in</a></p>

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
</style>
