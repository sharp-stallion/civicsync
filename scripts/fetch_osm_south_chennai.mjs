#!/usr/bin/env node
/**
 * Offline OSM seeding for South Chennai road segments.
 * ---------------------------------------------------------------------------
 * The Overpass API is a SHARED, fair-use service. It is NOT called from the
 * app at request time. This one-off script fetches the named-road network for
 * the South Chennai bounding box and writes:
 *   - data/south_chennai_roads.json  (roads + a stable road_segment_id each)
 *
 * Officials can then pick a real segment id when registering a project, which
 * makes Dig-Once matching far stronger than road names alone.
 *
 * Usage:  node scripts/fetch_osm_south_chennai.mjs
 * Respect the service: run it rarely, keep the single request, do not loop it.
 * Docs: https://wiki.openstreetmap.org/wiki/Overpass_API  (usage policy)
 */
import { writeFile, mkdir } from 'node:fs/promises';

// South Chennai bbox [S, W, N, E] — keep in sync with src/lib/geo.ts
const BBOX = [12.88, 80.17, 13.04, 80.28];
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

const query = `
[out:json][timeout:60];
(
  way["highway"~"^(primary|secondary|tertiary|residential|trunk)$"]["name"]
     (${BBOX[0]},${BBOX[1]},${BBOX[2]},${BBOX[3]});
);
out tags center;`;

const slug = (s) =>
  'SC-' + s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

async function main() {
  console.log('Fetching South Chennai roads from Overpass (one polite request)…');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'CivicSync-SouthChennai/1.0 (hackathon seeding)' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) {
    console.error(`Overpass returned ${res.status}. It may be rate-limiting — wait a few minutes and retry. Do not loop.`);
    process.exit(1);
  }
  const json = await res.json();
  const seen = new Map();
  for (const el of json.elements ?? []) {
    const name = el.tags?.name;
    if (!name || !el.center) continue;
    const id = slug(name);
    if (!seen.has(id)) {
      seen.set(id, { road_segment_id: id, road_name: name, latitude: +el.center.lat.toFixed(6), longitude: +el.center.lon.toFixed(6), highway: el.tags.highway });
    }
  }
  const roads = [...seen.values()].sort((a, b) => a.road_name.localeCompare(b.road_name));
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/south_chennai_roads.json', import.meta.url), JSON.stringify(roads, null, 2));
  console.log(`Wrote ${roads.length} named road segments to data/south_chennai_roads.json`);
  console.log('Review it, then load the segment ids into an autocomplete or import a few as pilot projects.');
}

main().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
