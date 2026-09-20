-- Session 8: Website CMS + Client Gallery Sets foundation.
-- * Reuses the existing folders table as the internal storage for client gallery SETS.
--   We only ADD the columns the Sets UX needs; nothing about the public gallery
--   storage/RLS/signed-URL architecture changes.
-- * Website content tables are admin-only (is_admin()) with the same RLS posture as
--   galleries/photos. Public pages consume these through server code + storage signed
--   URLs only — never raw storage paths, never public buckets.

-- 1) Sets = folders. Add description, published (hide/show), and a single highlight photo.
--    The highlight must be a photo that BELONGS to the SAME gallery/folder; enforced by
--    pointing at photos(id, gallery_id, folder_id) and a composite check so you can't pick
--    a photo from a different set. Deleting that photo nulls the highlight (dependency set null).
alter table public.folders
  add column if not exists description text check (description is null or char_length(description) <= 2000),
  add column if not exists published boolean not null default true,
  add column if not exists cover_photo_id uuid;

alter table public.folders
  drop constraint if exists folders_cover_photo_matches_photo_key;

-- The cover-photo FK below references photos(id, gallery_id, folder_id), so that
-- column set needs a unique constraint to be a valid FK target.
alter table public.photos
  add constraint photos_gallery_folder_key
  unique (id, gallery_id, folder_id);

alter table public.folders
  add constraint folders_must_be_cover_of_own_set
  foreign key (cover_photo_id, gallery_id, id)
  references public.photos (id, gallery_id, folder_id)
  on delete set null
  deferrable initially deferred;

-- 2) Website home content (public marketing page). Admin writes, public reads via server query + signed URLs.
create table if not exists public.website_home_items (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('hero','selected_work','studio','cta')),
  title text check (title is null or char_length(trim(title)) between 1 and 200),
  category text check (category is null or char_length(trim(category)) <= 100),
  href text check (href is null or char_length(href) <= 400),
  asset_path text check (asset_path is null or asset_path !~ '^/'),
  asset_mime text check (asset_mime is null or asset_mime like 'image/%'),
  asset_bytes bigint check (asset_bytes is null or asset_bytes > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Public portfolio projects (the "Portfolio" website section) + their photos.
create table if not exists public.website_portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text check (category is null or char_length(trim(category)) <= 100),
  description text check (description is null or char_length(description) <= 5000),
  cover_path text check (cover_path is null or cover_path !~ '^/'),
  cover_mime text check (cover_mime is null or cover_mime like 'image/%'),
  cover_width integer check (cover_width is null or cover_width > 0),
  cover_height integer check (cover_height is null or cover_height > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.website_portfolio_projects (id) on delete cascade,
  asset_path text not null check (asset_path !~ '^/'),
  asset_mime text not null check (asset_mime like 'image/%'),
  asset_bytes bigint not null check (asset_bytes > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

-- 4) RLS: website CMS tables are admin-managed only (same is_admin() used everywhere).
alter table public.website_home_items enable row level security;
alter table public.website_portfolio_projects enable row level security;
alter table public.website_portfolio_photos enable row level security;

create policy "admin manages website home items" on public.website_home_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin manages website portfolio projects" on public.website_portfolio_projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin manages website portfolio photos" on public.website_portfolio_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5) Storage: a private bucket for website assets (public=false like the gallery bucket),
--    served ONLY via signed URLs through server code. No public bucket, no raw paths.
insert into storage.buckets (id, name, public) values ('website-assets', 'website-assets', false)
on conflict (id) do update set public = false;

create policy "admin manages website assets" on storage.objects
  for all to authenticated
  using (bucket_id = 'website-assets' and public.is_admin())
  with check (bucket_id = 'website-assets' and public.is_admin());

-- 6) Namespaced object storage layout for website assets (mirrors the gallery bucket layout).
--    We don't need a separate table for object rows — photos reference their (private) path,
--    exactly like galleries.photos. Public code always goes through signed URLs.
insert into storage.buckets (id, name, public) values ('website-assets', 'website-assets', false)
on conflict (id) do update set public = false;

create policy "public website admin creates objects" on storage.objects
  for insert to authenticated with check (bucket_id = 'website-assets' and public.is_admin());

create policy "public website admin reads objects" on storage.objects
  for select to authenticated using (bucket_id = 'website-assets' and public.is_admin());

create policy "public website admin updates objects" on storage.objects
  for update to authenticated using (bucket_id = 'website-assets' and public.is_admin()) with check (bucket_id = 'website-assets' and public.is_admin());

create policy "public website admin deletes objects" on storage.objects
  for delete to authenticated using (bucket_id = 'website-assets' and public.is_admin());

-- 7) Keep rows honest under concurrent edits.
create trigger website_home_items_set_updated_at before update on public.website_home_items
  for each row execute procedure public.set_updated_at();
create trigger website_portfolio_projects_set_updated_at before update on public.website_portfolio_projects
  for each row execute procedure public.set_updated_at();
