-- ============================================================================
-- CivicSync — functions, triggers, the Dig-Once engine, views and RPCs.
-- Apply AFTER schema.sql and policies.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Geospatial helper: great-circle distance in metres (no PostGIS needed).
-- ---------------------------------------------------------------------------
create or replace function public.haversine_m(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision language sql immutable parallel safe as $$
  select 2 * 6371000 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ))
$$;

-- Tunable Dig-Once parameters (one place to calibrate).
create or replace function public.dig_proximity_m()  returns double precision language sql immutable as $$ select 150.0  $$;
create or replace function public.dig_lookahead_days() returns integer         language sql immutable as $$ select 180    $$;

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER avoids recursive profile RLS).
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role() returns public.user_role
  language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.approval_status = 'approved' $$;

create or replace function public.current_user_department() returns uuid
  language sql stable security definer set search_path = '' as $$
  select p.department_id from public.profiles p
  where p.id = (select auth.uid()) and p.role = 'official' and p.approval_status = 'approved' $$;

create or replace function public.is_project_manager(p_department_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select coalesce(
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'official' and public.current_user_department() = p_department_id),
  false) $$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_department() from public;
revoke all on function public.is_project_manager(uuid) from public;
grant execute on function public.current_user_role()       to authenticated;
grant execute on function public.current_user_department() to authenticated;
grant execute on function public.is_project_manager(uuid)  to authenticated;

-- ---------------------------------------------------------------------------
-- Profile provisioning. New signups are always plain citizens; user metadata
-- can never grant a privileged role.
-- ---------------------------------------------------------------------------
create or replace function public.create_profile_for_auth_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, role, approval_status)
  values (new.id, nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'citizen', 'approved')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

create or replace function public.set_updated_at() returns trigger
  language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log on every project write.
