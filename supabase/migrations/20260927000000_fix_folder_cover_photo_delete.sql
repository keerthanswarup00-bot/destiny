-- Fix: folders.cover_photo_id composite FK breaks photo deletion.
--
-- Session 8/10 created the "cover must belong to this set" FK as
--   foreign key (cover_photo_id, gallery_id, id)
--     references public.photos (id, gallery_id, folder_id)
--     on delete set null deferrable initially deferred
-- Because the child key list includes folders.id (the PRIMARY KEY), Postgres's
-- ON DELETE SET NULL attempts to null EVERY referencing child column — including
-- folders.id — which violates its NOT NULL PK constraint. Deleting any photo
-- that is currently a folder cover then fails at commit with:
--   ERROR 23502: null value in column "id" of relation "folders"
--   violates not-null constraint
-- which surfaces to the admin as "Could not delete those photos. Try again."
-- (photos-delete) and — because storage was already purged — leaves the photo
-- permanently referenced by a folder that can no longer be deleted.
--
-- Fix: point the FK at photos.id alone. A single, non-key SET NULL is legal and
-- only nulls folders.cover_photo_id, so deleting a cover photo succeeds and
-- simply clears the cover. The original "same gallery AND same set" rule is
-- re-imposed with a guard trigger on folders writes. photos_gallery_folder_key
-- (unique on id, gallery_id, folder_id) existed only to back the composite FK
-- and is dropped now that nothing references it. Existing rows are untouched;
-- the guard fires only on insert/update.
--
-- A SECOND trigger keeps covers honest when a photo moves: the pre-fix schema
-- failed such moves at commit; we now auto-clear the stale cover reference so
-- a moved photo silently stops being a cover (the admin can re-pick one).

alter table public.folders
  drop constraint if exists folders_cover_photo_matches_photo_key;

alter table public.folders
  drop constraint if exists folders_must_be_cover_of_own_set;

alter table public.photos
  drop constraint if exists photos_gallery_folder_key;

alter table public.folders
  add constraint folders_cover_photo_matches_photo_key
  foreign key (cover_photo_id)
  references public.photos (id)
  on delete set null
  deferrable initially deferred;

create or replace function public.folders_cover_must_belong_to_own_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cover_photo_id is not null then
    if not exists (
      select 1 from public.photos
      where id = new.cover_photo_id
        and gallery_id = new.gallery_id
        and folder_id = new.id
    ) then
      raise exception 'cover_photo_id must reference a photo in the same gallery and set';
    end if;
  end if;
  return new;
end;
$$;

create trigger folders_cover_must_belong_to_own_photo_trigger
before insert or update of cover_photo_id, gallery_id
on public.folders
for each row execute procedure public.folders_cover_must_belong_to_own_photo();

create or replace function public.clear_folder_cover_on_photo_relocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.folder_id is distinct from old.folder_id
     or new.gallery_id is distinct from old.gallery_id then
    update public.folders
      set cover_photo_id = null
      where cover_photo_id = old.id
        and gallery_id = old.gallery_id;
  end if;
  return new;
end;
$$;

create trigger clear_folder_cover_on_photo_relocation_trigger
after update of folder_id, gallery_id on public.photos
for each row execute procedure public.clear_folder_cover_on_photo_relocation();