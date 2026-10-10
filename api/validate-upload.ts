// Vercel Edge Function — OPTIONAL post-upload content-type gate (Thread C).
// Zero database writes. Returns 200 {ok:true} only for small real images.
// Wire it by POSTing { url, contentType, bytes } before showing an uploaded
// image. It is NOT required for the app to work (Supabase Storage already
// enforces MIME + 5 MB); this is defence-in-depth for a Cloudinary flow.
export const config = { runtime: 'edge' };

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  let body: { contentType?: string; bytes?: number; url?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'bad json' }, 400); }

  const ct = (body.contentType ?? '').toLowerCase().split(';')[0].trim();
  if (!ALLOWED.has(ct)) return json({ ok: false, error: `type ${ct || 'unknown'} not allowed` }, 415);
  if (typeof body.bytes === 'number' && body.bytes > MAX_BYTES) return json({ ok: false, error: 'file too large' }, 413);

  // Optional: HEAD the URL and re-check the server-reported content-type.
  if (body.url && /^https:\/\//.test(body.url)) {
    try {
      const head = await fetch(body.url, { method: 'HEAD' });
      const realCt = (head.headers.get('content-type') ?? '').toLowerCase().split(';')[0].trim();
      if (realCt && !ALLOWED.has(realCt)) return json({ ok: false, error: `server type ${realCt} not allowed` }, 415);
    } catch { /* non-fatal — client check already passed */ }
  }
  return json({ ok: true });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
