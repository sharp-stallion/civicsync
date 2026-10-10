-- ============================================================================
-- CivicSync — Row-Level Security. Apply AFTER schema.sql, BEFORE functions.sql
-- (functions.sql grants EXECUTE; policies here gate table access).
-- RLS is the real access boundary. UI role checks are for display only.
-- ============================================================================

-- Base privileges. Hosted Supabase grants these to anon/authenticated
-- automatically; granting them here too makes the schema run identically on
-- plain/local PostgreSQL. RLS policies below are what actually restrict rows.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

alter table public.departments       enable row level security;
alter table public.profiles          enable row level security;
alter table public.projects          enable row level security;
alter table public.citizen_reports   enable row level security;
alter table public.project_updates   enable row level security;
alter table public.project_conflicts enable row level security;
alter table public.project_audit_log enable row level security;
alter table public.area_subscriptions enable row level security;
alter table public.enrichment_cache  enable row level security;

-- Departments: public read; only admins manage.
create policy departments_public_read on public.departments for select to anon, authenticated using (true);
create policy departments_admin_manage on public.departments for all to authenticated
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- Profiles: self or admin read; may only edit own name. No self-promotion.
create policy profiles_self_or_admin_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.current_user_role() = 'admin');
create policy profiles_self_name_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update(full_name) on public.profiles to authenticated;

-- Projects: public read; approved managers insert/update their department; admins delete.
create policy projects_public_read on public.projects for select to anon, authenticated using (true);
create policy projects_manager_insert on public.projects for insert to authenticated
  with check (public.is_project_manager(department_id) and (created_by is null or created_by = (select auth.uid())));
create policy projects_manager_update on public.projects for update to authenticated
  using (public.is_project_manager(department_id)) with check (public.is_project_manager(department_id));
create policy projects_admin_delete on public.projects for delete to authenticated
  using (public.current_user_role() = 'admin');

-- Citizen reports: owner + the responsible manager can read; owner inserts own.
-- Unregistered reports (no project) are publicly readable so the city can see
-- undisclosed digging; owners still see all of their own.
create policy reports_read on public.citizen_reports for select to anon, authenticated using (
  is_unregistered = true
  or user_id = (select auth.uid())
  or exists (select 1 from public.projects p
             where p.id in (citizen_reports.project_id, citizen_reports.matched_project_id)
               and public.is_project_manager(p.department_id))
);
create policy reports_owner_insert on public.citizen_reports for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'open' and reviewed_by is null and reviewed_at is null and official_response is null
);
revoke update, delete on public.citizen_reports from anon, authenticated;

-- Project updates: public read; approved managers append for their department.
create policy updates_public_read on public.project_updates for select to anon, authenticated using (true);
create policy updates_manager_insert on public.project_updates for insert to authenticated with check (
  exists (select 1 from public.projects p where p.id = project_id and public.is_project_manager(p.department_id))
  and (updated_by is null or updated_by = (select auth.uid()))
);
revoke update, delete on public.project_updates from anon, authenticated;

-- Conflicts: public read (transparency). All writes go through the engine /
-- the resolve RPC (SECURITY DEFINER), so direct writes are revoked.
create policy conflicts_public_read on public.project_conflicts for select to anon, authenticated using (true);
revoke insert, update, delete on public.project_conflicts from anon, authenticated;

-- Audit log: admin read only.
create policy audit_admin_read on public.project_audit_log for select to authenticated
  using (public.current_user_role() = 'admin');
revoke insert, update, delete on public.project_audit_log from anon, authenticated;

-- Area subscriptions: a user manages only their own.
create policy subs_owner_all on public.area_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Enrichment cache: public read; writes only through cache_enrichment() RPC.
create policy enrichment_public_read on public.enrichment_cache for select to anon, authenticated using (true);
revoke insert, update, delete on public.enrichment_cache from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Citizen report photos (private bucket; 5 MB; JPEG/PNG/WebP).
-- ---------------------------------------------------------------------------
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('civic-report-photos','civic-report-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy report_photo_owner_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'civic-report-photos'
  and (storage.foldername(name))[1] = 'reports'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
create policy report_photo_authorized_read on storage.objects for select to authenticated using (
  bucket_id = 'civic-report-photos' and (
    (storage.foldername(name))[1] = 'reports' and (storage.foldername(name))[2] = (select auth.uid())::text
    or public.current_user_role() = 'admin'
    or exists (select 1 from public.citizen_reports r
               join public.projects p on p.id in (r.project_id, r.matched_project_id)
               where r.photo_path = name and public.is_project_manager(p.department_id))
  )
);