-- ---------------------------------------------------------------------------
create or replace function public.audit_project_change() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.project_audit_log(project_id, actor_id, action, new_values)
    values (new.id, (select auth.uid()), 'insert', to_jsonb(new));
    return new;
  elsif TG_OP = 'UPDATE' then
    insert into public.project_audit_log(project_id, actor_id, action, old_values, new_values)
    values (new.id, (select auth.uid()), 'update', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.project_audit_log(project_id, actor_id, action, old_values)
    values (old.id, (select auth.uid()), 'delete', to_jsonb(old));
    return old;
  end if;
end $$;
create trigger projects_audit after insert or update or delete on public.projects
  for each row execute function public.audit_project_change();

-- ---------------------------------------------------------------------------
-- A project_update is the ONLY legitimate way to change status/progress.
-- Inserting one syncs the parent project; direct status edits are blocked.
-- ---------------------------------------------------------------------------
create or replace function public.apply_project_update() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('civicsync.timeline_write', 'on', true);
  update public.projects set
    status           = new.status,
    progress_percent = new.progress_percent,
    revised_end_date = coalesce(new.revised_end_date, revised_end_date),
    actual_end_date  = case when new.status = 'completed' then current_date else actual_end_date end,
    version          = version + 1
  where id = new.project_id;
  perform set_config('civicsync.timeline_write', 'off', true);
  return new;
end $$;
create trigger project_update_sync after insert on public.project_updates
  for each row execute function public.apply_project_update();

create or replace function public.require_timeline_for_status_change() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if (new.status, new.progress_percent, new.revised_end_date, new.actual_end_date)
       is distinct from (old.status, old.progress_percent, old.revised_end_date, old.actual_end_date)
     and current_setting('civicsync.timeline_write', true) is distinct from 'on' then
    raise exception 'Use project_updates to change status, progress or completion dates.';
  end if;
  return new;
end $$;
create trigger projects_timeline_guard before update on public.projects
  for each row execute function public.require_timeline_for_status_change();

-- ===========================================================================
-- THE DIG-ONCE ENGINE
-- ---------------------------------------------------------------------------
-- For a project, (re)compute conflicts against every other active project.
-- Three ways a pair conflicts:
--   schedule_overlap : active dates overlap AND spatially close    → classic clash
--   lookahead_repeat : a road_repair finishing, then an intrusive dig
--                       starting within dig_lookahead_days() nearby → "paved then dug"
--   proximity        : close + both active but dates far apart      → advisory heads-up
-- Pairs are stored canonically (a<b), idempotently (one row per pair).
-- ===========================================================================
create or replace function public.intrusive(w public.work_type) returns boolean
  language sql immutable as $$ select w in
    ('road_repair','water_pipeline','sewer_drainage','electricity','telecom','gas','stormwater') $$;

create or replace function public.detect_conflicts_for_project(p_project_id uuid) returns integer
  language plpgsql security definer set search_path = '' as $$
declare
  p            public.projects%rowtype;
  q            public.projects%rowtype;
  a_id         uuid;
  b_id         uuid;
  dist         double precision;
  spatial_near boolean;
  v_overlaps     boolean;
  gap_days     integer;
  ctype        public.conflict_type;
  why          text;
  v_count      integer := 0;
begin
  select * into p from public.projects where id = p_project_id;
  if not found then return 0; end if;

  -- Any previously-current conflict for this project may now be stale.
  update public.project_conflicts
     set is_current = false, updated_at = now()
   where (project_a_id = p_project_id or project_b_id = p_project_id)
     and status in ('open') and is_current = true;

  if p.status not in ('planned','ongoing','delayed') then
    return 0; -- completed/cancelled work raises nothing new
  end if;

  for q in
    select * from public.projects
    where id <> p.id and status in ('planned','ongoing','delayed')
  loop
    -- spatial test: shared segment id OR within the proximity radius.
    -- coalesce() keeps NULL segment comparisons from making the gate fail open.
    dist := public.haversine_m(p.latitude, p.longitude, q.latitude, q.longitude);
    spatial_near :=
      coalesce(p.road_segment_id = q.road_segment_id, false)
      or dist <= public.dig_proximity_m();
    if not coalesce(spatial_near, false) then continue; end if;
    if not (public.intrusive(p.work_type) and public.intrusive(q.work_type)) then continue; end if;

    v_overlaps := p.start_date <= coalesce(q.revised_end_date, q.end_date)
            and q.start_date <= coalesce(p.revised_end_date, p.end_date);

    if v_overlaps then
      ctype := 'schedule_overlap';
      why := format('Overlapping schedules on %s: "%s" (%s) and "%s" (%s) are both active between %s and %s, within %sm.',
                    p.road_name, p.title, p.work_type, q.title, q.work_type,
                    greatest(p.start_date, q.start_date),
                    least(coalesce(p.revised_end_date,p.end_date), coalesce(q.revised_end_date,q.end_date)),
                    round(dist)::text);
    else
      -- look-ahead: resurfacing then an intrusive dig (or vice-versa) within the window
      gap_days := least(
        abs(coalesce(p.revised_end_date,p.end_date) - q.start_date),
        abs(coalesce(q.revised_end_date,q.end_date) - p.start_date));
      if gap_days <= public.dig_lookahead_days()
         and (p.work_type = 'road_repair' or q.work_type = 'road_repair') then
        ctype := 'lookahead_repeat';
        why := format('Repeat-dig risk on %s: a resurfacing and an intrusive dig are scheduled %s days apart within %sm. Coordinating them avoids cutting a freshly paved road.',
                      p.road_name, gap_days::text, round(dist)::text);
      elsif dist <= public.dig_proximity_m() then
        ctype := 'proximity';
        why := format('Nearby works on %s: "%s" and "%s" are within %sm. Dates do not overlap but coordination may still help.',
                      p.road_name, p.title, q.title, round(dist)::text);
      else
        continue;
      end if;
    end if;

    a_id := least(p.id, q.id);
    b_id := greatest(p.id, q.id);

    insert into public.project_conflicts(project_a_id, project_b_id, conflict_type, reason, distance_m, status, is_current)
    values (a_id, b_id, ctype, why, round(dist)::double precision, 'open', true)
    on conflict (project_a_id, project_b_id) do update
      set is_current    = true,
          updated_at    = now(),
          distance_m    = excluded.distance_m,
          conflict_type = excluded.conflict_type,
          reason        = excluded.reason,
          -- a settled decision is only reopened if the pair materially re-qualifies
          status        = case when public.project_conflicts.status = 'cleared'
                               then 'open' else public.project_conflicts.status end;
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- Mark conflicts that no longer qualify as cleared (run after a project changes).
create or replace function public.clear_stale_conflicts() returns void
  language sql security definer set search_path = '' as $$
  update public.project_conflicts c
     set status = 'cleared', is_current = false, updated_at = now()
   where c.status = 'open' and c.is_current = false;
$$;

create or replace function public.on_project_change_detect() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform public.detect_conflicts_for_project(new.id);
  perform public.clear_stale_conflicts();
  return new;
end $$;
create trigger projects_detect_conflicts after insert or update on public.projects
  for each row execute function public.on_project_change_detect();

-- Manual re-check (frontend "Re-check" button).
create or replace function public.recheck_project_conflicts(p_project_id uuid) returns integer
  language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.is_project_manager((select department_id from public.projects where id = p_project_id)) then
    raise exception 'Not authorized';
  end if;
  n := public.detect_conflicts_for_project(p_project_id);
  perform public.clear_stale_conflicts();
  return n;
end $$;

-- ===========================================================================
-- Dashboard, scorecard, nearby, impact — read models for the UI.
-- ===========================================================================
create or replace function public.get_dashboard_stats()
  returns table(total_projects bigint, active_projects bigint, completed_projects bigint,
                open_reports bigint, open_conflicts bigint, repeat_digs_prevented bigint)
  language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.projects),
    (select count(*) from public.projects where status in ('planned','ongoing','delayed')),
    (select count(*) from public.projects where status = 'completed'),
    (select count(*) from public.citizen_reports where status in ('open','under_review')),
    (select count(*) from public.project_conflicts where status in ('open','coordinating') and is_current),
    (select count(*) from public.project_conflicts where conflict_type = 'lookahead_repeat' and status in ('resolved','coordinating'))
