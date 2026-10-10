-- ============================================================================
-- CivicSync — SAMPLE demand-board seed (pre-approved, so the board looks alive)
-- ----------------------------------------------------------------------------
-- Run in the Supabase SQL Editor AFTER migration_forum.sql.
-- Every row is clearly labelled [Sample]. Upvote counts are illustrative demo
-- figures (set directly for display); they reset to real votes once residents
-- start voting. Idempotent: re-running does nothing if samples already exist.
-- Demands are authored by your existing admin account.
-- ============================================================================
do $$
declare v_author uuid;
begin
  select id into v_author from public.profiles order by (role = 'admin') desc, created_at asc limit 1;
  if v_author is null then
    raise notice 'No profile found. Sign up / create your admin account first, then re-run this file.';
    return;
  end if;
  if exists (select 1 from public.forum_posts where title like '[Sample]%') then
    raise notice 'Sample demands already present — nothing to do.';
    return;
  end if;

  insert into public.forum_posts
    (author_id, title, body, end_goal, area, work_type, status, reviewed_by, reviewed_at, upvotes, downvotes, score, created_at)
  values
    (v_author,
     '[Sample] Fix potholes on GST Road, Perungalathur',
     'The stretch of GST Road near Perungalathur station has deep potholes. Two-wheelers skid daily during peak hours and after rain it is dangerous. This is a heavy commuting corridor with no real alternate route.',
     'Pothole work on GST Road done ASAP — heavy commuting, no alternate route',
     'Perungalathur', 'road_repair', 'approved', v_author, now(), 142, 6, 136, now() - interval '6 days'),

    (v_author,
     '[Sample] Finish the 100 Feet Road stormwater drain before the monsoon',
     'The stormwater drain work on 100 Feet Road, Velachery has been dragging on. Every heavy shower floods the junction and shops shut for hours. Please complete it before the NE monsoon peaks.',
     'Complete the stormwater drain before the monsoon peaks',
     'Velachery', 'stormwater', 'approved', v_author, now(), 98, 3, 95, now() - interval '4 days'),

    (v_author,
     '[Sample] Restore streetlights on 2nd Main Road, Adyar',
     'A long stretch of 2nd Main Road has been dark for weeks. It feels unsafe at night, especially for women and senior citizens walking back from the bus stop.',
     'Restore streetlights for safety at night',
     'Adyar', 'electricity', 'approved', v_author, now(), 67, 1, 66, now() - interval '3 days'),

    (v_author,
     '[Sample] Re-lay the OMR service road at Thoraipakkam',
     'The OMR service road near Thoraipakkam toll is broken and throws up dust all day. Nearby shops and commuters are badly affected. Needs re-laying and dust control.',
     'Re-lay the service road and control the dust',
     'Thoraipakkam (OMR)', 'road_repair', 'approved', v_author, now(), 54, 4, 50, now() - interval '2 days'),

    (v_author,
     '[Sample] Stabilise and publish the water supply timing in Guduvanchery',
     'Water supply timing in parts of Guduvanchery is erratic and residents never know when to store water. A published, reliable schedule would help everyone plan.',
     'Publish and stabilise the water supply schedule',
     'Guduvanchery', 'water_pipeline', 'approved', v_author, now(), 41, 2, 39, now() - interval '1 day'),

    (v_author,
     '[Sample] Daily garbage clearing near Besant Nagar beach',
     'Garbage piles up near the Besant Nagar beach entrance over weekends. More bins and daily clearing would keep one of our best public spaces clean.',
     'Daily clearing and more bins near the beach',
     'Besant Nagar', 'other', 'approved', v_author, now(), 33, 5, 28, now() - interval '8 hours');

  raise notice 'Seeded 6 sample demands, authored by profile %.', v_author;
end $$;
