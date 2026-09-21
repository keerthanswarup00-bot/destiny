-- Add Website Gallery working/publication state to the shared photos table.
-- Existing rows remain published and retain their current category.
alter table public.photos
  add column if not exists published_category text,
  add column if not exists published boolean not null default true,
  add column if not exists pending_delete boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'photos_published_category_check'
      and conrelid = 'public.photos'::regclass
  ) then
    alter table public.photos
      add constraint photos_published_category_check
      check (published_category is null or published_category in ('wedding', 'events', 'portraits', 'celebrations'));
  end if;
end
$$;

update public.photos
set
  published_category = category,
  published = true,
  pending_delete = false;