$$;

-- Per-department accountability. On-time rate, average delay, report responsiveness.
create or replace view public.department_scorecard as
  select
    d.id as department_id,
    d.name as department_name,
    count(p.id) filter (where p.status = 'completed') as completed,
    count(p.id) filter (where p.status in ('planned','ongoing','delayed')) as active,
    count(p.id) filter (where p.status in ('ongoing','delayed')
                          and coalesce(p.revised_end_date, p.end_date) < current_date) as overdue,
    round(100.0 * count(p.id) filter (where p.status = 'completed'
          and coalesce(p.actual_end_date, p.end_date) <= p.end_date)
          / nullif(count(p.id) filter (where p.status = 'completed'), 0), 0) as on_time_pct,
    round(avg(greatest(coalesce(p.actual_end_date, current_date) - p.end_date, 0))
          filter (where p.status in ('ongoing','delayed','completed')), 1) as avg_delay_days,
    (select count(*) from public.citizen_reports r
       join public.projects pr on pr.id = r.project_id where pr.department_id = d.id) as reports_received,
    (select round(100.0 * count(*) filter (where r.status in ('resolved','dismissed'))
            / nullif(count(*), 0), 0) from public.citizen_reports r
       join public.projects pr on pr.id = r.project_id where pr.department_id = d.id) as report_response_pct
  from public.departments d
  left join public.projects p on p.department_id = d.id
  group by d.id, d.name
  order by d.name;
grant select on public.department_scorecard to anon, authenticated;

-- Active projects within radius of a point (for "My area" and report matching).
create or replace function public.projects_near(p_lat double precision, p_lng double precision, p_radius_m integer default 800)
  returns table(id uuid, title text, road_name text, work_type public.work_type, status public.project_status,
                department_id uuid, start_date date, end_date date, latitude double precision,
                longitude double precision, distance_m double precision)
  language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.road_name, p.work_type, p.status, p.department_id,
         p.start_date, p.end_date, p.latitude, p.longitude,
         round(public.haversine_m(p_lat, p_lng, p.latitude, p.longitude))::double precision as distance_m
  from public.projects p
  where p.status in ('planned','ongoing','delayed')
    and public.haversine_m(p_lat, p_lng, p.latitude, p.longitude) <= greatest(100, least(p_radius_m, 5000))
  order by distance_m
$$;

-- ===========================================================================
-- Protected write RPCs (auth checked server-side).
-- ===========================================================================
create or replace function public.review_citizen_report(p_report_id uuid, p_status public.report_status, p_response text default null)
  returns void language plpgsql security definer set search_path = '' as $$
declare v_department uuid; v_matched uuid;
begin
  if p_status not in ('under_review','resolved','dismissed') then raise exception 'Invalid report status'; end if;
  select coalesce(p.department_id,
                  (select department_id from public.projects where id = r.matched_project_id)), r.matched_project_id
    into v_department, v_matched
    from public.citizen_reports r left join public.projects p on p.id = r.project_id
   where r.id = p_report_id;
  -- Unregistered reports (no department yet) may be triaged by any approved official or admin.
  if v_department is null then
    if public.current_user_role() not in ('official','admin') then raise exception 'Not authorized'; end if;
  elsif not public.is_project_manager(v_department) then
    raise exception 'Not authorized';
  end if;
  if p_response is not null and char_length(trim(p_response)) > 2000 then raise exception 'Response too long'; end if;
  update public.citizen_reports
     set status = p_status, official_response = nullif(trim(p_response), ''),
         reviewed_by = (select auth.uid()), reviewed_at = now()
   where id = p_report_id;
