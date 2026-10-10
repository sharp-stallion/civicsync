# The Dig-Once engine

Server-side, in `functions.sql`. A trigger on `projects` (insert/update) calls
`detect_conflicts_for_project()` in the same transaction, so detection cannot be
bypassed from the browser. Distance uses `haversine_m()` — no PostGIS needed, so
it runs on any PostgreSQL.

## When a pair conflicts

Both projects must be **active** (`planned` / `ongoing` / `delayed`) and both an
**intrusive** work type. Then, if they are spatially close — a shared
`road_segment_id`, **or** within `dig_proximity_m()` (default **150 m**):

| Type | Condition | Meaning |
| --- | --- | --- |
| `schedule_overlap` | active dates overlap | Classic clash — coordinate now |
| `lookahead_repeat` | not overlapping, but within `dig_lookahead_days()` (default **180**) and one side is a resurfacing | **Paving-then-digging risk** — agree one combined window |
| `proximity` | close, active, dates far apart, no resurfacing | Advisory heads-up |

Pairs are stored canonically (`project_a_id < project_b_id`) with a unique
index, so re-running detection updates one row instead of duplicating. A pair
that stops qualifying becomes `cleared`; a settled decision is not silently
reopened.

## Tuning

```sql
create or replace function public.dig_proximity_m()   returns double precision ... select 150.0;
create or replace function public.dig_lookahead_days() returns integer          ... select 180;
```

Change these to calibrate to survey quality and local rules, then re-run
`detect_conflicts_for_project()` for affected projects.

## Tested behaviour (PostgreSQL 16)

A South Chennai scenario was applied to a clean database:

- Adyar resurfacing **×** water main, overlapping dates, 25 m → `schedule_overlap` ✓
- Adyar resurfacing **×** fibre trench, 80 days later, 49 m → `lookahead_repeat` ✓
- Adyar water **×** fibre, near but dates apart → `proximity` ✓
- Velachery stormwater **×** HT cable, overlapping, 31 m → `schedule_overlap` ✓
- A project 4.5 km away → **no conflict** ✓

Also verified: direct `projects.status` edits are rejected (must go through
`project_updates`); completing a project clears its open conflicts; `anon` can
read projects/conflicts but cannot write; direct conflict inserts are denied.

### Edge case fixed during development

A NULL-logic bug: when one project had a `road_segment_id` and the other did
not, `segA = segB` evaluated to `NULL`, and `NULL OR (dist<=150)` stayed `NULL`,
so `IF NOT spatial_near` fell through and flagged works kilometres apart. Fixed
with `coalesce(segA = segB, false)`. Worth knowing before a live demo.
