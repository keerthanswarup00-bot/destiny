-- Add optional category metadata to Website Gallery photos.
-- Existing photos remain uncategorized and continue to appear in All.
alter table public.photos
  add column if not exists category text
  check (category is null or category in ('wedding', 'events', 'portraits', 'celebrations'));

alter table public.photos
  add column if not exists published_category text
  check (published_category is null or published_category in ('wedding', 'events', 'portraits', 'celebrations'));

alter table public.photos
  add column if not exists published boolean not null default true;

alter table public.photos
  add column if not exists pending_delete boolean not null default false;

update public.photos
set published_category = category
where published_category is null;