end $$;

-- Link an unregistered report to a project (official triage).
create or replace function public.match_report_to_project(p_report_id uuid, p_project_id uuid)
  returns void language plpgsql security definer set search_path = '' as $$
declare v_dept uuid;
begin
  select department_id into v_dept from public.projects where id = p_project_id;
  if v_dept is null or not public.is_project_manager(v_dept) then raise exception 'Not authorized'; end if;
  update public.citizen_reports
     set matched_project_id = p_project_id, status = 'under_review',
         reviewed_by = (select auth.uid()), reviewed_at = now()
   where id = p_report_id;
end $$;

create or replace function public.resolve_project_conflict(p_conflict_id uuid, p_status public.conflict_status, p_resolution_note text)
  returns void language plpgsql security definer set search_path = '' as $$
declare v_a uuid; v_b uuid;
begin
  if p_status not in ('coordinating','resolved','dismissed') then raise exception 'Invalid conflict status'; end if;
  if char_length(trim(coalesce(p_resolution_note, ''))) < 3 or char_length(p_resolution_note) > 2000 then
    raise exception 'A resolution note is required'; end if;
  select a.department_id, b.department_id into v_a, v_b
    from public.project_conflicts c
    join public.projects a on a.id = c.project_a_id
    join public.projects b on b.id = c.project_b_id
   where c.id = p_conflict_id;
  if v_a is null or not (public.is_project_manager(v_a) or public.is_project_manager(v_b)) then
    raise exception 'Not authorized'; end if;
  update public.project_conflicts
     set status = p_status, resolution_note = trim(p_resolution_note),
         reviewed_by = (select auth.uid()), reviewed_at = now(), updated_at = now()
   where id = p_conflict_id;
end $$;

create or replace function public.approve_official(p_user_id uuid, p_department_id uuid, p_approval public.approval_status default 'approved')
  returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.current_user_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
  update public.profiles set role = 'official', department_id = p_department_id, approval_status = p_approval where id = p_user_id;
  if not found then raise exception 'Profile not found'; end if;
end $$;

create or replace function public.request_official_access(p_department_id uuid)
  returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = 'official', department_id = p_department_id, approval_status = 'pending'
   where id = (select auth.uid()) and (role = 'citizen' or (role = 'official' and approval_status = 'rejected'));
  if not found then raise exception 'Profile cannot request official access'; end if;
end $$;

-- Shared enrichment cache upsert (called by the client after a live API fetch).
create or replace function public.cache_enrichment(p_key text, p_payload jsonb)
  returns void language sql security definer set search_path = '' as $$
  insert into public.enrichment_cache(cache_key, payload, fetched_at)
  values (p_key, p_payload, now())
  on conflict (cache_key) do update set payload = excluded.payload, fetched_at = now();
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.get_dashboard_stats() from public;
revoke all on function public.projects_near(double precision,double precision,integer) from public;
revoke all on function public.recheck_project_conflicts(uuid) from public;
revoke all on function public.review_citizen_report(uuid,public.report_status,text) from public;
revoke all on function public.match_report_to_project(uuid,uuid) from public;
revoke all on function public.resolve_project_conflict(uuid,public.conflict_status,text) from public;
revoke all on function public.approve_official(uuid,uuid,public.approval_status) from public;
revoke all on function public.request_official_access(uuid) from public;
revoke all on function public.cache_enrichment(text,jsonb) from public;

grant execute on function public.get_dashboard_stats()                                   to anon, authenticated;
grant execute on function public.projects_near(double precision,double precision,integer) to anon, authenticated;
grant execute on function public.recheck_project_conflicts(uuid)                          to authenticated;
grant execute on function public.review_citizen_report(uuid,public.report_status,text)    to authenticated;
grant execute on function public.match_report_to_project(uuid,uuid)                       to authenticated;
grant execute on function public.resolve_project_conflict(uuid,public.conflict_status,text) to authenticated;
grant execute on function public.approve_official(uuid,uuid,public.approval_status)       to authenticated;
grant execute on function public.request_official_access(uuid)                            to authenticated;
grant execute on function public.cache_enrichment(text,jsonb)                             to authenticated;
