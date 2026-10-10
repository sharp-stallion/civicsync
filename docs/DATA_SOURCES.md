# Open-data sources, licences & rate limiting

CivicSync uses only free, open APIs. Each is wrapped by
`src/lib/ratelimit.ts`, which enforces the published limits with a per-host
token bucket, a TTL cache (memory + `localStorage`), and `429`/`5xx`
exponential backoff with jitter. The relevant policy numbers:

| Source | Used for | Key? | Published limit | How we stay under it |
| --- | --- | --- | --- | --- |
| **OpenStreetMap tiles** | Base map | No | Tile usage policy; attribution required | Default OSM tiles with attribution; low-zoom city view |
| **Nominatim** | Address → pin, reverse geocode | No | **1 request/sec**; identify the app; **must cache** | 1 req/s bucket, app identifier, 30-day cache, no autocomplete |
| **Open-Meteo** | Weather delay-risk per dig | No | 600/min · 5 000/hr · 10 000/day | 8 req/s bucket, 1-hour cache, shared server cache |
| **OpenAQ v3** | PM2.5 near a dig | **Yes** (free) | 60/min · 2 000/hr; `429` on exceed | 1 req/s bucket, 1-hour cache; panel hidden if no key |
| **Overpass** | One-off road-segment seeding | No | Shared fair-use service | **Never called at request time** — only `npm run seed:osm`, one request |

### Why caching matters

Nominatim's policy *requires* caching and forbids autocomplete and systematic
queries. We cache every geocode for 30 days and never fire per-keystroke. The
weather/air lookups are additionally written to a shared `enrichment_cache`
table (via the `cache_enrichment` RPC) so one lookup serves every viewer of a
project, not one call per visitor.

### Attribution

- Map data © OpenStreetMap contributors (ODbL), shown on the map.
- Weather by Open-Meteo (CC-BY). Air quality by OpenAQ. Geocoding by Nominatim /
  OpenStreetMap. Each enrichment card names its source in the UI.

### Configuration

```
VITE_OPENAQ_API_KEY=      # free from https://openaq.org — optional; blank hides the air panel
VITE_NOMINATIM_APP=CivicSync-SouthChennai/1.0 (civic hackathon demo)
VITE_NOMINATIM_EMAIL=     # optional contact, recommended by the Nominatim policy
```

### Sources

- Nominatim usage policy — https://operations.osmfoundation.org/policies/nominatim/
- Open-Meteo terms — https://open-meteo.com/en/terms
- OpenAQ rate limits — https://docs.openaq.org/using-the-api/rate-limits
- Overpass API usage — https://wiki.openstreetmap.org/wiki/Overpass_API
- OSM tile usage policy — https://operations.osmfoundation.org/policies/tiles/
