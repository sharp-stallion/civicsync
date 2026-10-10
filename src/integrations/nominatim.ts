// OpenStreetMap Nominatim — forward + reverse geocoding.
// Policy: max 1 req/sec, identify the app, cache results. All enforced via
// the 'nominatim' bucket and an aggressive 30-day cache.
import { limitedFetchJSON } from '../lib/ratelimit';
import { NOMINATIM_APP, NOMINATIM_EMAIL } from '../lib/env';
import { SOUTH_CHENNAI_BBOX, inSouthChennai } from '../lib/geo';

const BASE = 'https://nominatim.openstreetmap.org';
const CACHE_30D = 30 * 24 * 60 * 60 * 1000;

function headers(): Record<string, string> {
  // Browsers forbid setting User-Agent; Nominatim also accepts Referer + the
  // app name, so we pass identification it will honour from a browser.
  const h: Record<string, string> = { 'Accept-Language': 'en' };
  return h;
}

export interface GeocodeResult { lat: number; lng: number; label: string }

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // Bias to the South Chennai viewbox; bounded=1 keeps results local.
  const vb = `${SOUTH_CHENNAI_BBOX.west},${SOUTH_CHENNAI_BBOX.north},${SOUTH_CHENNAI_BBOX.east},${SOUTH_CHENNAI_BBOX.south}`;
  const params = new URLSearchParams({
    q: `${q}, Chennai`,
    format: 'jsonv2',
    limit: '6',
    viewbox: vb,
    bounded: '1',
    'accept-language': 'en',
    app: NOMINATIM_APP,
  });
  if (NOMINATIM_EMAIL) params.set('email', NOMINATIM_EMAIL);
  const rows = await limitedFetchJSON<{ lat: string; lon: string; display_name: string }[]>(
    `${BASE}/search?${params}`,
    { bucket: 'nominatim', cacheKey: `geo:${q.toLowerCase()}`, ttlMs: CACHE_30D, headers: headers() },
  );
  if (!rows) return [];
  return rows
    .map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const params = new URLSearchParams({
    lat: String(lat), lon: String(lng), format: 'jsonv2', 'accept-language': 'en', app: NOMINATIM_APP,
  });
  if (NOMINATIM_EMAIL) params.set('email', NOMINATIM_EMAIL);
  const row = await limitedFetchJSON<{ display_name?: string; address?: Record<string, string> }>(
    `${BASE}/reverse?${params}`,
    { bucket: 'nominatim', cacheKey: key, ttlMs: CACHE_30D, headers: headers() },
  );
  if (!row) return null;
  const a = row.address ?? {};
  return a.road ?? a.suburb ?? a.neighbourhood ?? row.display_name ?? null;
}

export { inSouthChennai };
