<script lang="ts" module>
	export type EmailKind = 'confirmation' | 'reminder' | 'cancellation';
</script>

<script lang="ts">
	import { Button, Input, Label, Modal, Textarea } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { callAction } from '$lib/client/callAction';

	// The prompts for sending a confirmation, reminder or cancellation email:
	//   (optional) "Send it?"  ->  "Customize it?"  ->  editor  ->  send.
	// The page calls start(). It works with a pair of form actions on the page: one that
	// returns the default message, and one that sends it.

	let {
		emailEnabled,
		previewAction,
		sendAction,
		idField,
		audience
	}: {
		emailEnabled: boolean;
		previewAction: string;
		sendAction: string;
		/** name of the form field that carries the id, e.g. "bookingId" */
		idField: string;
		/** who receives it, for the wording of the prompts */
		audience: 'household' | 'volunteer';
	} = $props();

	type Draft = {
		kind: EmailKind;
		id: string;
		to: { name: string; email: string }[];
		subject: string;
		body: string;
	};

	let draft = $state<Draft | null>(null);
	let askSendOpen = $state(false);
	let askCustomizeOpen = $state(false);
	let editorOpen = $state(false);
	let busy = $state(false);

	const recipientText = $derived(draft ? draft.to.map((r) => `${r.name} <${r.email}>`).join(', ') : '');
	const word = $derived(draft?.kind ?? 'confirmation');
	const toWhom = $derived(
		audience === 'volunteer'
			? 'the volunteer'
			: draft && draft.to.length > 1
				? 'the primary members'
				: 'the primary member'
	);

	/**
	 * Loads the default message and starts the prompts.
	 * askFirst: begin with "Send a ... email?" (right after something was created or cancelled);
	 * otherwise begin with "Customize it?" (the person already pressed a Send button).
	 */
	export async function start(id: string, kind: EmailKind, askFirst: boolean) {
		if (!emailEnabled) return;

		const result = await callAction(previewAction, { [idField]: id, kind });
		if (!result.ok) {
			toast(result.message);
			return;
		}
		draft = { kind, id, to: result.data.to, subject: result.data.subject, body: result.data.body };
		if (askFirst) askSendOpen = true;
		else askCustomizeOpen = true;
	}

	function answerSend(yes: boolean) {
		askSendOpen = false;
		if (yes) askCustomizeOpen = true;
		else draft = null;
	}

	function answerCustomize(yes: boolean) {
		if (yes) {
			askCustomizeOpen = false;
			editorOpen = true;
		} else {
			void send(false);
		}
	}

	function closeEditor() {
		editorOpen = false;
		draft = null;
	}

	/** edited = send the text from the editor instead of the default text */
	async function send(edited: boolean) {
		if (!draft) return;
		busy = true;

		const result = await callAction(sendAction, {
			[idField]: draft.id,
			kind: draft.kind,
			...(edited ? { subject: draft.subject, body: draft.body } : {})
		});
		busy = false;

		if (!result.ok) {
			toast(result.message);
			return; // leave the prompt or editor open so nothing typed is lost
		}
		const count = result.data.to?.length ?? 0;
		const label = draft.kind[0].toUpperCase() + draft.kind.slice(1);
		askCustomizeOpen = false;
		editorOpen = false;
		draft = null;
		toast(`${label} email sent to ${count} ${count === 1 ? 'person' : 'people'}`);
		await invalidateAll(); // refreshes "sent" in the lists
	}

	/** Pressing Enter in a text input must not submit a surrounding form. */
	function ignoreEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') event.preventDefault();
	}
</script>

<Modal title={`Send ${word} email`} bind:open={askSendOpen} size="xs">
	<p class="text-gray-600 dark:text-gray-300">Send a {word} email to {toWhom}?</p>
	<p class="mt-2 text-sm wrap-break-word text-gray-600 dark:text-gray-300">{recipientText}</p>
	{#snippet footer()}
		<Button type="button" color="dark" onclick={() => answerSend(true)}>Yes</Button>
		<Button type="button" outline color="dark" onclick={() => answerSend(false)}>No</Button>
	{/snippet}
</Modal>

<Modal
	title="Customize the email?"
	bind:open={askCustomizeOpen}
	size="xs"
	onclose={() => {
		if (!editorOpen && !busy) draft = null;
	}}
>
	<p class="text-gray-600 dark:text-gray-300">Would you like to review and change the {word} email before it is sent?</p>
	<p class="mt-2 text-sm wrap-break-word text-gray-600 dark:text-gray-300">{recipientText}</p>
	{#snippet footer()}
		<Button type="button" color="dark" disabled={busy} onclick={() => answerCustomize(true)}>Yes, let me edit it</Button>
		<Button type="button" outline color="dark" disabled={busy} onclick={() => answerCustomize(false)}>
			{busy ? 'Sending…' : 'No, send it'}
		</Button>
	{/snippet}
</Modal>

<Modal title={`Edit the ${word} email`} bind:open={editorOpen} size="lg" onclose={() => (draft = null)}>
	{#if draft}
		<div class="min-w-0 space-y-4">
			<p class="text-sm wrap-break-word text-gray-600 dark:text-gray-300">To: {recipientText}</p>
			<div>
				<Label for="email-subject" class="mb-2">Subject</Label>
				<Input id="email-subject" type="text" maxlength={200} bind:value={draft.subject} onkeydown={ignoreEnter} />
			</div>
			<div>
				<Label for="email-body" class="mb-2">Message</Label>
				<Textarea id="email-body" rows={12} class="block w-full max-w-full min-w-0" maxlength={10000} bind:value={draft.body} />
			</div>
		</div>
	{/if}
	{#snippet footer()}
		<Button type="button" color="dark" disabled={busy} onclick={() => send(true)}>{busy ? 'Sending…' : 'Send'}</Button>
		<Button type="button" outline color="dark" disabled={busy} onclick={closeEditor}>Cancel</Button>
	{/snippet}
</Modal>
