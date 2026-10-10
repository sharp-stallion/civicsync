-- ============================================================================
-- CivicSync — Migration: resident profiles + the Citizen Demand Board (forum)
-- ----------------------------------------------------------------------------
-- ADDITIVE. Run on an existing database AFTER schema/functions/policies/seed.
-- Safe to re-run (guards with IF NOT EXISTS / duplicate_object).
--
-- Adds: name + home area on profiles; a verified-resident anti-spam gate
-- (signed in + profile completed with an area; email is confirmed upstream by
-- Supabase); and a demand board where residents raise an issue with a concrete
-- END GOAL, others upvote/downvote and comment, admins moderate, and an
-- official can convert a popular demand into a registered project.
-- ============================================================================

-- ---- profiles: name is already full_name; add home area + phone_verified ----
alter table public.profiles add column if not exists home_area text
  check (home_area is null or char_length(home_area) <= 80);
alter table public.profiles add column if not exists phone_verified boolean not null default false;

-- Let residents set their own name + area (phone_verified is server-only).
grant update(full_name, home_area) on public.profiles to authenticated;

-- Capture home_area at signup from auth metadata, alongside full_name.
create or replace function public.create_profile_for_auth_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, home_area, role, approval_status)
  values (new.id,
          nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
          nullif(trim(new.raw_user_meta_data->>'home_area'), ''),
          'citizen', 'approved')
  on conflict (id) do nothing;
  return new;
end $$;

-- A "verified resident" = signed in, approved, and has completed their profile
-- (a home area). This is the anti-spam gate for posting, voting and commenting.
create or replace function public.is_verified_resident() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.approval_status = 'approved'
      and nullif(trim(coalesce(p.home_area, '')), '') is not null
  ) $$;
revoke all on function public.is_verified_resident() from public;
grant execute on function public.is_verified_resident() to authenticated;

-- ---- Demand board tables ----------------------------------------------------
do $$ begin create type public.forum_status as enum ('pending','approved','rejected','converted');
exception when duplicate_object then null; end $$;

