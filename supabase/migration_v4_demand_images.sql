-- ============================================================================
-- CivicSync — Migration v4: let residents attach a photo to a demand.
-- ADDITIVE. Run after migration_forum.sql. Re-runnable.
-- Adds forum_posts.image_path + a public image bucket (demands are public, so
-- a public bucket avoids per-view signed URLs). Upload stays owner-scoped.
-- ============================================================================

alter table public.forum_posts add column if not exists image_path text
  check (image_path is null or char_length(image_path) <= 500);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('civic-demand-photos', 'civic-demand-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists demand_photo_owner_upload on storage.objects;
create policy demand_photo_owner_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'civic-demand-photos'
  and (storage.foldername(name))[1] = 'demands'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists demand_photo_public_read on storage.objects;
create policy demand_photo_public_read on storage.objects for select to anon, authenticated using (
  bucket_id = 'civic-demand-photos'
);
