-- Session 6: selection submissions and client-created photo shares.
alter table public.photo_shares alter column created_by drop not null;
alter table public.photo_shares alter column created_by drop default;
create table if not exists public.selection_submissions (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  selection_session_hash text not null check (char_length(selection_session_hash) >= 32),
  photo_count integer not null check (photo_count > 0),
  status text not null default 'submitted' check (status in ('submitted')),
  submitted_at timestamptz not null default now(),
  unique (gallery_id, selection_session_hash)
);
create index if not exists selection_submissions_gallery_id_submitted_at_idx on public.selection_submissions (gallery_id, submitted_at desc);
alter table public.selection_submissions enable row level security;
create policy "admin manages selection submissions" on public.selection_submissions for all to authenticated using (public.is_admin()) with check (public.is_admin());
