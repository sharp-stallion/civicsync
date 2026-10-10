-- ============================================================================
-- CivicSync — PATCH: RLS audit + 2-demands-per-day limit
-- ----------------------------------------------------------------------------
-- NON-DESTRUCTIVE. Zero schema changes (no table/column adds/alters/drops).
-- Safe to run on the live database. Only (re)enables RLS and (re)writes a
-- policy. Run it in the Supabase SQL editor after the base files + migration.
-- ============================================================================

-- ---- 1. AUDIT: see current column names + whether RLS is on (read-only) -----
-- Run this block first and eyeball it; it changes nothing.
select 'RLS status' as audit,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('profiles','projects','citizen_reports','project_updates',
                    'project_conflicts','project_audit_log','departments',
                    'area_subscriptions','enrichment_cache',
                    'forum_posts','forum_votes','forum_comments')
order by c.relname;

-- Column presence audit (confirms names before we rely on them).
select table_name, string_agg(column_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public'
  and table_name in ('forum_posts','citizen_reports','profiles')
group by table_name
order by table_name;

-- ---- 2. ENSURE RLS is on everywhere (idempotent; enabling twice is a no-op) -
do $$
declare t text;
begin
  foreach t in array array['profiles','projects','citizen_reports','project_updates',
                           'project_conflicts','project_audit_log','departments',
                           'area_subscriptions','enrichment_cache',
                           'forum_posts','forum_votes','forum_comments']
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
    else
      raise notice 'SKIP: table public.% not found (run base migrations first)', t;
    end if;
  end loop;
end $$;

-- ---- 3. FORUM: limit each resident to 2 NEW demands per calendar day --------
-- Enforced in the INSERT policy (cannot be bypassed from the browser).
-- Counts only this author's own rows created today; no schema change.
do $$
begin
  if to_regclass('public.forum_posts') is null then
    raise notice 'SKIP: forum_posts not found — apply migration_forum.sql first.';
    return;
  end if;
  drop policy if exists forum_posts_insert on public.forum_posts;
  create policy forum_posts_insert on public.forum_posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'pending'
    and public.is_verified_resident()
    and (
      select count(*) from public.forum_posts p
      where p.author_id = (select auth.uid())
        and p.created_at >= date_trunc('day', now())
    ) < 2
  );
end $$;

-- Helper the UI calls to show "N of 2 demands left today" (read-only count).
create or replace function public.my_demands_today() returns integer
  language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.forum_posts
   where author_id = (select auth.uid()) and created_at >= date_trunc('day', now())
$$;
revoke all on function public.my_demands_today() from public;
grant execute on function public.my_demands_today() to authenticated;

-- ---- 4. VERIFY (read-only) --------------------------------------------------
select 'policies on forum_posts' as verify, policyname, cmd
from pg_policies where schemaname = 'public' and tablename = 'forum_posts'
order by policyname;
