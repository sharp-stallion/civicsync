-- ============================================================================
-- CivicSync — Migration v3: non-destructive security verification + demand cap
-- ----------------------------------------------------------------------------
-- SAFE / ADDITIVE ONLY. No table or column is created, altered or dropped.
-- This file: (1) audits current state, (2) re-asserts RLS is ON, (3) replaces
-- ONE policy to add a "max 2 demands per resident per day" spam cap.
-- Re-runnable. Run AFTER schema/functions/policies/migration_forum.
-- ============================================================================

-- ---- (1) PRE-CHECK AUDIT — run these first and eyeball the output ----------
-- Confirms the columns the policies rely on actually exist before we touch RLS.
select '[audit] tables with RLS' as check, relname, relrowsecurity
from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
  and relname in ('profiles','projects','citizen_reports','project_updates',
                  'project_conflicts','forum_posts','forum_votes','forum_comments')
order by relname;

select '[audit] policy count per table' as check, schemaname, tablename, count(*) policies
from pg_policies where schemaname = 'public' group by schemaname, tablename order by tablename;

select '[audit] key columns present' as check,
  to_regclass('public.forum_posts') is not null as forum_posts_exists,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='home_area') as profiles_home_area,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_posts' and column_name='author_id') as forum_author_id;

-- ---- (2) RE-ASSERT RLS IS ENABLED (idempotent, never destructive) ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','projects','citizen_reports','project_updates',
                           'project_conflicts','project_audit_log','area_subscriptions',
                           'enrichment_cache','forum_posts','forum_votes','forum_comments']
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
    else
      raise notice '[skip] table public.% not found — leaving as-is (non-blocking)', t;
    end if;
  end loop;
end $$;

-- ---- (3) SPAM CAP: max 2 demands per resident per IST day -------------------
-- The per-day count MUST go through a SECURITY DEFINER function, not an inline
-- subquery on forum_posts — a policy that reads its own table recurses
-- ("infinite recursion detected in policy"). The function bypasses RLS safely.
create or replace function public.my_demands_today() returns integer
  language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.forum_posts p
  where p.author_id = (select auth.uid())
    and p.created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
$$;
revoke all on function public.my_demands_today() from public;
grant execute on function public.my_demands_today() to authenticated;

-- Policy-only change (no schema change): verified residents, capped at 2/day.
drop policy if exists forum_posts_insert on public.forum_posts;
create policy forum_posts_insert on public.forum_posts for insert to authenticated with check (
  author_id = (select auth.uid())
  and status = 'pending'
  and public.is_verified_resident()
  and public.my_demands_today() < 2
);

-- ---- VERIFICATION (run after applying) -------------------------------------
select '[verify] forum insert policy has daily cap' as check,
  position('< 2' in pg_get_expr(polwithcheck, polrelid)) > 0 as cap_present
from pg_policy where polname = 'forum_posts_insert';
