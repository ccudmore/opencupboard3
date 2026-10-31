import { getContext, setContext } from 'svelte';
import { toast } from 'svelte-sonner';
import { invalidateAll } from '$app/navigation';
import { callAction } from '$lib/client/callAction';

/**
 * Shared "run a server action" helper for components that sit under one parent.
 * `busy` holds the key of the action currently in flight ('' when idle).
 */
export class ActionRunner {
	busy = $state('');

	// Arrow function so it still works when destructured: const { run } = runner
	run = async (
		key: string,
		action: string,
		fields: Record<string, string>,
		done?: string
	) => {
		this.busy = key;
		const r = await callAction(action, fields);
		this.busy = '';
		if (!r.ok) {
			toast(r.message);
			await invalidateAll();
			return null;
		}
		if (done) toast(done);
		await invalidateAll();
		return r.data;
	};
}

const KEY = Symbol('actionRunner');

/** Call once, during component initialisation, in the parent (TabView). */
export const setActionRunner = () => setContext(KEY, new ActionRunner());

/** Call during component initialisation in any child. */
export const getActionRunner = () => getContext<ActionRunner>(KEY);