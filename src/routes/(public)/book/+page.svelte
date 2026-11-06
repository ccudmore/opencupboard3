<script lang="ts">
	import { Alert, Badge, Button, Checkbox, Input, Label, Textarea } from 'flowbite-svelte';
	import { callAction } from '$lib/client/callAction';
	import Logo from '$lib/Logo.svelte';

	let { data } = $props();

	type Step = 'start' | 'id' | 'home' | 'booked' | 'register' | 'registered' | 'pending' | 'inactive';
	type Booking = { id: string; when: string; scheduled: boolean; status: string; place: string };
	type Slot = { id: string; start: string; end: string; place: string };

	let step = $state<Step>('start');
	let busy = $state(false);
	let error = $state('');

	// the household's ID, kept only on this page and sent with every request
	let uniqueId = $state('');
	let history = $state<Booking[]>([]);
	let eligibleDate = $state<string | null>(null);
	let slots = $state<Slot[]>([]);
	let bookedSlot = $state<{ start: string; place: string } | null>(null);

	const tz = $derived(data.timeZone);
	const dayFmt = $derived(new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: tz }));
	const timeFmt = $derived(new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: tz }));
	const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso));

	/** The open appointments, grouped by the day they are on. */
	const days = $derived.by(() => {
		const out: { key: string; label: string; place: string; slots: Slot[] }[] = [];
		for (const s of slots) {
			const key = dayKey(s.start);
			let d = out.find((x) => x.key === key && x.place === s.place);
			if (!d) out.push((d = { key, label: dayFmt.format(new Date(s.start)), place: s.place, slots: [] }));
			d.slots.push(s);
		}
		return out;
	});

	const statusLabel = (s: string) => (s === 'PENDING' ? 'Waiting for confirmation' : s === 'ACTIVE' ? 'Confirmed' : s === 'COMPLETE' ? 'Completed' : s === 'NO_SHOW' ? 'Missed' : s === 'CANCELLED' ? 'Cancelled' : s);
	const statusColor = (s: string) => (s === 'ACTIVE' || s === 'COMPLETE' ? 'green' : s === 'PENDING' ? 'yellow' : s === 'CANCELLED' || s === 'NO_SHOW' ? 'red' : 'gray');

	async function lookup() {
		error = '';
		if (!uniqueId.trim()) {
			error = 'Enter your ID.';
			return;
		}
		busy = true;
		const r = await callAction('lookup', { uniqueId });
		busy = false;
		if (!r.ok) {
			error = r.message;
			return;
		}
		const d = r.data as { state: 'pending' | 'inactive' | 'active'; history?: Booking[]; eligibleDate?: string | null; appointments?: Slot[] };
		if (d.state !== 'active') {
			step = d.state;
			return;
		}
		history = d.history ?? [];
		eligibleDate = d.eligibleDate ?? null;
		slots = d.appointments ?? [];
		step = 'home';
	}

	async function choose(slot: Slot) {
		error = '';
		busy = true;
		const r = await callAction('book', { uniqueId, appointmentId: slot.id });
		busy = false;
		if (!r.ok) {
			error = r.message;
			await refresh(); // the list may have changed (for example, someone just took it)
			return;
		}
		bookedSlot = { start: slot.start, place: slot.place };
		step = 'booked';
	}

	/** Reloads the household's lists without leaving a message that is showing. */
	async function refresh() {
		const keep = error;
		await lookup();
		if (keep) error = keep;
	}

	// ------------------------------------------------ sign up
	const dietary = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free'];
	let f = $state({
		firstName: '', lastName: '', street: '', unitNumber: '', city: '', postalCode: '', email: '', phone: '',
		adults: '1', children: '0', notes: '', website: ''
	});
	let diet = $state<string[]>([]);

	async function register(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const body = new FormData();
		for (const [k, v] of Object.entries(f)) body.set(k, v);
		for (const d of diet) body.append('dietaryRestrictions', d);
		const r = await callAction('register', body);
		busy = false;
		if (!r.ok) {
			error = r.message;
			return;
		}
		step = 'registered';
	}

	function startOver() {
		step = 'start';
		error = '';
		uniqueId = '';
	}
	const ignoreEnter = (e: KeyboardEvent) => e.key === 'Enter' && e.preventDefault();
