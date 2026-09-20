-- Session 10: Sets publish/hide + cover. The admin UI calls these "Sets"; the
-- underlying table stays folders (internal identifier unchanged, matching the
-- established "folders table" naming in Sessions 2/6/8 — no rename on disk).

-- folders already declares unique (id, gallery_id); photos already declares
-- unique (id, gallery_id). To let a Set's cover point at one exact photo of the
-- SAME gallery AND SAME set, we need photos unique over (id, gallery_id, folder_id)
-- so the composite FK below has a valid target.

alter table public.folders
  add column if not exists published boolean not null default true;

alter table public.folders
  add column if not exists cover_photo_id uuid;

-- Drop the Session-8 cover FK (folders_must_be_cover_of_own_set) and the stale
-- Session-10 name (folders_cover_photo_matches_photo_key) BEFORE dropping the
-- unique index that the real FK depends on (depends-on-index error 2BP01).
alter table public.folders
  drop constraint if exists folders_must_be_cover_of_own_set;

alter table public.folders
  drop constraint if exists folders_cover_photo_matches_photo_key;

alter table public.photos
  drop constraint if exists photos_gallery_folder_key;

alter table public.photos
  add constraint photos_gallery_folder_key unique (id, gallery_id, folder_id);

alter table public.folders
  add constraint folders_cover_photo_matches_photo_key
  foreign key (cover_photo_id, gallery_id, id)
  references public.photos (id, gallery_id, folder_id)
  on delete set null
  deferrable initially deferred;