create table if not exists public.forum_posts (
  id                   uuid primary key default gen_random_uuid(),
  author_id            uuid not null references public.profiles(id) on delete cascade,
  title                text not null check (char_length(trim(title)) between 6 and 160),
  body                 text not null check (char_length(trim(body)) between 10 and 4000),
  end_goal             text not null check (char_length(trim(end_goal)) between 6 and 280),
  area                 text not null check (char_length(trim(area)) between 2 and 80),
  work_type            public.work_type,
  latitude             double precision check (latitude is null or latitude between -90 and 90),
  longitude            double precision check (longitude is null or longitude between -180 and 180),
  status               public.forum_status not null default 'pending',
  upvotes              integer not null default 0,
  downvotes            integer not null default 0,
  score                integer not null default 0,
  reviewed_by          uuid references public.profiles(id) on delete set null,
  reviewed_at          timestamptz,
  converted_project_id uuid references public.projects(id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists forum_posts_status_score_idx on public.forum_posts(status, score desc, created_at desc);
create index if not exists forum_posts_area_idx on public.forum_posts(lower(area));

create table if not exists public.forum_votes (
  post_id    uuid not null references public.forum_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.forum_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.forum_posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(trim(body)) between 2 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists forum_comments_post_idx on public.forum_comments(post_id, created_at);

-- Keep cached vote counts on the post (so lists sort cheaply).
create or replace function public.recount_forum_votes() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  pid := coalesce(new.post_id, old.post_id);
  update public.forum_posts set
    upvotes   = (select count(*) from public.forum_votes where post_id = pid and value = 1),
    downvotes = (select count(*) from public.forum_votes where post_id = pid and value = -1),
    score     = (select coalesce(sum(value), 0) from public.forum_votes where post_id = pid)
  where id = pid;
  return null;
end $$;
drop trigger if exists forum_votes_recount on public.forum_votes;
create trigger forum_votes_recount after insert or update or delete on public.forum_votes
  for each row execute function public.recount_forum_votes();

-- ---- RPCs -------------------------------------------------------------------
-- Vote: +1 / -1, or 0 to clear. One vote per resident (enforced by PK + upsert).
create or replace function public.cast_forum_vote(p_post_id uuid, p_value smallint) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified_resident() then raise exception 'Add your name and area to your profile before voting.'; end if;
  if p_value not in (-1, 0, 1) then raise exception 'Invalid vote'; end if;
  if p_value = 0 then
    delete from public.forum_votes where post_id = p_post_id and user_id = (select auth.uid());
  else
    insert into public.forum_votes(post_id, user_id, value) values (p_post_id, (select auth.uid()), p_value)
    on conflict (post_id, user_id) do update set value = excluded.value, created_at = now();
  end if;
end $$;

create or replace function public.moderate_forum_post(p_post_id uuid, p_status public.forum_status) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if public.current_user_role() not in ('official','admin') then raise exception 'Not authorized'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Use link_demand_to_project to convert a demand.'; end if;
  update public.forum_posts set status = p_status, reviewed_by = (select auth.uid()), reviewed_at = now() where id = p_post_id;
end $$;

create or replace function public.link_demand_to_project(p_post_id uuid, p_project_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
declare v_dept uuid;
begin
  select department_id into v_dept from public.projects where id = p_project_id;
  if v_dept is null or not public.is_project_manager(v_dept) then raise exception 'Not authorized'; end if;
  update public.forum_posts set status = 'converted', converted_project_id = p_project_id,
         reviewed_by = (select auth.uid()), reviewed_at = now() where id = p_post_id;
end $$;

-- Admin / official overview counts.
create or replace function public.get_forum_stats()
  returns table(pending_demands bigint, approved_demands bigint, converted_demands bigint, total_votes bigint)
  language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.forum_posts where status = 'pending'),
    (select count(*) from public.forum_posts where status = 'approved'),
    (select count(*) from public.forum_posts where status = 'converted'),
    (select count(*) from public.forum_votes)
$$;

-- ---- RLS --------------------------------------------------------------------
alter table public.forum_posts    enable row level security;
alter table public.forum_votes    enable row level security;
alter table public.forum_comments enable row level security;

grant select on public.forum_posts, public.forum_comments to anon, authenticated;
grant select on public.forum_votes to authenticated;
grant insert on public.forum_posts, public.forum_comments to authenticated;

create policy forum_posts_read on public.forum_posts for select to anon, authenticated using (
  status in ('approved','converted') or author_id = (select auth.uid()) or public.current_user_role() in ('official','admin'));
create policy forum_posts_insert on public.forum_posts for insert to authenticated with check (
  author_id = (select auth.uid()) and status = 'pending' and public.is_verified_resident());
revoke update, delete on public.forum_posts from anon, authenticated;  -- moderation via RPC only

create policy forum_votes_read on public.forum_votes for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.forum_votes from anon, authenticated;  -- via cast_forum_vote RPC only

create policy forum_comments_read on public.forum_comments for select to anon, authenticated using (
  exists (select 1 from public.forum_posts p where p.id = post_id
          and (p.status in ('approved','converted') or p.author_id = (select auth.uid()) or public.current_user_role() in ('official','admin'))));
create policy forum_comments_insert on public.forum_comments for insert to authenticated with check (
  author_id = (select auth.uid()) and public.is_verified_resident()
  and exists (select 1 from public.forum_posts p where p.id = post_id and p.status in ('approved','converted')));
revoke update, delete on public.forum_comments from anon, authenticated;

revoke all on function public.cast_forum_vote(uuid, smallint) from public;
revoke all on function public.moderate_forum_post(uuid, public.forum_status) from public;
revoke all on function public.link_demand_to_project(uuid, uuid) from public;
revoke all on function public.get_forum_stats() from public;
grant execute on function public.cast_forum_vote(uuid, smallint) to authenticated;
grant execute on function public.moderate_forum_post(uuid, public.forum_status) to authenticated;
grant execute on function public.link_demand_to_project(uuid, uuid) to authenticated;
grant execute on function public.get_forum_stats() to anon, authenticated;
