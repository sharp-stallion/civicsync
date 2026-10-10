// Open-Meteo — free weather forecast (no key). Used to flag construction risk:
// heavy rain stalls excavation and resurfacing, so residents and officials see
// when a nearby dig is likely to slip. Limits: 600/min, 10 000/day.
import { limitedFetchJSON } from '../lib/ratelimit';

const BASE = 'https://api.open-meteo.com/v1/forecast';
const CACHE_1H = 60 * 60 * 1000;

export interface WeatherOutlook {
  summary: string;
  rainMm: number;        // next 3-day total precipitation
  risk: 'low' | 'moderate' | 'high';
  daily: { date: string; rainMm: number; tMax: number }[];
}

export async function getWeatherOutlook(lat: number, lng: number): Promise<WeatherOutlook | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lng.toFixed(3),
    daily: 'precipitation_sum,temperature_2m_max',
    forecast_days: '3',
    timezone: 'Asia/Kolkata',
  });
  const data = await limitedFetchJSON<{
    daily?: { time: string[]; precipitation_sum: number[]; temperature_2m_max: number[] };
  }>(`${BASE}?${params}`, {
    bucket: 'openmeteo',
    cacheKey: `wx:${lat.toFixed(2)},${lng.toFixed(2)}`,
    ttlMs: CACHE_1H,
  });
  if (!data?.daily) return null;
  const { time, precipitation_sum, temperature_2m_max } = data.daily;
  const daily = time.map((date, i) => ({
    date,
    rainMm: precipitation_sum[i] ?? 0,
    tMax: temperature_2m_max[i] ?? 0,
  }));
  const rainMm = daily.reduce((s, d) => s + d.rainMm, 0);
  const risk: WeatherOutlook['risk'] = rainMm > 40 ? 'high' : rainMm > 10 ? 'moderate' : 'low';
  const summary =
    risk === 'high' ? 'Heavy rain expected — excavation and resurfacing likely to be disrupted.'
    : risk === 'moderate' ? 'Some rain expected — minor delays possible.'
    : 'Dry outlook — weather unlikely to delay work.';
  return { summary, rainMm: Math.round(rainMm), risk, daily };
}
