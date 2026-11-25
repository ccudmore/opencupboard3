// Address look-up with Nominatim (OpenStreetMap), used for the household heat map.
// Kept free of SvelteKit and database imports so the seed script can use it too.
//
// Nominatim's usage policy allows at most one request per second and requires an identifying
// User-Agent. Every look-up goes through one queue, which waits between requests, so look-ups
// from saving a household and from the report's background run never overlap.

const DELAY_MS = 1100;
const USER_AGENT = "OpenCupboard food bank app (household heat map)";

export type Address = {
  street: string | null;
  city: string | null;
  state: string;
  postalCode: string | null;
  country: string;
};

/** The text that gets looked up. Null when there's too little to look up. */
export function addressQuery(h: Address): string | null {
  if (!h.street?.trim() && !h.postalCode?.trim()) return null;
  return [h.street, h.city, h.state, h.postalCode, h.country]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOne(q: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "1" });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Nominatim returned HTTP ${res.status}`);
  const results: Array<{ lat: string; lon: string }> = await res.json();
  if (!results.length) return null;
  const lat = Number(results[0].lat);
  const lng = Number(results[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

let queue: Promise<unknown> = Promise.resolve();

/** Looks up one address. Null = not found; throws if the service can't be reached. */
export function lookupAddress(
  q: string,
): Promise<{ lat: number; lng: number } | null> {
  const result = queue.then(async () => {
    try {
      return await fetchOne(q);
    } finally {
      await sleep(DELAY_MS);
    }
  });
  queue = result.catch(() => undefined);
  return result;
}
