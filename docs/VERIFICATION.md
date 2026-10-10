# Verification record

## Executed
- **Backend** applied to PostgreSQL 16: `schema.sql`, `functions.sql`,
  `policies.sql`, all migrations and seeds apply cleanly.
- **Dig-Once engine** — South Chennai scenario: schedule overlap, look-ahead
  repeat-dig, proximity, and a far-away project raising no conflict — all correct.
- **RLS auth matrix — 18/18 PASS**: [logged-out, user, admin] × [read, write,
  delete] × [own-data, others-data, admin-endpoint]. Spoofing, cross-user edits
  and admin-endpoint calls by non-admins are all denied; admins and owners are
  allowed as expected.
- **Guards**: direct project status edits blocked (must go through
  `project_updates`); completing a project clears its conflicts; conflicts are
  engine-written only.
- **Demand board**: verified-resident gate, one-vote-per-user, admin moderation,
  and the **2-demands/day** cap all behave correctly (incl. the recursion fix).
- **Frontend**: passes `tsc --noEmit` and a production `vite build`.

## Not executed here
- Live Supabase Auth/Storage, live open-API calls and the deployed site are
  exercised against a real project at deploy time, not in the authoring sandbox.
- Figures for third-party API responses depend on live data.
