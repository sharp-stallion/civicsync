# Spam prevention (Thread C)

Three layers, strongest first. Layers 1–2 are **live in the app**; layer 3 is
optional drop-in code for a Cloudinary flow.

## 1. Server-enforced, in the database (live)
- **Verified-resident gate:** only a signed-in user who completed their profile
  (name + area) can post, vote or comment — enforced by RLS, not just the UI.
- **2 demands per resident per day:** enforced by the `forum_posts_insert`
  policy via `my_demands_today()` (see `supabase/migration_v3_security.sql`).
- One vote per resident per demand (primary key on `forum_votes`).

## 2. Client-side upload validation (live)
In `src/services/reports.ts`, before any upload:
```ts
if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG or WebP image.');
if (file.size > 5 * 1024 * 1024) throw new Error('Photo must be 5 MB or smaller.');
```
Supabase Storage re-enforces the same MIME list + 5 MB limit server-side, so a
tampered client cannot bypass it.

## 3. Optional Cloudinary flow + Edge validator (drop-in)
Use this only if you want Cloudinary's free-tier upload widget + moderation
instead of Supabase Storage. The Vercel Edge Function is in
`api/validate-upload.ts` (zero DB writes).

Unsigned upload widget (client):
```html
<script src="https://upload-widget.cloudinary.com/latest/global/all.js"></script>
<script>
  const widget = cloudinary.createUploadWidget(
    { cloudName: 'YOUR_CLOUD', uploadPreset: 'YOUR_UNSIGNED_PRESET',
      sources: ['local','camera'], clientAllowedFormats: ['jpg','png','webp'],
      maxFileSize: 5_000_000, multiple: false },
    async (err, result) => {
      if (!err && result?.event === 'success') {
        const { secure_url, bytes, resource_type, format } = result.info;
        const check = await fetch('/api/validate-upload', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: secure_url, contentType: `${resource_type}/${format}`, bytes }),
        }).then(r => r.json());
        if (check.ok) { /* save secure_url as the report photo */ }
      }
    });
</script>
```
Enable Cloudinary's **auto-moderation** add-on (free tier) on the preset so
flagged images are quarantined before they appear. No secrets ship to the
browser — the unsigned preset is public and rate-limited by Cloudinary.
