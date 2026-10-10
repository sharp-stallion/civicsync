// Central, typed access to configuration. The app shows a Setup screen when
// Supabase is not configured rather than crashing or faking data.

const env = import.meta.env;

export const SUPABASE_URL: string = (env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_KEY: string = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const isConfigured = (): boolean =>
  SUPABASE_URL.startsWith('http') && SUPABASE_KEY.length > 20;

const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

// South Chennai: Guindy / Adyar / Velachery / Besant Nagar / OMR corridor.
export const MAP_CENTER: [number, number] = [
  num(env.VITE_MAP_LATITUDE, 12.95, -90, 90),
  num(env.VITE_MAP_LONGITUDE, 80.17, -180, 180),
];
export const MAP_ZOOM: number = num(env.VITE_MAP_ZOOM, 11, 1, 18);

export const OPENAQ_API_KEY: string = (env.VITE_OPENAQ_API_KEY ?? '').trim();
export const NOMINATIM_APP: string = (env.VITE_NOMINATIM_APP ?? 'CivicSync-SouthChennai/1.0').trim();
export const NOMINATIM_EMAIL: string = (env.VITE_NOMINATIM_EMAIL ?? '').trim();
