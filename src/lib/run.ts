import { callAction } from "#lib/client/callAction.ts";
import { toast } from "svelte-sonner";
import { refreshAll } from "$app/navigation";
import { writable } from "svelte/store";

export let busy = writable($state(""));
export async function run(
  key: string,
  action: string,
  fields: Record<string, string>,
  done?: string,
) {
  busy.set(key);
  const r = await callAction(action, fields);
  busy.set("");
  if (!r.ok) {
    toast(r.message);
    await refreshAll();
    return null;
  }
  if (done) toast(done);
  await refreshAll();
  return r.data;
}
