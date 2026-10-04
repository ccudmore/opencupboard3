// src/lib/geocode.ts
export async function geocode(query: string, apiKey: string) {
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.features.length > 0) {
    const [lng, lat] = data.features[0].geometry.coordinates;
    return { lat, lng };
  } else {
    throw new Error('Location not found');
  }
}
