// Free geocoding via OpenStreetMap's Nominatim — no API key required, pairs
// naturally with the OSM map tiles used in components/LiveMap.tsx.
//
// Nominatim's usage policy caps the public instance at ~1 request/second
// and requires a descriptive User-Agent, which is fine for this app's
// actual call pattern (once per destination save, never in a loop/bulk) —
// but it's a shared free service, not an SLA'd API: for real production
// volume, swap this for a paid geocoder (Google/Mapbox) or a self-hosted
// Nominatim instance instead of hammering the public one.
//
// Fails soft, like every other external integration in this app (Stripe,
// Twilio, WhatsApp): a booking's address must never fail to save just
// because a free geocoding lookup timed out or returned nothing.
export async function geocodeAddress(opts: {
  addressLine1: string;
  city: string;
  state?: string;
  postalCode?: string;
}): Promise<{ lat: number; lng: number } | null> {
  if (!opts.addressLine1 || !opts.city) return null;

  const q = [opts.addressLine1, opts.city, opts.state ?? "FL", opts.postalCode, "USA"].filter(Boolean).join(", ");

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BellizaDelivery/1.0 (furniture delivery platform; demo/pilot deployment)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(results) || results.length === 0) return null;

    const lat = parseFloat(results[0].lat);
    const lng = parseFloat(results[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (err) {
    console.error("[geocoding] lookup failed:", err);
    return null;
  }
}
