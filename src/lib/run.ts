import { callAction } from '$lib/client/callAction';
import { toast } from 'svelte-sonner';
import { invalidateAll } from '$app/navigation';
import { writable } from 'svelte/store';
//export const sharedValue = writable('Hello World');

export let busy = writable($state(''));
export async function run(key: string, action: string, fields: Record<string, string>, done?: string) {
	busy.set(key);
	const r = await callAction(action, fields);
	busy.set('');
	if (!r.ok) {
		toast(r.message);
		await invalidateAll();
		return null;
	}
	if (done) toast(done);
	await invalidateAll();
	return r.data;
}
