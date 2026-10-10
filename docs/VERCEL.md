# Deploying CivicSync to Vercel

Only the frontend deploys to Vercel. The backend is already live in Supabase;
Vercel just serves the app and talks to Supabase using the browser-safe keys.
`vercel.json` in this folder already sets the build and SPA routing.

## Required environment variables (set in Vercel, not committed)

```
VITE_SUPABASE_URL             = https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = <anon public key>
VITE_MAP_LATITUDE             = 12.95
VITE_MAP_LONGITUDE            = 80.17
VITE_MAP_ZOOM                 = 11
# optional
VITE_OPENAQ_API_KEY           =
VITE_NOMINATIM_APP            = CivicSync-SouthChennai/1.0 (civic demo)
```

`.env.local` is git-ignored and never uploaded — that's why the keys go in
Vercel's dashboard (or via `-e` on the CLI). They must exist at BUILD time,
because Vite inlines `VITE_*` variables when it builds.

## Path A — GitHub + Vercel dashboard (most reliable)

1. Create a new GitHub repo and push this folder:
   ```bash
   git remote add origin https://github.com/<you>/civicsync.git
   git branch -M main
   git push -u origin main
   ```
2. vercel.com → Add New → Project → import the repo (Vite is auto-detected).
3. Settings → Environment Variables → add the variables above → Deploy.

## Path B — Vercel CLI (no GitHub needed)

```bash
npm i -g vercel
vercel login
vercel --prod \
  -e VITE_SUPABASE_URL=https://<ref>.supabase.co \
  -e VITE_SUPABASE_PUBLISHABLE_KEY=<anon key> \
  -e VITE_MAP_LATITUDE=12.95 -e VITE_MAP_LONGITUDE=80.17 -e VITE_MAP_ZOOM=11 \
  --yes
```

With a Vercel access token (vercel.com → Account → Settings → Tokens) the deploy
is non-interactive: add `--token <TOKEN>` to the command above.

## After the first deploy — IMPORTANT

Copy your `https://<app>.vercel.app` URL into **Supabase → Authentication → URL
Configuration** (Site URL + Redirect URLs), and add it to your Google OAuth
client's **Authorized JavaScript origins** and the Supabase callback stays as the
**Authorized redirect URI**. Without this, email confirmation and Google sign-in
redirect to the wrong place.

## Troubleshooting

- **Setup screen on the live site** → env vars weren't set at build time. Add
  them and redeploy.
- **404 on refreshing /forum** → `vercel.json` rewrites handle this; make sure it
  was included in the deploy.
- **Google sign-in error** → origins/redirect URI not matching the deployed URL,
  or the user isn't a Google "test user" while the consent screen is in Testing.
