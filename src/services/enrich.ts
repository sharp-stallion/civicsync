// Combines the open-data integrations into one enrichment call for a project
// location, writing results to the shared server cache so repeat views across
// users cost no extra API calls (and stay within rate limits).
import { supabase } from '../lib/supabase';
import { getWeatherOutlook, type WeatherOutlook } from '../integrations/openmeteo';
import { getAirQuality, openaqEnabled, type AirQuality } from '../integrations/openaq';

export interface Enrichment {
  weather: WeatherOutlook | null;
  air: AirQuality | null;
}

export async function enrichLocation(lat: number, lng: number): Promise<Enrichment> {
  const [weather, air] = await Promise.all([
    getWeatherOutlook(lat, lng),
    openaqEnabled() ? getAirQuality(lat, lng) : Promise.resolve(null),
  ]);
  // Best-effort shared cache (ignored if the RPC/permission is unavailable).
  if (weather || air) {
    try {
      await supabase.rpc('cache_enrichment', {
        p_key: `enrich:${lat.toFixed(2)},${lng.toFixed(2)}`,
        p_payload: { weather, air, at: new Date().toISOString() },
      });
    } catch { /* non-fatal */ }
  }
  return { weather, air };
}
