import { deserialize } from '$app/forms';
import { goto } from '$app/navigation';

export type CallResult =
	| { ok: true; data: any }
	| { ok: false; message: string; code?: string; data?: any };

/**
 * Calls a form action of the current page with fetch. Several pages are one big <form>, so
 * their extra buttons can't be forms of their own (forms can't be nested).
 */
export async function callAction(name: string, fields: Record<string, string> | FormData): Promise<CallResult> {
	let body: FormData;
	if (fields instanceof FormData) body = fields;
	else {
		body = new FormData();
		for (const [key, value] of Object.entries(fields)) body.append(key, value);
	}

	try {
		const response = await fetch(`?/${name}`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result = deserialize(await response.text());

		if (result.type === 'success') return { ok: true, data: result.data ?? {} };
		if (result.type === 'failure') {
			const data = (result.data ?? {}) as { message?: string; code?: string };
			return { ok: false, message: data.message ?? 'The request failed.', code: data.code, data };
		}
		if (result.type === 'redirect') {
			await goto(result.location); // for example, the session has expired
			return { ok: false, message: 'Please sign in again.' };
		}
		return { ok: false, message: result.error?.message ?? 'The request failed.' };
	} catch {
		return { ok: false, message: 'The request failed. Check your connection and try again.' };
	}
}
