// South Chennai bounding box + geometry helpers (kept in sync with the SQL
// haversine_m() function so the client and server agree on distance).

// [south, west, north, east] — widened to cover the GST Road corridor
// (Tambaram → Vandalur → Guduvanchery) as well as the Adyar/OMR coast.
export const SOUTH_CHENNAI_BBOX = { south: 12.83, west: 80.05, north: 13.04, east: 80.28 };

// Quick-jump centres. NOTE: these are approximate area centres set from memory
// (the sandbox cannot geocode live). They only pan the map — clicking the map
// always places an exact pin — so adjust any that look off.
export const SOUTH_CHENNAI_AREAS: { name: string; lat: number; lng: number }[] = [
  { name: 'Adyar', lat: 13.0012, lng: 80.2565 },
  { name: 'Besant Nagar', lat: 12.998, lng: 80.267 },
  { name: 'Velachery', lat: 12.9791, lng: 80.221 },
  { name: 'Guindy', lat: 13.0067, lng: 80.2206 },
  { name: 'Thiruvanmiyur', lat: 12.983, lng: 80.2594 },
  { name: 'Thoraipakkam (OMR)', lat: 12.94, lng: 80.234 },
  { name: 'Sholinganallur', lat: 12.9009, lng: 80.2279 },
  { name: 'Pallikaranai', lat: 12.9365, lng: 80.2096 },
  // GST Road corridor
  { name: 'Tambaram', lat: 12.9229, lng: 80.1275 },
  { name: 'Perungalathur', lat: 12.9065, lng: 80.0943 },
  { name: 'Vandalur', lat: 12.8916, lng: 80.081 },
  { name: 'Urapakkam', lat: 12.864, lng: 80.072 },
  { name: 'Kandigai', lat: 12.852, lng: 80.066 },
  { name: 'Guduvanchery', lat: 12.844, lng: 80.059 },
  { name: 'Mambakkam', lat: 12.9125, lng: 80.1915 },
];

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const inSouthChennai = (lat: number, lng: number): boolean =>
  lat >= SOUTH_CHENNAI_BBOX.south &&
  lat <= SOUTH_CHENNAI_BBOX.north &&
  lng >= SOUTH_CHENNAI_BBOX.west &&
  lng <= SOUTH_CHENNAI_BBOX.east;

export const fmtDistance = (m: number): string =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
