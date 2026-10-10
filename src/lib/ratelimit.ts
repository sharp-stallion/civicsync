// ============================================================================
// Rate limiting + caching for open-data APIs.
// ----------------------------------------------------------------------------
// Every public API we use publishes a usage policy. Breaking it gets the app's
// IP banned, so this module enforces the limits for us:
//
//   Nominatim  : max 1 req/sec, results MUST be cached, User-Agent required.
//   Open-Meteo : 600/min, 5 000/hour, 10 000/day (no key).
//   OpenAQ     : 60/min, 2 000/hour (key required); HTTP 429 when exceeded.
//   Overpass   : fair-use; NOT called per-request (offline seeding only).
//
// Strategy: (1) a token-bucket limiter spaces requests per host; (2) a TTL
// cache (memory + localStorage) means repeat lookups cost zero API calls;
// (3) a 429/5xx response triggers capped exponential backoff with jitter.
// Sources are listed in README.md and docs/DATA_SOURCES.md.
// ============================================================================

interface BucketOpts { ratePerSec: number; burst: number }

class TokenBucket {
  private tokens: number;
  private last: number;
  private queue: (() => void)[] = [];
  constructor(private opts: BucketOpts) {
    this.tokens = opts.burst;
    this.last = Date.now();
  }
  private refill() {
    const now = Date.now();
    this.tokens = Math.min(this.opts.burst, this.tokens + ((now - this.last) / 1000) * this.opts.ratePerSec);
    this.last = now;
  }
  async take(): Promise<void> {
    return new Promise((resolve) => {
      const attempt = () => {
        this.refill();
        if (this.tokens >= 1) {
          this.tokens -= 1;
          resolve();
        } else {
          const waitMs = Math.ceil(((1 - this.tokens) / this.opts.ratePerSec) * 1000);
          setTimeout(attempt, Math.max(waitMs, 20));
        }
      };
      this.queue.push(attempt);
      // Serialise so bursts truly queue instead of all firing at once.
      if (this.queue.length === 1) this.drain();
    });
  }
  private drain() {
    const next = this.queue[0];
    if (!next) return;
    next();
    this.queue.shift();
    if (this.queue.length) setTimeout(() => this.drain(), 0);
  }
}

// One bucket per upstream host, tuned under each published limit.
const buckets: Record<string, TokenBucket> = {
  nominatim: new TokenBucket({ ratePerSec: 1, burst: 1 }),       // 1 req/sec hard cap
  openmeteo: new TokenBucket({ ratePerSec: 8, burst: 8 }),        // well under 600/min
  openaq: new TokenBucket({ ratePerSec: 1, burst: 1 }),           // under 60/min, polite
};

// ---------------------------------------------------------------------------
// TTL cache. Nominatim's policy *requires* caching; the others benefit from it.
// ---------------------------------------------------------------------------
const mem = new Map<string, { at: number; value: unknown }>();

function cacheGet<T>(key: string, ttlMs: number): T | null {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  try {
    const raw = localStorage.getItem('cs:' + key);
    if (raw) {
      const parsed = JSON.parse(raw) as { at: number; value: T };
      if (Date.now() - parsed.at < ttlMs) {
        mem.set(key, parsed);
        return parsed.value;
      }
    }
  } catch { /* storage may be unavailable; ignore */ }
  return null;
}

function cacheSet(key: string, value: unknown) {
  const entry = { at: Date.now(), value };
  mem.set(key, entry);
  try { localStorage.setItem('cs:' + key, JSON.stringify(entry)); } catch { /* ignore quota/private mode */ }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LimitedFetchOpts {
  bucket: keyof typeof buckets;
  cacheKey: string;
  ttlMs: number;
  headers?: Record<string, string>;
  maxRetries?: number;
}

/**
 * Fetch JSON through a host bucket, with cache and 429-aware backoff.
 * Returns null on repeated failure so callers can degrade gracefully
 * (hide a panel) rather than crash the page.
 */
export async function limitedFetchJSON<T>(url: string, opts: LimitedFetchOpts): Promise<T | null> {
  const cached = cacheGet<T>(opts.cacheKey, opts.ttlMs);
  if (cached !== null) return cached;

  const retries = opts.maxRetries ?? 3;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await buckets[opts.bucket].take();
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', ...opts.headers } });
      if (res.status === 429 || res.status >= 500) {
        // Honour Retry-After when present, else exponential backoff + jitter.
        const ra = Number(res.headers.get('retry-after'));
        const backoff = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2 ** attempt * 1000 + Math.random() * 400;
        if (attempt < retries) { await sleep(Math.min(backoff, 15000)); continue; }
        return null;
      }
      if (!res.ok) return null;
      const json = (await res.json()) as T;
      cacheSet(opts.cacheKey, json);
      return json;
    } catch {
      if (attempt < retries) { await sleep(2 ** attempt * 500); continue; }
      return null;
    }
  }
  return null;
}
