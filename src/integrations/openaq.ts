// OpenAQ v3 — nearest air-quality station. Construction dust worsens local air,
// so a dig's page shows the nearby PM2.5 reading. Requires a free API key
// (X-API-Key header); limits 60/min, 2 000/hr, HTTP 429 when exceeded.
// If no key is set, callers simply hide the panel.
import { limitedFetchJSON } from '../lib/ratelimit';
import { OPENAQ_API_KEY } from '../lib/env';

const BASE = 'https://api.openaq.org/v3';
const CACHE_1H = 60 * 60 * 1000;

export interface AirQuality {
  pm25: number | null;
  location: string;
  updated: string | null;
  band: 'good' | 'moderate' | 'poor' | 'very_poor' | 'unknown';
}

const band = (pm: number | null): AirQuality['band'] =>
  pm == null ? 'unknown' : pm <= 30 ? 'good' : pm <= 60 ? 'moderate' : pm <= 90 ? 'poor' : 'very_poor';

export function openaqEnabled(): boolean {
  return OPENAQ_API_KEY.length > 0;
}

export async function getAirQuality(lat: number, lng: number): Promise<AirQuality | null> {
  if (!openaqEnabled()) return null;
  const headers = { 'X-API-Key': OPENAQ_API_KEY };
  const params = new URLSearchParams({
    coordinates: `${lat.toFixed(3)},${lng.toFixed(3)}`,
    radius: '12000',
    limit: '1',
    parameters_id: '2', // PM2.5
  });
  const data = await limitedFetchJSON<{
    results?: { name: string; latest?: { value: number; datetime?: { utc: string } }[];
                sensors?: { latest?: { value: number; datetime?: { utc: string } } }[] }[];
  }>(`${BASE}/locations?${params}`, {
    bucket: 'openaq',
    cacheKey: `aq:${lat.toFixed(2)},${lng.toFixed(2)}`,
    ttlMs: CACHE_1H,
    headers,
  });
  const first = data?.results?.[0];
  if (!first) return null;
  const sensor = first.sensors?.find((s) => s.latest)?.latest ?? first.latest?.[0];
  const pm25 = sensor ? Number(sensor.value) : null;
  return {
    pm25: pm25 != null && Number.isFinite(pm25) ? pm25 : null,
    location: first.name ?? 'Nearby station',
    updated: sensor?.datetime?.utc ?? null,
    band: band(pm25),
  };
}
