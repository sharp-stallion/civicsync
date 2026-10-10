# Deployment — Supabase + Vercel (free tiers)

## 1. Supabase (backend)

1. Create a project at supabase.com. Note the **Project URL** and the
   **publishable/anon key** (Settings → API). Enable email/password auth.
2. SQL editor — run **in this order**: `schema.sql`, `functions.sql`,
   `policies.sql`, then (optional) `seed_south_chennai.sql`.
3. Auth → URL configuration: add your local (`http://localhost:5173`) and
   production (`https://<app>.vercel.app`) URLs as redirect URLs.
4. Sign up once in the app, then promote yourself to admin:
   ```sql
   update public.profiles p set role='admin', approval_status='approved', department_id=null
   from auth.users u where p.id=u.id and lower(u.email)=lower('YOU@example.com');
   ```

## 2. Vercel (frontend)

1. Push this repo to GitHub and import it in Vercel. `vercel.json` already sets
   the build command, output dir and SPA rewrites.
2. Project → Settings → Environment Variables, add:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_PUBLISHABLE_KEY=...
   VITE_OPENAQ_API_KEY=            # optional
   VITE_NOMINATIM_APP=CivicSync-SouthChennai/1.0 (civic demo)
   VITE_MAP_LATITUDE=12.98
   VITE_MAP_LONGITUDE=80.24
   VITE_MAP_ZOOM=12
   ```
3. Deploy. Never add a service-role or secret key — browser variables ship to
   every visitor.

## Local-only alternative

`npm run dev` against a Supabase project is enough for the demo — Vercel is not
required. `npm run build && npm run preview` serves the production bundle
locally.

## Demo accounts to prepare

- 1 **admin** (promoted as above).
- 2 **officials** in different departments (each signs up, requests official
  access in-app, admin approves with a department) — needed to show a
  cross-department Dig-Once decision.
- 1 **citizen** (ordinary signup) for reporting.
