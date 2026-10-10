# CivicSync — South Chennai

**Public-works transparency, _Dig-Once_ coordination, and a citizen demand board for South Chennai.**

🔗 **Live demo:** https://civicsync-gamma.vercel.app
🛠 **Stack:** React 19 + Vite + TypeScript · Supabase (PostgreSQL + Auth + RLS + Storage) · Leaflet/OpenStreetMap · deployed on Vercel

One place where residents see every registered dig — its purpose, timeline and the
department responsible — where departments are warned *before* the same road is
cut open twice, and where citizens raise and upvote what needs fixing.

> No data is faked. An unconfigured app shows a setup screen, not fake projects.
> Seed rows are clearly labelled samples.

---

## The problem (hackathon brief)

Information about public works is scattered across offices and notice boards and
rarely reaches residents. Departments dig without knowing each other's plans, so
a freshly paved road is cut open weeks later for a pipe. When work stalls there
is no simple way to follow up or hold anyone accountable.

## What CivicSync does

| Capability | Who | Solves |
| --- | --- | --- |
| **Register of works** — purpose, department, contractor, cost, timeline, map | Everyone views; officials register | "What is this, who's responsible, how long?" |
| **Dig-Once engine** — flags overlapping *and* repeat-dig works on a shared stretch | Automatic, server-side | The core pain: paving then digging |
| **Report an issue** by map-pin + photo, incl. **digging not on the register** | Residents | Catch undisclosed work; close the loop |
| **Reports inbox** with public responses | Officials | Accountability — residents hear back |
| **Citizen Demand Board** — raise a demand with an **end goal**, upvote, comment, with photos | Residents + admins | Quantify public demand; convert to projects |
| **My area** — nearby upcoming works + **calendar (.ics)** download | Residents | Plan around disruptions |
| **Department scoreboard** — on-time %, avg delay, response rate (charts) | Everyone | Transparency & pressure to improve |
| **Predicted delay risk** — transparent heuristic (dept record + schedule + monsoon + live rain) | Everyone | Early warning, no black box |
| **Vernacular UI** — English / தமிழ் / हिन्दी | Everyone | Accessibility for Chennai |
| **Light / dark mode** | Everyone | Comfort |

### The standout: the look-ahead repeat-dig rule
Most tools only catch works whose dates *overlap*. CivicSync also catches the
brief's real pain — a road **resurfaced**, then **dug up** months later. When a
resurfacing and an intrusive dig fall within 180 days on the same stretch (shared
segment id, or within 150 m), it raises a `lookahead_repeat` alert so officials
can agree one combined dig window. See [`docs/DIG_ONCE.md`](docs/DIG_ONCE.md).

### Roles (enforced by Row-Level Security, verified 18/18 in tests)
- **Guest** — browse works, map, Dig-Once, scoreboard, demand board.
- **Citizen** — report issues, raise demands (2/day) with photos, upvote, comment.
- **Official** — register & update projects, respond to reports, resolve conflicts (own department).
- **Admin** — approve officials, moderate the demand board, see all.

---

## Run it locally

Prerequisites: **Node 20.19+** and a free **Supabase** project.

### 1. Backend — run these SQL files in the Supabase SQL Editor, in order:
```
supabase/schema.sql
supabase/functions.sql
supabase/policies.sql
supabase/seed_south_chennai.sql        # optional: sample projects
supabase/migration_forum.sql           # demand board
supabase/migration_v3_security.sql     # 2-demands/day cap + audit
supabase/migration_v4_demand_images.sql# demand photos
supabase/seed_demands.sql              # optional: sample demands
```
Then make yourself admin (after signing up once in the app):
```sql
update public.profiles p set role='admin', approval_status='approved', department_id=null
from auth.users u where p.id=u.id and lower(u.email)=lower('YOU@example.com');
```

### 2. Frontend
```bash
cp .env.example .env.local     # set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev                    # http://localhost:5173
```

## Deploy to Vercel
Push to GitHub → import in Vercel (Vite auto-detected) → add the `VITE_*` env
vars in Project Settings → deploy. Then add your production URL to
**Supabase → Auth → URL Configuration** (Site URL + Redirect URLs) and, for
Google sign-in, to your Google OAuth **Authorized JavaScript origins**.
Full notes: [`docs/VERCEL.md`](docs/VERCEL.md) · [`docs/GOOGLE_AUTH.md`](docs/GOOGLE_AUTH.md).

## Push this to your own GitHub
```bash
cd civicsync
git init
git add .
git commit -m "CivicSync — South Chennai: public works transparency + Dig-Once + demand board"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```
`.env.local` and `node_modules` are git-ignored, so no secrets are committed.
(If commits should be authored by you: `git config user.name "You"` and
`git config user.email "you@example.com"` before committing.)

## Open-source libraries & APIs (disclosed)
React, Vite, TypeScript, React Router, Leaflet + react-leaflet, i18next,
`@supabase/supabase-js`. Data: OpenStreetMap tiles & Nominatim, Open-Meteo,
OpenAQ, Overpass. Licences and the **rate-limiting** approach:
[`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

## Honest limitations
- Dig-Once alerts identify **potential** coordination needs, not engineering
  proof. The 150 m radius / 180-day window are tunable choices, not standards.
- The detector only knows **registered** works.
- The delay-risk score is a **heuristic**, not a prediction guarantee.
- Seed rows (`[Pilot]`, `[Sample]`) are demonstration data, not real municipal works.
- There is no official open feed of live Chennai roadworks; the register is
  filled by departments. Open APIs add context (weather, air, geocoding, roads).

## Repo structure
```
src/
  pages/         Dashboard, Projects, ProjectDetail/Editor, Report, MyReports,
                 Inbox, Conflicts, Forum, ForumPost, MyArea, Scoreboard, Admin, Auth, Setup
  components/    Map, charts, cards, Layout, LanguageSwitcher, ThemeToggle, …
  services/      typed Supabase calls (projects, reports, updates, conflicts, forum, …)
  integrations/  open-data APIs (nominatim, openmeteo, openaq)
  lib/           types, rate limiter, geo/haversine, predict, i18n, format
  i18n/          English / Tamil / Hindi dictionaries
supabase/        schema, functions (Dig-Once engine), policies (RLS), migrations, seeds
api/             optional Vercel Edge upload validator
docs/            setup, deploy, data sources, dig-once, demo script, spam prevention
scripts/         offline OSM seeding
```

## What was verified
Backend applied to PostgreSQL 16; the Dig-Once engine, RLS (18/18 auth matrix),
timeline guard, scoreboard and the 2/day cap tested end-to-end. Frontend passes
`tsc` and a production `vite build`. See [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Licence
MIT — see [`LICENSE`](LICENSE).
