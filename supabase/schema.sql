-- ============================================================================
-- CivicSync — unified database schema (South Chennai edition)
-- ----------------------------------------------------------------------------
-- Single source of truth. Built on Person 2's authentication/RLS base and
-- extended for: dig-once look-ahead, citizen reporting without a registered
-- project, a department scorecard, "my area" subscriptions and an open-data
-- enrichment cache. No PostGIS dependency — proximity uses a haversine
-- function so the schema runs cleanly on any PostgreSQL 14+ (local or Supabase).
--
-- Apply order on a clean database:
--   1) schema.sql   (this file)
--   2) policies.sql
--   3) functions.sql
--   4) seed_south_chennai.sql
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerated vocabularies. THE frontend speaks exactly these strings.
-- ---------------------------------------------------------------------------
create type public.user_role        as enum ('citizen','official','admin');
create type public.approval_status  as enum ('pending','approved','rejected');
create type public.project_status   as enum ('planned','ongoing','delayed','completed','cancelled');
create type public.work_type        as enum ('road_repair','water_pipeline','sewer_drainage','electricity','telecom','gas','stormwater','other');
create type public.report_category  as enum ('quality','safety','delay','damage','unregistered_work','other');
create type public.report_status    as enum ('open','under_review','resolved','dismissed');
create type public.conflict_status  as enum ('open','coordinating','resolved','dismissed','cleared');
create type public.conflict_type    as enum ('schedule_overlap','lookahead_repeat','proximity');

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table public.departments (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique check (char_length(trim(name)) between 2 and 120),
  contact_email text,
  contact_phone text,
  created_at    timestamptz not null default now()
);

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text check (full_name is null or char_length(trim(full_name)) between 2 and 120),
  role            public.user_role not null default 'citizen',
  department_id   uuid references public.departments(id) on delete restrict,
  approval_status public.approval_status not null default 'approved',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (role <> 'official' or department_id is not null),
  check (role <> 'citizen'  or department_id is null)
);

create table public.projects (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null check (char_length(trim(title)) between 3 and 160),
  description            text check (description is null or char_length(description) <= 4000), -- purpose of the work
  road_name              text not null check (char_length(trim(road_name)) between 2 and 160),
  road_segment_id        text check (road_segment_id is null or char_length(road_segment_id) <= 120), -- shared id across depts
  location_description   text check (location_description is null or char_length(location_description) <= 500),
  latitude               double precision not null check (latitude between -90 and 90),
  longitude              double precision not null check (longitude between -180 and 180),
  segment_end_latitude   double precision check (segment_end_latitude is null or segment_end_latitude between -90 and 90),
  segment_end_longitude  double precision check (segment_end_longitude is null or segment_end_longitude between -180 and 180),
  work_type              public.work_type not null,
  department_id          uuid not null references public.departments(id) on delete restrict,
  start_date             date not null,
  end_date               date not null,
  actual_end_date        date,
  revised_end_date       date,
  status                 public.project_status not null default 'planned',
  progress_percent       smallint not null default 0 check (progress_percent between 0 and 100),
  contractor_name        text check (contractor_name is null or char_length(contractor_name) <= 160),
  estimated_cost_inr     bigint check (estimated_cost_inr is null or estimated_cost_inr >= 0),
  version                integer not null default 1,
  created_by             uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (end_date >= start_date),
  check (actual_end_date  is null or actual_end_date  >= start_date),
  check (revised_end_date is null or revised_end_date >= start_date),
  check (status <> 'completed' or progress_percent = 100)
);

-- Citizen reports. project_id is NULLABLE: a resident can report digging that
-- is not on the register at all (the brief's core pain). Such a report carries
-- its own coordinates and may later be matched to a project by an official.
create table public.citizen_reports (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  project_id         uuid references public.projects(id) on delete set null,
  matched_project_id uuid references public.projects(id) on delete set null,
  is_unregistered    boolean not null default false,
  latitude           double precision check (latitude is null or latitude between -90 and 90),
  longitude          double precision check (longitude is null or longitude between -180 and 180),
  road_name          text check (road_name is null or char_length(road_name) <= 160),
  category           public.report_category not null,
  description        text not null check (char_length(trim(description)) between 10 and 4000),
  photo_path         text check (photo_path is null or (photo_path like 'reports/' || user_id::text || '/%' and char_length(photo_path) <= 500)),
  status             public.report_status not null default 'open',
  official_response  text check (official_response is null or char_length(official_response) <= 2000),
  reviewed_by        uuid references public.profiles(id) on delete set null,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  -- An unregistered report needs a location; a project-linked report needs a project.
  check (is_unregistered = false or project_id is null),
  check (project_id is not null or (latitude is not null and longitude is not null))
);

create table public.project_updates (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  status           public.project_status not null,
  progress_percent smallint not null check (progress_percent between 0 and 100),
  progress_note    text not null check (char_length(trim(progress_note)) between 3 and 2000),
  delay_reason     text check (delay_reason is null or char_length(delay_reason) <= 1000),
  revised_end_date date,
  updated_by       uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  check (status <> 'delayed'   or nullif(trim(delay_reason), '') is not null),
  check (status <> 'completed' or progress_percent = 100)
);

create table public.project_conflicts (
  id              uuid primary key default gen_random_uuid(),
  project_a_id    uuid not null references public.projects(id) on delete cascade,
  project_b_id    uuid not null references public.projects(id) on delete cascade,
  conflict_type   public.conflict_type not null,
  reason          text not null check (char_length(trim(reason)) between 10 and 2000),
  distance_m      double precision,
  status          public.conflict_status not null default 'open',
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  is_current      boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (project_a_id <> project_b_id),
  check (project_a_id <  project_b_id), -- canonical ordering → one row per pair
  check (status not in ('resolved','dismissed') or nullif(trim(resolution_note), '') is not null),
  unique (project_a_id, project_b_id)
);

create table public.project_audit_log (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action in ('insert','update','delete')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

-- "My area": a resident subscribes to a point + radius to get upcoming works.
create table public.area_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  label      text not null check (char_length(trim(label)) between 1 and 80),
  latitude   double precision not null check (latitude between -90 and 90),
  longitude  double precision not null check (longitude between -180 and 180),
  radius_m   integer not null default 800 check (radius_m between 100 and 5000),
  created_at timestamptz not null default now()
);

-- Shared server-side cache for open-data enrichment (weather/air-quality).
-- Lets one lookup serve every viewer and keeps us well under API rate limits.
create table public.enrichment_cache (
  cache_key  text primary key,
  payload    jsonb not null,
  fetched_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index projects_department_status_idx on public.projects(department_id,status);
create index projects_schedule_idx          on public.projects(start_date,end_date);
create index projects_road_idx              on public.projects(lower(road_name));
create index projects_segment_idx           on public.projects(road_segment_id) where road_segment_id is not null;
create index projects_active_geo_idx        on public.projects(latitude,longitude) where status in ('planned','ongoing','delayed');
create index reports_user_created_idx       on public.citizen_reports(user_id,created_at desc);
create index reports_project_status_idx     on public.citizen_reports(project_id,status);
create index reports_unregistered_idx       on public.citizen_reports(is_unregistered) where is_unregistered = true;
create index updates_project_created_idx    on public.project_updates(project_id,created_at desc);
create index conflicts_status_idx           on public.project_conflicts(status,created_at desc);
create index conflicts_project_idx          on public.project_conflicts(project_a_id,project_b_id);
create index audit_project_created_idx      on public.project_audit_log(project_id,created_at desc);
create index subs_user_idx                  on public.area_subscriptions(user_id);