</script>

<svelte:head><title>Book an appointment – {data.organization}</title></svelte:head>

<main class="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
	<div class="flex items-center gap-4">
		<Logo class="h-16 w-auto" />
		<div>
			<h1>Book an appointment</h1>
			<p class="muted">{data.organization}</p>
		</div>
	</div>

	{#if error}<Alert color="red" role="alert">{error}</Alert>{/if}

	{#if step === 'start'}
		<section class="space-y-4">
			<h2 class="section-title">Do you have a household ID?</h2>
			<p class="muted">If you have used our food bank before, we gave you a short ID. You can find it on your confirmation email.</p>
			<div class="flex flex-wrap gap-3">
				<Button color="blue" onclick={() => { error = ''; step = 'id'; }}>Yes, I have an ID</Button>
				<Button outline color="dark" onclick={() => { error = ''; step = 'register'; }}>No, I am new here</Button>
			</div>
		</section>

	{:else if step === 'id'}
		<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void lookup(); }}>
			<div>
				<Label for="uid" class="mb-2">Your household ID</Label>
				<Input id="uid" autocomplete="off" autocapitalize="characters" maxlength={12} class="max-w-xs uppercase" bind:value={uniqueId} />
			</div>
			<div class="flex flex-wrap gap-3">
				<Button type="submit" color="blue" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</Button>
				<Button type="button" outline color="dark" onclick={startOver}>Back</Button>
			</div>
		</form>

	{:else if step === 'home'}
		<section class="space-y-2">
			<h2 class="section-title">Your next appointment</h2>
			{#if eligibleDate}
				<p>You can book an appointment on or after <strong>{dayFmt.format(new Date(eligibleDate))}</strong>.</p>
			{:else}
				<p>You can book an appointment now.</p>
			{/if}
		</section>

		<section class="space-y-3">
			<h2 class="section-title">Available appointments</h2>
			{#if days.length === 0}
				<p class="muted">There are no appointments available for you right now. Please check back soon.</p>
			{/if}
			{#each days as d (d.key + d.place)}
				<div class="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
					<div class="font-semibold text-gray-900 dark:text-white">{d.label}</div>
					{#if d.place}<div class="hint">{d.place}</div>{/if}
					<div class="mt-2 flex flex-wrap gap-2">
						{#each d.slots as s (s.id)}
							<Button size="sm" outline color="blue" disabled={busy} onclick={() => choose(s)}>{timeFmt.format(new Date(s.start))}</Button>
						{/each}
					</div>
				</div>
			{/each}
			<p class="hint">Your appointment is confirmed by our team. You will get a confirmation letter once it is.</p>
		</section>

		<section class="space-y-2">
			<h2 class="section-title">Your appointments so far</h2>
			{#if history.length === 0}
				<p class="muted">No appointments yet.</p>
			{:else}
				<ul class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each history as b (b.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 py-2">
							<span class="text-gray-900 dark:text-white">
								{dayFmt.format(new Date(b.when))}{b.scheduled ? `, ${timeFmt.format(new Date(b.when))}` : ''}
								{#if b.place}<span class="hint"> · {b.place}</span>{/if}
							</span>
							<Badge color={statusColor(b.status)}>{statusLabel(b.status)}</Badge>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
		<Button outline color="dark" onclick={startOver}>Done</Button>

	{:else if step === 'booked'}
		<Alert color="green">
			<p class="font-medium">Your appointment request was sent.</p>
			{#if bookedSlot}
				<p class="mt-1">{dayFmt.format(new Date(bookedSlot.start))} at {timeFmt.format(new Date(bookedSlot.start))}{bookedSlot.place ? `, ${bookedSlot.place}` : ''}</p>
			{/if}
			<p class="mt-1">It is waiting for our team to confirm it. You will get a confirmation letter when they do.</p>
		</Alert>
		<Button outline color="dark" onclick={startOver}>Done</Button>

	{:else if step === 'pending'}
		<Alert color="yellow">Your sign-up is still waiting for our team to approve it. We will contact you soon.</Alert>
		<Button outline color="dark" onclick={startOver}>Back</Button>

	{:else if step === 'inactive'}
		<Alert color="yellow">This household cannot book online right now. Please contact us for help.</Alert>
		<Button outline color="dark" onclick={startOver}>Back</Button>

	{:else if step === 'registered'}
		<Alert color="green">
			<p class="font-medium">Thank you. We got your information.</p>
			<p class="mt-1">Our team will review it and contact you. Once you are approved, you will get a household ID and can book your appointment here.</p>
		</Alert>
		<Button outline color="dark" onclick={startOver}>Done</Button>

	{:else if step === 'register'}
		<form class="grid grid-cols-1 gap-4 sm:grid-cols-2" onsubmit={register}>
			<h2 class="section-title sm:col-span-2">Tell us about your household</h2>
			<div><Label for="fn" class="mb-2">First name</Label><Input id="fn" required autocomplete="given-name" bind:value={f.firstName} onkeydown={ignoreEnter} /></div>
			<div><Label for="ln" class="mb-2">Last name</Label><Input id="ln" required autocomplete="family-name" bind:value={f.lastName} onkeydown={ignoreEnter} /></div>
			<div class="sm:col-span-2"><Label for="st" class="mb-2">Street address</Label><Input id="st" required autocomplete="address-line1" bind:value={f.street} onkeydown={ignoreEnter} /></div>
			<div><Label for="un" class="mb-2">Unit number (optional)</Label><Input id="un" autocomplete="address-line2" bind:value={f.unitNumber} onkeydown={ignoreEnter} /></div>
			<div><Label for="ci" class="mb-2">City</Label><Input id="ci" required autocomplete="address-level2" bind:value={f.city} onkeydown={ignoreEnter} /></div>
			<div><Label for="pc" class="mb-2">Postal code</Label><Input id="pc" required autocomplete="postal-code" bind:value={f.postalCode} onkeydown={ignoreEnter} /></div>
			<div><Label for="em" class="mb-2">Email address</Label><Input id="em" type="email" autocomplete="email" bind:value={f.email} onkeydown={ignoreEnter} /></div>
			<div><Label for="ph" class="mb-2">Phone number</Label><Input id="ph" type="tel" autocomplete="tel" bind:value={f.phone} onkeydown={ignoreEnter} /></div>
			<p class="hint sm:col-span-2">Please give an email address or a phone number, so we can reach you.</p>
			<div><Label for="ad" class="mb-2">Adults in the household</Label><Input id="ad" type="number" min="1" max="30" required bind:value={f.adults} onkeydown={ignoreEnter} /></div>
			<div><Label for="ch" class="mb-2">Children in the household</Label><Input id="ch" type="number" min="0" max="30" bind:value={f.children} onkeydown={ignoreEnter} /></div>
			<fieldset class="sm:col-span-2">
				<legend class="mb-2">Dietary restrictions</legend>
				<div class="flex flex-wrap gap-x-5 gap-y-2">
					{#each dietary as d (d)}
						<label class="check-label"><Checkbox bind:group={diet} value={d} />{d}</label>
					{/each}
				</div>
			</fieldset>
			<div class="sm:col-span-2"><Label for="no" class="mb-2">Anything else we should know?</Label><Textarea id="no" rows={3} maxlength={1000} bind:value={f.notes} /></div>
			<!-- only a bot fills this in -->
			<div class="absolute left-[-9999px]" aria-hidden="true"><label>Website<input tabindex="-1" autocomplete="off" bind:value={f.website} /></label></div>
			<div class="flex flex-wrap gap-3 sm:col-span-2">
				<Button type="submit" color="blue" disabled={busy}>{busy ? 'Sending…' : 'Send'}</Button>
				<Button type="button" outline color="dark" onclick={startOver}>Back</Button>
			</div>
		</form>
	{/if}
</main>